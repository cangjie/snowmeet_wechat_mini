// 机构「制作会员卡」：机构自己设养护 / 租赁优惠，不能低于管理员设的底价；保存即生效，只影响之后领取的新卡。
// 只显示管理员在「会籍卡底价」里设置了的项目和方式：只设了一口价的格子只有一个一口价输入框，没设的方式不出现（用户 2026-11-17）。
// 有优惠的格子（门店 × 单项/双项的养护，和租赁）就是会员卡「指定的商品和服务」；没设优惠的格子不享受会员卡价。
// 卡种列表（2026-11-17）：每个卡种两个分享按钮——「分享二维码」「分享小程序卡片」，不再有「生成分享卡」。
//   · 每点一次分享，服务端就记一条待领取的卡（一次分享 = 一张卡 = 一位顾客领取）；二维码在点击时记，小程序卡片在选好转发对象时记
//     （onShareAppMessage 的 promise 里建卡，拿到路径再发出去）。
//   · 对方扫码 / 点开后在领取页授权头像昵称并领取，得到和本人绑定的卡号。
//   · 每个卡种下面有「分享记录」（默认折叠，用户 2026-11-18）：每次分享一条，已领取的显示领取人的头像、昵称和卡号；
//     没领取的可以再次看二维码、再次分享小程序卡片（同一张卡，不新记一次），也可以直接删除（删除后码和卡片都失效，记录不再列出）。
//   · 卡种本身：从来没人领取过的可以删除（连同它还没人领取的分享一起删）；有人领取过的不能删，卡片上写明已有几位领取（用户 2026-11-18）。
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/coach-view.js')
const shareCover = require('../common/share-cover.js')

// 没拿到领取路径时转发出去的路径：领取页没有 token 会提示「分享链接不完整」
const BROKEN_PATH = '/pages/coach/claim/claim'

Page({
  data: {
    blocked: '', loading: true, canEdit: false, reason: '', name: '', modes: view.MODES,
    cells: [], rental: null, rentalText: '', showRental: false, nothingOpen: false, dirty: false, validUntil: '', saving: false, editing: false, templates: [], shareRows: {}, shareStats: {}, otherShares: [], otherStats: { total: 0, pending: 0, claimed: 0 }, expanded: {}, fallbackCover: shareCover.FALLBACK, sharesError: false, templateId: null, sharingQr: false,
    qr: { show: false, url: '', name: '', cardId: null, loading: false, error: '' }
  },

  onLoad() {
    // 只允许用卡种上的按钮分享，不让右上角菜单把这个页面本身转发出去
    if (wx.hideShareMenu) wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    base.boot(this, 'coach').then(() => this.load()).catch(() => {})
  },
  onShow() { if (this.loadedOnce && !this.data.dirty) this.load() },
  onReady() { this._membershipCanvasReady = true; shareCover.prepareList(this, 'templates', '会籍卡') },
  onUnload() { this._membershipCanvasClosed = true },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh()) },

  apply(d) {
    this.loadedOnce = true
    const rental = view.rentalStandard(d.rental)
    const cells = view.standardCells(d.cells)
    this.setData({
      loading: false, blocked: '', editing: true, templateId: d.id || null, canEdit: !!d.canEdit, reason: d.reason || '', name: d.name || '',
      cells, rental, rentalText: rental.text, dirty: false, saving: false,
      // 管理员什么都没开放（养护格子和租赁都没有）时，页面提示去联系管理员
      showRental: !!rental.open || !!rental.text, nothingOpen: !cells.some(c => c.visible) && !rental.open && !rental.text,
      validUntil: view.dayText(d.validUntil)
    })
  },

  load() {
    return api.listCardTemplates().then(d => {
      this.loadedOnce = true
      const rows = (d.templates || []).map(t => Object.assign({}, t, { benefit: view.benefitLines(t.carePrices, t.rentalRate) }))
      this.setData({ loading: false, blocked: '', editing: false, dirty: false, templates: shareCover.decorate(this, rows, '会籍卡') })
      shareCover.prepareList(this, 'templates', '会籍卡')
      return this.loadShares()
    }).catch(err => {
      this.setData({ loading: false })
      if (err && err.code === 3) this.setData({ blocked: '你还不是教练或机构' })
      else base.fail(err)
    })
  },

  // 分享记录：这个机构每一次分享一条，按卡种分组，每组默认折叠；新的在前。删除的分享服务端已不再返回
  loadShares() {
    const revision = this._sharesRevision = (this._sharesRevision || 0) + 1
    return api.listMyCards().then(d => {
      if (revision !== this._sharesRevision) return
      const rows = (d.cards || []).map(x => view.shareRow(Object.assign({}, x.card, { sharePath: x.sharePath })))
      const g = view.groupShares(rows, this.data.templates.map(t => t.id))
      this.setData({ shareRows: g.byTemplate, shareStats: g.stats, otherShares: g.other, otherStats: g.otherStats, sharesError: false })
    }).catch(() => { if (revision === this._sharesRevision) this.setData({ sharesError: true }) })
  },
  // 展开 / 折叠某个卡种的分享记录（other = 卡种已不在列表里的记录）
  onToggleShares(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ ['expanded.' + id]: !this.data.expanded[id] })
  },

  // 分享二维码：点一下记一次分享（建一张待领取的卡），再显示这张卡的二维码；顾客扫码后领取
  onShareQr(e) {
    if (this.data.sharingQr) return
    const id = Number(e.currentTarget.dataset.id)
    const template = this.data.templates.find(t => t.id === id)
    if (!template) return
    this.setData({ sharingQr: true })
    return api.createCard(id, 'qr').then(card => {
      this.setData({ sharingQr: false, qr: { show: true, url: this.qrUrl(card.cardId), name: card.cardName || template.name, cardId: card.cardId, loading: true, error: '' } })
      return this.loadShares()
    }).catch(err => { this.setData({ sharingQr: false }); base.fail(err) })
  },
  // 小程序版本跟当前运行版本一致（develop / trial / release）：预览版扫出来的码进预览版；加时间戳避免重试命中失败结果的缓存
  qrUrl(cardId) {
    const env = (getApp().globalData && getApp().globalData.env) || 'release'
    return api.cardQrUrl(cardId, env) + '&_=' + Date.now()
  },
  // 再次查看一条还没人领取的分享的二维码：同一张卡，不新记一次
  onViewQr(e) {
    const d = e.currentTarget.dataset
    if (!d.cardId) return
    this.setData({ qr: { show: true, url: this.qrUrl(d.cardId), name: d.name || '会籍卡', cardId: Number(d.cardId), loading: true, error: '' } })
  },
  onQrLoad() { this.setData({ 'qr.loading': false, 'qr.error': '' }) },
  onQrError() { this.setData({ 'qr.loading': false, 'qr.error': '二维码没生成出来，请点「重试」。这次分享已经记录，不用时可以在卡种的「分享记录」里删除。' }) },
  onQrRetry() { if (this.data.qr.cardId) this.setData({ 'qr.url': this.qrUrl(this.data.qr.cardId), 'qr.loading': true, 'qr.error': '' }) },
  onQrClose() { this.setData({ qr: { show: false, url: '', name: '', cardId: null, loading: false, error: '' } }); return this.loadShares() },
  onQrSave() {
    if (!this.data.qr.url) return
    wx.downloadFile({
      url: this.data.qr.url,
      success: res => {
        if (res.statusCode !== 200) { wx.showToast({ title: '保存失败，请重试', icon: 'none' }); return }
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '已保存到相册', icon: 'none' }),
          fail: () => wx.showToast({ title: '没有保存成功，可长按二维码保存', icon: 'none' })
        })
      },
      fail: () => wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    })
  },

  // 删除卡种：只有从来没人领取过的才有「删除」按钮（服务端也会拦）；它还没人领取的分享一并删除
  onDeleteTemplate(e) {
    const d = e.currentTarget.dataset
    const id = Number(d.id)
    const pending = Number(d.pending) || 0
    const content = pending > 0
      ? '这个卡种还有 ' + pending + ' 条没人领取的分享，会一起删除，已发出的二维码和小程序卡片都会失效。删除后不能恢复。'
      : '删除后不能恢复。'
    return base.confirm('删除卡种「' + (d.name || '') + '」', content, '删除').then(ok => {
      if (!ok) return
      return api.deleteCardTemplate(id).then(() => { base.done('已删除'); return this.load() }).catch(err => { base.fail(err); return this.load() })
    })
  },

  // 直接删除还没人领取的分享：删除后二维码和小程序卡片都不能再领，这条记录不再列出
  onDeleteShare(e) {
    const id = Number(e.currentTarget.dataset.id)
    return base.confirm('删除这条分享', '删除后，这条分享记录会消失，对方扫码或点开都不能再领取这张会籍卡。', '删除').then(ok => {
      if (!ok) return
      return api.revokeMyCard(id).then(() => { base.done('已删除'); return this.loadShares() }).catch(err => { base.fail(err); return this.loadShares() })
    })
  },

  onNew() { return api.getCardTemplate().then(d => this.apply(d)).catch(base.fail) },
  onEdit(e) { return api.getCardTemplate(e.currentTarget.dataset.id).then(d => this.apply(d)).catch(base.fail) },
  // 分享小程序卡片：按钮是 open-type="share"。
  //   · 卡种上的按钮（带 data-id = 卡种）：转发时才在 promise 里向服务端记一次分享（建一张待领取的卡）并拿到领取路径；
  //     建卡失败（比如待领取的卡已有 50 张）时提示原因，转发出去的卡片指向「分享链接不完整」页，不会被人领走。
  //   · 分享记录里还没人领取的那条上的按钮（带 data-path = 服务端给的那张卡的路径）：再次分享同一张卡，不新记一次。
  onShareAppMessage(e) {
    const target = e && e.target && e.target.dataset
    const id = target && Number(target.id)
    const name = (target && target.name) || '会籍卡'
    const title = '送你一张' + name
    const imageUrl = (target && target.cover) || shareCover.FALLBACK
    if (target && target.path) return { title, path: target.path, imageUrl }
    if (!id) return { title, path: BROKEN_PATH, imageUrl }
    const promise = api.createCard(id, 'card').then(card => {
      this.loadShares()
      return { title, path: card.sharePath, imageUrl }
    }).catch(err => { base.fail(err); return { title, path: BROKEN_PATH, imageUrl } })
    return { title, path: BROKEN_PATH, imageUrl, promise }
  },
  onRetryCover(e) { shareCover.retry(this, 'templates', e.currentTarget.dataset.name, '会籍卡') },
  onName(e) { this.setData({ name: e.detail.value, dirty: true }) },
  onBackToList() { return this.load() },

  // 有多种方式的格子才有方式按钮（一口价 / 折扣）；点方式不会清空已填的数
  onMode(e) {
    if (!this.data.canEdit) return
    const i = Number(e.currentTarget.dataset.i)
    const mode = e.currentTarget.dataset.mode
    const cell = this.data.cells[i]
    if (!cell || !cell.modes.some(m => m.key === mode)) return
    const patch = { dirty: true }
    patch['cells[' + i + '].mode'] = mode
    patch['cells[' + i + '].unit'] = view.cardUnit(Object.assign({}, cell, { mode }))
    this.setData(patch)
  },
  // 输入数：只有一种方式的格子自动按那种方式；留空 = 不优惠
  onCellText(e) {
    if (!this.data.canEdit) return
    const i = Number(e.currentTarget.dataset.i)
    const cell = this.data.cells[i]
    if (!cell) return
    const text = e.detail.value
    const patch = { dirty: true }
    patch['cells[' + i + '].text'] = text
    if (cell.modes.length === 1) {
      patch['cells[' + i + '].mode'] = String(text).trim() === '' ? 'none' : cell.modes[0].key
      patch['cells[' + i + '].unit'] = view.cardUnit(Object.assign({}, cell, { mode: patch['cells[' + i + '].mode'] }))
    }
    this.setData(patch)
  },
  onRentalText(e) { if (this.data.canEdit) this.setData({ rentalText: e.detail.value, dirty: true }) },

  onSave() {
    if (!this.data.canEdit || !this.data.dirty || this.data.saving) return
    if (!this.data.name.trim()) { wx.showToast({ title: '请填写卡种名称', icon: 'none' }); return }
    const r = view.standardPayload(this.data.cells, this.data.rentalText, this.data.rental)
    if (r.error) { wx.showToast({ title: r.error, icon: 'none', duration: 2800 }); return }
    this.setData({ saving: true })
    api.saveCardTemplate({ id: this.data.templateId, name: this.data.name.trim(), care: r.care, rental_rate: r.rate }).then(() => { base.done('卡种已保存'); return this.load() }).catch(err => {
      this.setData({ saving: false })
      base.fail(err)
    })
  }
})

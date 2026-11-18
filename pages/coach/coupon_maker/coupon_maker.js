// 「制作优惠券」（教练 / KOL / 机构都有）：按管理员设的「优惠券底价」做一个**分享批次**（用户 2026-11-18）——
// 起个券名，像做会员卡选项目一样给每个服务（万龙 / 崇礼的单项、双项）各自定价（一张券可以适用于不同的服务，留空 = 不适用），
// 规定这批多少张，创建时**不生成券**；配一个分享二维码 / 小程序卡片，可以转发给个人，也可以放进群里让大家领。
// 顾客扫码 / 点开后领取，领取时服务端才生成一张券；领满规定张数不能再领，每个 openid 每天只能领一次、同一批次只能领一次。
// 每个批次显示领取进度和领取人（头像、昵称、券码、有没有用）；没人领取过的批次可以删除。
// 页面和「制作会员卡」一样：默认是批次列表（每个批次上有分享二维码 / 分享小程序卡片），点「＋ 创建批次」才进入创建表单，创建成功回到列表。
// 一口价不能低于、折扣不能低于、减免不能超过底价；每张券限用一次，只用于该店单项 / 双项养护，加急加价、维修费照收。
// 管理员只开放了的项目和方式才会显示，没设置的一律不出现（用户 2026-11-17：免得误导）。
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/coach-view.js')
const shareCover = require('../common/share-cover.js')

// 没拿到领取路径时转发出去的路径：领取页没有 token 会提示「领取链接不完整」
const BROKEN_PATH = '/pages/coach/coupon_claim/coupon_claim'
const NO_QR = { show: false, url: '', name: '', batchId: null, loading: false, error: '' }

Page({
  data: {
    blocked: '', loading: true, editing: false, canMake: false, reason: '', name: '', validUntil: '',
    cells: [], cellDefs: [], editCells: [], batches: [], maxBatchSize: 0, maxOpenCapacity: 0, expanded: {}, fallbackCover: shareCover.FALLBACK, qr: NO_QR,
    nameText: '', countText: '10', submitting: false
  },

  onLoad() {
    // 只允许用批次上的按钮分享，不让右上角菜单把这个页面本身转发出去
    if (wx.hideShareMenu) wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    base.boot(this, 'coach').then(() => this.load()).catch(() => {})
  },
  onReady() { this._membershipCanvasReady = true; shareCover.prepareList(this, 'batches', '优惠券') },
  onUnload() { this._membershipCanvasClosed = true },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh()) },

  apply(d) {
    const rows = (d.batches || []).map(view.batchRow)
    this.setData({
      loading: false, blocked: '', canMake: !!d.canMake, reason: d.reason || '', name: d.name || '',
      validUntil: view.dayText(d.validUntil), cells: view.couponCells(d.cells), cellDefs: d.cells, maxBatchSize: d.maxBatchSize || 0, maxOpenCapacity: d.maxOpenCapacity || 0,
      batches: shareCover.decorate(this, rows, '优惠券')
    })
    shareCover.prepareList(this, 'batches', '优惠券')
  },

  load() {
    return api.getMyCouponMaker().then(d => this.apply(d)).catch(err => {
      this.setData({ loading: false })
      if (err && err.code === 3) this.setData({ blocked: '你还不是教练或机构' })
      else base.fail(err)
    })
  },

  // 进入创建表单（空白表单：每个开放的服务一行，上一次填的不带过来）/ 回到批次列表
  onNew() {
    if (!this.data.canMake || !this.data.cells.length) return
    this.touch()
    this.setData({ editing: true, editCells: view.couponEditCells(this.data.cellDefs), nameText: '', countText: '10' })
  },
  onBackToList() { this.setData({ editing: false }) },

  // 表单变了就换一个请求编号：同一份表单重试（网络不好）用同一个编号，服务端不会重复建批次
  touch() { this._requestId = '' },

  onName(e) { this.touch(); this.setData({ nameText: e.detail.value }) },
  onCount(e) { this.touch(); this.setData({ countText: e.detail.value }) },
  // 有多种方式的服务才有方式按钮（一口价 / 折扣 / 减免）；点方式不会清空已填的数
  onMode(e) {
    const i = Number(e.currentTarget.dataset.i)
    const mode = e.currentTarget.dataset.mode
    const cell = this.data.editCells[i]
    if (!cell || !cell.modes.some(m => m.key === mode)) return
    this.touch()
    const next = Object.assign({}, cell, { mode })
    this.setData({ ['editCells[' + i + '].mode']: mode, ['editCells[' + i + '].unit']: view.couponUnit(next), ['editCells[' + i + '].placeholder']: view.couponPlaceholder(next) })
  },
  // 输入价格：只有一种方式的服务自动按那种方式；留空 = 这张券不适用于这个服务
  onCellText(e) {
    const i = Number(e.currentTarget.dataset.i)
    if (!this.data.editCells[i]) return
    this.touch()
    this.setData({ ['editCells[' + i + '].text']: e.detail.value })
  },

  // 创建批次：不生成券，只记规定张数和分享链接
  onSubmit() {
    if (!this.data.canMake || this.data.submitting) return
    const r = view.couponBatchPayload(this.data.editCells, this.data.nameText, this.data.countText, this.data.maxBatchSize)
    if (r.error) { wx.showToast({ title: r.error, icon: 'none', duration: 3200 }); return }
    if (!this._requestId) this._requestId = 'c' + Date.now() + Math.floor(Math.random() * 1000000)
    this.setData({ submitting: true })
    api.createCouponBatch(Object.assign({ requestId: this._requestId }, r)).then(res => {
      this._requestId = ''
      this.apply(res.maker)
      this.setData({ submitting: false, editing: false })     // 回到列表，新批次在最上面
      base.done(res.made.repeated ? '这个批次之前已经创建过了' : '已创建批次，在下面分享二维码或小程序卡片')
    }).catch(err => {
      this.setData({ submitting: false })
      base.fail(err)
    })
  },

  // ---- 批次：展开领取记录 / 分享二维码 / 删除 ----
  onToggleClaimers(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ ['expanded.c' + id]: !this.data.expanded['c' + id] })
  },

  // 分享二维码：一个批次一个二维码，转发给个人或放进群里都用它；每次查看都是同一个批次
  onViewQr(e) {
    const d = e.currentTarget.dataset
    if (!d.id) return
    this.setData({ qr: { show: true, url: this.qrUrl(d.id), name: d.name || '优惠券', batchId: Number(d.id), loading: true, error: '' } })
  },
  // 小程序版本跟当前运行版本一致（develop / trial / release）：预览版扫出来的码进预览版；加时间戳避免重试命中失败结果的缓存
  qrUrl(batchId) {
    const env = (getApp().globalData && getApp().globalData.env) || 'release'
    return api.couponBatchQrUrl(batchId, env) + '&_=' + Date.now()
  },
  onQrLoad() { this.setData({ 'qr.loading': false, 'qr.error': '' }) },
  onQrError() { this.setData({ 'qr.loading': false, 'qr.error': '二维码没生成出来，请点「重试」。' }) },
  onQrRetry() { if (this.data.qr.batchId) this.setData({ 'qr.url': this.qrUrl(this.data.qr.batchId), 'qr.loading': true, 'qr.error': '' }) },
  onQrClose() { this.setData({ qr: NO_QR }) },
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

  // 分享小程序卡片：按钮是 open-type="share"，路径是这个批次的领取路径（服务端给的），可以转发给个人或群，同一个批次的链接一直有效，
  // 直到领满或被删除。
  onShareAppMessage(e) {
    const target = e && e.target && e.target.dataset
    const name = (target && target.name) || '优惠券'
    return { title: '送你一张' + name, path: (target && target.path) || BROKEN_PATH, imageUrl: (target && target.cover) || shareCover.FALLBACK }
  },
  onRetryCover(e) { shareCover.retry(this, 'batches', e.currentTarget.dataset.name, '优惠券') },

  // 删除没人领取过的批次：删除后二维码和小程序卡片都失效，不能恢复
  onDeleteBatch(e) {
    const id = Number(e.currentTarget.dataset.id)
    return base.confirm('删除这个批次', '删除后，这个批次的二维码和小程序卡片都不能再领取，不能恢复。', '删除').then(ok => {
      if (!ok) return
      return api.deleteCouponBatch(id).then(() => { base.done('已删除'); return this.load() }).catch(err => { base.fail(err); return this.load() })
    })
  },

  onGoCoupons() { wx.navigateTo({ url: '/pages/coach/home/home?tab=coupons' }) }
})

// 机构「制作会员卡」：机构自己设养护 / 租赁优惠，不能低于管理员设的底价；保存即生效，只影响之后领取的新卡。
// 只显示管理员在「会籍卡底价」里设置了的项目和方式：只设了一口价的格子只有一个一口价输入框，没设的方式不出现（用户 2026-11-17）。
// 有优惠的格子（门店 × 单项/双项的养护，和租赁）就是会员卡「指定的商品和服务」；没设优惠的格子不享受会员卡价。
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/coach-view.js')
const shareCover = require('../common/share-cover.js')

Page({
  data: {
    blocked: '', loading: true, canEdit: false, reason: '', name: '', modes: view.MODES,
    cells: [], rental: null, rentalText: '', showRental: false, nothingOpen: false, dirty: false, validUntil: '', saving: false, editing: false, templates: [], pending: [], pendingError: false, templateId: null, creating: false
  },

  onLoad() { base.boot(this, 'coach').then(() => this.load()).catch(() => {}) },
  onShow() { if (this.loadedOnce && !this.data.dirty) this.load() },
  onReady() { this._membershipCanvasReady = true; shareCover.prepareList(this, 'pending', '学员卡') },
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
      this.setData({ loading: false, blocked: '', editing: false, dirty: false, templates: shareCover.decorate(this, rows, '学员卡') })
      return this.loadPending()
    }).catch(err => {
      this.setData({ loading: false })
      if (err && err.code === 3) this.setData({ blocked: '你还不是教练或机构' })
      else base.fail(err)
    })
  },

  loadPending() {
    const revision = this._pendingRevision || 0
    return api.listMyCards('issued').then(d => {
      if (revision !== (this._pendingRevision || 0)) return
      const rows = (d.cards || []).map(x => ({ id: x.card.id, name: x.card.cardName || '学员卡', tokenTail: x.card.tokenTail, sharePath: x.sharePath }))
      this.setData({ pending: shareCover.decorate(this, rows, '学员卡'), pendingError: false })
      shareCover.prepareList(this, 'pending', '学员卡')
    }).catch(() => { this.setData({ pendingError: true }) })
  },
  onCreateShare(e) {
    if (this.data.creating) return
    const id = Number(e.currentTarget.dataset.id)
    const template = this.data.templates.find(t => t.id === id)
    if (!template) return
    this.setData({ creating: true })
    return api.createCard(id).then(card => {
      this._pendingRevision = (this._pendingRevision || 0) + 1
      const pending = this.data.pending.concat([{ id: card.cardId, name: card.cardName || template.name, tokenTail: card.tokenTail, sharePath: card.sharePath }])
      this.setData({ creating: false, pending: shareCover.decorate(this, pending, '学员卡') })
      shareCover.prepareList(this, 'pending', '学员卡')
      base.done('已生成，请分享给一位顾客')
    }).catch(err => { this.setData({ creating: false }); base.fail(err) })
  },
  onRevokePending(e) {
    const id = Number(e.currentTarget.dataset.id)
    return base.confirm('撤销待领取卡', '撤销后这张卡不能再被领取。', '撤销').then(ok => {
      if (ok) return api.revokeMyCard(id).then(() => { this._pendingRevision = (this._pendingRevision || 0) + 1; this.setData({ pending: this.data.pending.filter(c => c.id !== id) }); return this.loadPending() }).catch(base.fail)
    })
  },
  onNew() { return api.getCardTemplate().then(d => this.apply(d)).catch(base.fail) },
  onEdit(e) { return api.getCardTemplate(e.currentTarget.dataset.id).then(d => this.apply(d)).catch(base.fail) },
  onShareAppMessage(e) {
    const target = e && e.target && e.target.dataset
    return { title: '送你一张' + ((target && target.name) || '会员卡'), path: (target && target.path) || '/pages/mine/mine', imageUrl: (target && target.cover) || shareCover.FALLBACK }
  },
  onRetryCover(e) { shareCover.retry(this, 'pending', e.currentTarget.dataset.name, '学员卡') },
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

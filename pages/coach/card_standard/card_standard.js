// 机构「制作会员卡」：机构自己设养护 / 租赁优惠，不能低于管理员设的底价；保存即生效，只影响之后领取的新卡。
// 有优惠的格子（门店 × 单项/双项的养护，和租赁）就是会员卡「指定的商品和服务」；没设优惠的格子不享受会员卡价。
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/coach-view.js')

Page({
  data: {
    blocked: '', loading: true, canEdit: false, reason: '', name: '', modes: view.MODES,
    cells: [], rental: null, rentalText: '', dirty: false, validUntil: '', saving: false
  },

  onLoad() { base.boot(this, 'coach').then(() => this.load()).catch(() => {}) },
  onShow() { if (this.loadedOnce && !this.data.dirty) this.load() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh()) },

  apply(d) {
    this.loadedOnce = true
    const rental = view.rentalStandard(d.rental)
    this.setData({
      loading: false, blocked: '', canEdit: !!d.canEdit, reason: d.reason || '', name: d.name || '',
      cells: view.standardCells(d.cells), rental, rentalText: rental.text, dirty: false, saving: false,
      validUntil: view.dayText(d.validUntil)
    })
  },

  load() {
    return api.getMyCardStandard().then(d => this.apply(d)).catch(err => {
      this.setData({ loading: false })
      if (err && err.code === 3) this.setData({ blocked: '你还不是教练或机构' })
      else base.fail(err)
    })
  },

  onMode(e) {
    if (!this.data.canEdit) return
    const i = Number(e.currentTarget.dataset.i)
    const mode = e.currentTarget.dataset.mode
    const cell = this.data.cells[i]
    // 管理员没开放的格子只能是「无」，别让机构白填半天
    if (mode !== 'none' && !cell.open) { wx.showToast({ title: '管理员还没有开放这一项', icon: 'none' }); return }
    const patch = { dirty: true }
    patch['cells[' + i + '].mode'] = mode
    if (mode === 'none') patch['cells[' + i + '].text'] = ''
    this.setData(patch)
  },
  onCellText(e) {
    if (!this.data.canEdit) return
    const patch = { dirty: true }
    patch['cells[' + Number(e.currentTarget.dataset.i) + '].text'] = e.detail.value
    this.setData(patch)
  },
  onRentalText(e) { if (this.data.canEdit) this.setData({ rentalText: e.detail.value, dirty: true }) },

  onSave() {
    if (!this.data.canEdit || !this.data.dirty || this.data.saving) return
    const r = view.standardPayload(this.data.cells, this.data.rentalText, this.data.rental)
    if (r.error) { wx.showToast({ title: r.error, icon: 'none', duration: 2800 }); return }
    this.setData({ saving: true })
    api.saveMyCardStandard(r.care, r.rate).then(d => { this.apply(d); base.done('已保存，之后领取的新卡按这个价格') }).catch(err => {
      this.setData({ saving: false })
      base.fail(err)
    })
  }
})

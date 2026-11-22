const app = getApp()
const data = require('../../../../utils/data.js')
const shareCover = require('./share_cover.js')

function requestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const n = Math.floor(Math.random() * 16)
    return (c === 'x' ? n : (n & 3) | 8).toString(16)
  })
}
Page({
  data: { loading: true, templates: [], selected: null, batches: [], editing: false, mode: 'multiple', count: '', busy: false, deletingBatchId: 0, qr: null, coverPath: '', coverError: false },
  onLoad() {
    if (wx.hideShareMenu) wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    return app.loginPromiseNew.then(() => {
      const staff = app.globalData.staff
      if (!staff || staff.valid !== 1 || staff.title_level < 100) { this.setData({ loading: false, blocked: '只有在职店员可以发券' }); return }
      return this.loadTemplates()
    }).catch(() => this.setData({ loading: false, blocked: '登录失败，请重新进入' }))
  },
  onReady() { this._couponCanvasReady = true; this.prepareCover() },
  onUnload() { this._couponCanvasClosed = true; this._couponCoverVersion = (this._couponCoverVersion || 0) + 1 },
  onPullDownRefresh() { return Promise.resolve(this.data.selected ? this.loadBatches() : this.loadTemplates()).finally(() => wx.stopPullDownRefresh()) },
  loadTemplates() {
    return data.staffCouponTemplatesPromise(app.globalData.sessionKey).then(d => this.setData({ templates: d.templates || [], loading: false })).catch(() => this.setData({ loading: false }))
  },
  selectTemplate(e) {
    const item = this.data.templates.find(t => t.id === Number(e.currentTarget.dataset.id))
    if (!item) return
    this._couponCoverVersion = (this._couponCoverVersion || 0) + 1
    this.setData({ selected: item, batches: [], coverPath: '', coverError: false })
    this.prepareCover()
    return this.loadBatches()
  },
  prepareCover(retry) {
    const selected = this.data.selected
    if (!this._couponCanvasReady || this._couponCanvasClosed || !selected) return
    const version = this._couponCoverVersion = (this._couponCoverVersion || 0) + 1
    this.setData({ coverPath: '', coverError: false })
    return shareCover.prepare(this, selected.name, !!retry).then(path => {
      if (!this._couponCanvasClosed && version === this._couponCoverVersion) this.setData({ coverPath: path, coverError: false })
    }, () => {
      if (!this._couponCanvasClosed && version === this._couponCoverVersion) this.setData({ coverPath: '', coverError: true })
    })
  },
  retryCover() { return this.prepareCover(true) },
  loadBatches() {
    if (!this.data.selected) return Promise.resolve()
    return data.staffCouponBatchesPromise(this.data.selected.id, app.globalData.sessionKey).then(d => this.setData({ batches: d.batches || [] }))
  },
  back() { this._couponCoverVersion = (this._couponCoverVersion || 0) + 1; this.setData({ selected: null, editing: false, batches: [], coverPath: '', coverError: false }); return this.loadTemplates() },
  newBatch() { this._requestId = requestId(); this.setData({ editing: true, mode: 'multiple', count: '' }) },
  cancelEdit() { this.setData({ editing: false }) },
  setMode(e) { this.setData({ mode: e.currentTarget.dataset.mode }) },
  setCount(e) { this.setData({ count: e.detail.value }) },
  create() {
    if (this.data.busy) return
    const n = Number(this.data.count)
    if (!/^\d+$/.test(this.data.count) || !Number.isSafeInteger(n) || n < 1 || n > 500) { wx.showToast({ title: '请输入 1～500 张', icon: 'none' }); return }
    this.setData({ busy: true })
    return data.createStaffCouponBatchPromise({ templateId: this.data.selected.id, total: n, mode: this.data.mode, requestId: this._requestId }, app.globalData.sessionKey)
      .then(() => { this.setData({ editing: false }); return this.loadBatches() }).finally(() => this.setData({ busy: false }))
  },
  showQr(e) {
    const id = Number(e.currentTarget.dataset.id)
    const env = app.globalData.env || 'release'
    const url = app.globalData.requestPrefix + 'TicketPoster/GetMiniQrCode?batchId=' + id + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '') + '&envVersion=' + encodeURIComponent(env)
    this.setData({ qr: { url } })
  },
  closeQr() { this.setData({ qr: null }) },
  noop() {},
  onShareAppMessage(e) {
    const d = (e && e.target && e.target.dataset) || {}
    if (!d.path || !d.cover || !this.data.selected || d.cover !== this.data.coverPath)
      return { title: '优惠券', path: '/pages/index/index' }
    return { title: '送你优惠券：' + (this.data.selected.name || ''), path: d.path, imageUrl: d.cover }
  },
  revoke(e) {
    const id = Number(e.currentTarget.dataset.id)
    wx.showModal({ title: '撤回批次', content: '撤回后不能再领取，已经领取的券不受影响。', success: res => {
      if (res.confirm) data.revokeStaffCouponBatchPromise(id, app.globalData.sessionKey).then(() => this.loadBatches())
    } })
  },
  deleteBatch(e) {
    const id = Number(e.currentTarget.dataset.id)
    const batch = this.data.batches.find(item => item.batchId === id)
    if (!batch || !batch.canDelete || this.data.deletingBatchId) return
    wx.showModal({ title: '删除批次', content: '删除后，该批次的分享记录将不再显示，已撤回的链接仍无法领取。', confirmText: '删除', confirmColor: '#EF4444', success: res => {
      if (!res.confirm || this.data.deletingBatchId) return
      this.setData({ deletingBatchId: id })
      data.deleteStaffCouponBatchPromise(id, app.globalData.sessionKey)
        .then(() => this.loadBatches())
        .catch(() => this.loadBatches().catch(() => {}))
        .finally(() => this.setData({ deletingBatchId: 0 }))
    } })
  }
})

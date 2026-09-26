// 用量预警：本店食材按可用量对比预警线，库存低的排在前面；店长可给每种食材改预警（也可在库存页各食材下改）
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const lowstock = require('../common/lowstock.js')

Page({
  data: { blocked: '', loading: true, isManager: false, groups: [], units: [], editShow: false, editRow: null, saving: false },

  onLoad() { base.boot(this).then(() => this.load()).catch(() => {}) },
  onShow() { if (this.loadedOnce) this.load() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    if (!this.ctx) return Promise.resolve()
    return Promise.all([
      api.get(this.ctx, 'FnbInventory/ListLowStock'),
      api.get(this.ctx, 'FnbCatalog/GetUnits')
    ]).then(([rows, unitList]) => {
      this.loadedOnce = true
      this.rows = rows || []
      const views = this.rows.map(lowstock.viewRow)
      const low = views.filter(r => r.low)
      lowstock.setBadge({ low: low.length })
      this.setData({ loading: false, units: unitList, groups: [
        { key: 'low', title: '需要补货', tone: 'warn', rows: low },
        { key: 'other', title: '其他食材', tone: '', rows: views.filter(r => !r.low) }
      ].filter(g => g.rows.length) })
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  onEdit(e) {
    if (!this.data.isManager) { wx.showToast({ title: '设置用量预警需要店长权限', icon: 'none' }); return }
    const row = this.rows.find(r => r.itemId === Number(e.currentTarget.dataset.id))
    if (row) this.setData({ editShow: true, editRow: row })
  },
  closeEdit() { this.setData({ editShow: false }) },
  onEditSubmit(e) {
    if (this.data.saving) return
    this.setData({ saving: true })
    api.post(this.ctx, 'FnbCatalog/SaveLowStockAlert', e.detail).then(() => {
      this.setData({ saving: false, editShow: false })
      wx.showToast({ title: '已保存', icon: 'success' })
      this.load()
    }).catch(err => { this.setData({ saving: false }); base.fail(err) })
  }
})

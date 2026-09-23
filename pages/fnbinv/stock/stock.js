// 食材库总览：按食材分组看批次与到期，未开封批次可直接开封
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/stock-view.js')
const expiry = require('../common/expiry.js')
const units = require('../common/units.js')
const requestId = require('../common/request-id.js')

Page({
  data: {
    loading: true, blocked: '', isManager: false,
    alertCount: 0, alertSummary: '', tree: [], subs: [], storages: expiry.STORAGE,
    filter: { l1: 0, l2: 0, storage: '', query: '' },
    items: [], skuCount: 0, batchCount: 0, openedCount: 0, expanded: 0
  },

  onLoad() {
    this.keeper = requestId.createKeeper()
    base.boot(this).then(() => this.load()).catch(() => {})
  },

  onShow() {
    if (this.loadedOnce) this.load()
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  load() {
    if (!this.ctx) return Promise.resolve()
    const ctx = this.ctx
    return Promise.all([
      api.get(ctx, 'FnbCatalog/ListCategories'),
      api.getAll(ctx, 'FnbCatalog/ListMaterials'),
      api.getAll(ctx, 'FnbInventory/ListBatches'),
      api.getAll(ctx, 'FnbReport/GetExpirySummary')
    ]).then(([categories, materials, batches, summary]) => {
      this.source = { categories, materials, rows: batches }
      this.loadedOnce = true
      const groups = expiry.groupAlerts(summary)
      getApp().globalData.fnbAlertCount = groups.total
      this.setData({
        loading: false, tree: view.categoryTree(categories), alertCount: groups.total,
        alertSummary: groups.total ? '已过期 ' + groups.expired.length + ' · 开封后临期 ' + groups.opened.length + ' · 未开封临期 ' + groups.sealed.length : '暂无临期批次'
      })
      this.render()
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  render() {
    if (!this.source) return
    const f = this.data.filter
    const result = view.buildStockRows(Object.assign({ today: this.data.today, filter: f }, this.source))
    const group = this.data.tree.find(g => g.id === f.l1)
    this.setData({ items: result.items, skuCount: result.skuCount, batchCount: result.batchCount,
      openedCount: result.openedCount, subs: group ? group.subs : [] })
  },

  setFilter(patch) {
    this.setData({ filter: Object.assign({}, this.data.filter, patch) })
    this.render()
  },
  onL1(e) { this.setFilter({ l1: Number(e.currentTarget.dataset.id), l2: 0 }) },
  onL2(e) { this.setFilter({ l2: Number(e.currentTarget.dataset.id) }) },
  onStorage(e) { this.setFilter({ storage: e.currentTarget.dataset.code }) },
  onQuery(e) { this.setFilter({ query: e.detail.value }) },
  onToggle(e) {
    const id = Number(e.currentTarget.dataset.id)
    this.setData({ expanded: this.data.expanded === id ? 0 : id })
  },
  goExpiry() { wx.navigateTo({ url: '/pages/fnbinv/expiry/expiry' }) },
  goBatch(e) { wx.navigateTo({ url: '/pages/fnbinv/batch/batch?id=' + e.currentTarget.dataset.id }) },

  onOpen(e) {
    const batchId = Number(e.currentTarget.dataset.id)
    const item = this.data.items.find(i => i.batches.some(b => b.batchId === batchId))
    const batch = item.batches.find(b => b.batchId === batchId)
    const row = this.source.rows.find(r => r.stock.batch_id === batchId)
    const packName = row.stock.pack_unit_name || '件'
    wx.showModal({
      title: '开封 1 ' + packName + item.name,
      content: '批次 ' + batch.batchNo + '，放出 ' + units.formatQty(row.stock.pack_size, item.baseUnit) + '，之后按开封后保质期计算。',
      confirmText: '开封',
      success: res => {
        if (!res.confirm) return
        const key = 'open:' + batchId
        api.post(this.ctx, 'FnbInventory/PostOpen', { requestId: this.keeper.get(key), parentBatchId: batchId, packCount: 1 })
          .then(() => {
            this.keeper.done(key)
            wx.showToast({ title: '已开封 1 ' + packName, icon: 'success' })
            this.load()
          }).catch(err => { if (!err.retryable) this.keeper.done(key); base.fail(err) })
      }
    })
  }
})

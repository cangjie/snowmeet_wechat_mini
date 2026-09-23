// 出餐扣减：员工选本店菜品手动建厨房单 → （缺配方时店长补配方后核对）→ 预览扣料 → 确认出餐（FEFO，欠料不扣负）
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const units = require('../common/units.js')
const kitchen = require('../common/kitchen.js')
const recipe = require('../common/recipe.js')
const requestId = require('../common/request-id.js')

function limit(tasks, size) {
  const results = []
  let i = 0
  const worker = () => i < tasks.length ? tasks[i++]().then(r => { results.push(r); return worker() }) : Promise.resolve()
  return Promise.all(Array.from({ length: Math.min(size, tasks.length) }, worker)).then(() => results)
}

Page({
  data: {
    blocked: '', loading: true, isManager: false, orders: [], openId: '', preview: {}, result: {},
    newShow: false, dishes: [], qty: {}, tableNo: '', remark: '', creating: false, working: ''
  },

  onLoad() {
    this.keeper = requestId.createKeeper()
    base.boot(this).then(() => this.load()).catch(() => {})
  },
  onShow() { if (this.loadedOnce) this.load() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    if (!this.ctx) return Promise.resolve()
    return Promise.all([
      api.getAll(this.ctx, 'FnbKitchen/ListOrders', { businessDate: this.data.today }),
      api.getAll(this.ctx, 'FnbCatalog/ListMaterials'),
      api.get(this.ctx, 'FnbRecipe/ListDishes')
    ]).then(([orders, materials, dishList]) => {
      this.unitOf = {}
      materials.forEach(m => { this.unitOf[m.id] = m.base_unit_code })
      this.setData({ dishes: dishList.dishes.map(d => Object.assign({ status: recipe.dishStatus(d), priceLabel: units.money(d.salePrice) }, d)) })
      // ListOrders 不带出餐标记与菜品，逐单取 GetOrder（限 4 路并发）
      return limit(orders.map(o => () => api.get(this.ctx, 'FnbKitchen/GetOrder', { orderId: o.id })), 4)
    }).then(details => {
      this.loadedOnce = true
      const orders = kitchen.sortOrders(details).map(d => ({
        id: d.order.id, displayNo: d.order.display_no, table: d.order.table_no || '', time: kitchen.localTime(d.order.ordered_at),
        remark: d.order.remark || '', status: kitchen.orderStatus(d.order, d.served), summary: kitchen.lineSummary(d.lines),
        lines: d.lines.map(l => ({ id: l.id, name: l.item_name, qty: units.trimNum(l.quantity), remark: l.remark || '' }))
      }))
      this.setData({ loading: false, orders })
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  onToggle(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ openId: this.data.openId === id ? '' : id })
  },

  // ---- 新建厨房单 ----
  openNew() {
    if (!this.data.dishes.length) { wx.showToast({ title: '还没有菜品，请店长先在「配方」里建菜品', icon: 'none' }); return }
    this.setData({ newShow: true, qty: {}, tableNo: '', remark: '' })
  },
  closeNew() { this.setData({ newShow: false }) },
  onDishQty(e) { this.setData({ ['qty.' + e.currentTarget.dataset.id]: e.detail.value }) },
  onTable(e) { this.setData({ tableNo: e.detail.value }) },
  onRemark(e) { this.setData({ remark: e.detail.value }) },
  createOrder() {
    if (this.data.creating) return
    const lines = this.data.dishes.filter(d => Number(this.data.qty[d.productId]) > 0)
      .map(d => ({ productId: d.productId, quantity: Number(this.data.qty[d.productId]), remark: null }))
    if (!lines.length) { wx.showToast({ title: '请至少选一道菜', icon: 'none' }); return }
    this.setData({ creating: true })
    api.post(this.ctx, 'FnbKitchen/CreateManualOrder', { requestId: this.keeper.get('order'), displayNo: null,
      tableNo: this.data.tableNo.trim() || null, remark: this.data.remark.trim() || null, lines })
      .then(res => {
        this.keeper.done('order')
        this.setData({ creating: false, newShow: false, openId: res.orderId })
        wx.showToast({ title: res.reviewStatus === 'verified' ? '已建单，可出餐' : '已建单，待补配方核对', icon: 'none' })
        this.load()
      }).catch(err => { this.setData({ creating: false }); if (!err.retryable) this.keeper.done('order'); base.fail(err) })
  },

  // ---- 核对 / 取消 ----
  onReview(e) {
    if (!this.data.isManager) { wx.showToast({ title: '核对需要店长权限', icon: 'none' }); return }
    const orderId = e.currentTarget.dataset.id
    api.post(this.ctx, 'FnbKitchen/ReviewOrder', { orderId }).then(() => {
      wx.showToast({ title: '已核对，可出餐', icon: 'success' })
      this.load()
    }).catch(err => {
      if (err.code === 1) wx.showModal({ title: '还不能核对', content: err.message + '。请先到「配方」里补齐并发布。', confirmText: '去配方', success: r => { if (r.confirm) wx.redirectTo({ url: '/pages/fnbinv/recipe/recipe' }) } })
      else base.fail(err)
    })
  },
  onCancel(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({ title: '取消厨房单', content: '取消后不能出餐，确认取消？', confirmText: '取消订单', confirmColor: '#EF4444', cancelText: '再想想',
      success: r => {
        if (!r.confirm) return
        api.post(this.ctx, 'FnbKitchen/CancelManualOrder', { orderId }).then(() => { wx.showToast({ title: '已取消', icon: 'success' }); this.load() }).catch(base.fail)
      } })
  },

  // ---- 出餐 ----
  onPreview(e) {
    const orderId = e.currentTarget.dataset.id
    api.get(this.ctx, 'FnbKitchen/PreviewServe', { orderId }).then(needs => {
      this.setData({ ['preview.' + orderId]: kitchen.needRows(needs, this.unitOf) })
    }).catch(base.fail)
  },
  onServe(e) {
    const orderId = e.currentTarget.dataset.id
    if (this.data.working) return
    const key = 'serve:' + orderId
    this.setData({ working: orderId })
    api.post(this.ctx, 'FnbKitchen/PostServe', { requestId: this.keeper.get(key), orderId }).then(res => {
      this.keeper.done(key)
      const rows = kitchen.needRows(res.needs, this.unitOf)
      const short = rows.filter(r => r.short).length
      this.setData({ working: '', ['result.' + orderId]: rows, ['preview.' + orderId]: null })
      wx.showToast({ title: short ? '已出餐，' + short + ' 种食材欠料' : '已出餐并扣减', icon: short ? 'none' : 'success' })
      this.load()
    }).catch(err => {
      this.setData({ working: '' })
      if (!err.retryable) this.keeper.done(key)
      if (err.code === 4 && /已出餐/.test(err.message)) { this.load(); return }
      base.fail(err)
    })
  }
})

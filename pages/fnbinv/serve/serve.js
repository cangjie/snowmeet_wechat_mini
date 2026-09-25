// 出餐扣减：员工选本店菜品建厨房单，配料表按配方 × 份数自动算、可手动改 → 建单即扣料（FEFO，欠料不扣负）；
// 扣料 10 分钟内本人或店长可编辑（退回原配料后按新配料重扣）或删除（配料退回原批次）。旧的「待核对 / 待出餐」厨房单仍可核对、预览、出餐或取消
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
    blocked: '', loading: true, isManager: false, orders: [], openId: '', preview: {},
    newShow: false, editingId: '', dishes: [], qty: {}, tableNo: '', remark: '', creating: false, working: '',
    ingredients: [], pickShow: false, pickQuery: '', pickList: []
  },

  onLoad() {
    this.keeper = requestId.createKeeper()
    this.recipes = {}
    this.removed = []
    base.boot(this).then(() => this.load()).catch(() => {})
  },
  onShow() { if (this.loadedOnce) this.load() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    if (!this.ctx) return Promise.resolve()
    return Promise.all([
      api.getAll(this.ctx, 'FnbKitchen/ListOrders', { businessDate: this.data.today }),
      api.getAll(this.ctx, 'FnbCatalog/ListMaterials'),
      api.get(this.ctx, 'FnbRecipe/ListDishes'),
      api.get(this.ctx, 'FnbCatalog/GetUnits')
    ]).then(([orders, materials, dishList, unitList]) => {
      this.src = { materials: materials.filter(m => m.valid), units: unitList }
      this.unitOf = {}
      materials.forEach(m => { this.unitOf[m.id] = m.base_unit_code })
      this.setData({ dishes: dishList.dishes.map(d => Object.assign({ status: recipe.dishStatus(d) }, d)) })
      // ListOrders 不带出餐标记与菜品，逐单取 GetOrder（限 4 路并发）
      return limit(orders.map(o => () => api.get(this.ctx, 'FnbKitchen/GetOrder', { orderId: o.id })), 4)
    }).then(details => {
      this.loadedOnce = true
      this.details = {}
      details.forEach(d => { this.details[d.order.id] = d })
      const now = Date.now()
      const orders = kitchen.sortOrders(details).map(d => ({
        id: d.order.id, displayNo: d.order.display_no, table: d.order.table_no || '', time: kitchen.localTime(d.order.ordered_at),
        remark: d.order.remark || '', status: kitchen.orderStatus(d.order, d.served), summary: kitchen.lineSummary(d.lines),
        lines: d.lines.map(l => ({ id: l.id, name: l.item_name, qty: units.trimNum(l.quantity), remark: l.remark || '' })),
        used: kitchen.needRows(d.servedNeeds, this.unitOf), usedLine: kitchen.usedSummary(d.servedNeeds, this.unitOf),
        changeUntil: d.changeSecondsLeft > 0 ? now + d.changeSecondsLeft * 1000 : 0, canChange: d.changeSecondsLeft > 0
      }))
      this.setData({ loading: false, orders })
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  onToggle(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ openId: this.data.openId === id ? '' : id })
  },

  // ---- 新建厨房单：选菜品 → 配料表（按配方自动算，可改）→ 建单即扣料 ----
  openNew() {
    if (!this.data.dishes.length) { wx.showToast({ title: '还没有菜品，请店长先在「配方」里建菜品', icon: 'none' }); return }
    this.removed = []
    this.setData({ newShow: true, editingId: '', qty: {}, tableNo: '', remark: '', ingredients: [], pickShow: false })
  },
  // 编辑已扣料厨房单：菜品按规格对回菜品、配料用这单实际确认的用量（仍在配方里的标为自动带出）
  onEditOrder(e) {
    const order = this.data.orders.find(o => o.id === e.currentTarget.dataset.id)
    if (!this.stillChangeable(order)) return
    const d = this.details[order.id]
    const qty = {}
    for (const l of d.lines) {
      const dish = this.data.dishes.find(x => x.specId === l.dish_spec_id)
      if (!dish) { wx.showToast({ title: '「' + l.item_name + '」已停用，不能编辑这张单', icon: 'none' }); return }
      qty[dish.productId] = (qty[dish.productId] || 0) + Number(l.quantity)
    }
    const materialOf = {}
    this.src.materials.forEach(m => { materialOf[m.id] = m })
    const missing = d.servedNeeds.find(n => !materialOf[n.itemId])
    if (missing) { wx.showToast({ title: '配料「' + missing.itemName + '」已停用，不能编辑这张单', icon: 'none' }); return }
    this.removed = []
    this.setData({ newShow: true, editingId: order.id, qty, tableNo: d.order.table_no || '', remark: d.order.remark || '', pickShow: false, ingredients: [] })
    return this.loadRecipes().then(() => {
      const auto = new Set(kitchen.dishNeeds(this.data.dishes, qty, this.recipes).map(c => c.itemId))
      this.setData({ ingredients: d.servedNeeds.map(n => Object.assign(recipe.editorLine(materialOf[n.itemId], n.plannedQuantity, this.src.units),
        { auto: auto.has(n.itemId), touched: true })) })
    }).catch(base.fail)
  },
  stillChangeable(order) {
    if (Date.now() < order.changeUntil) return true
    this.setData({ orders: this.data.orders.map(o => o.id === order.id ? Object.assign({}, o, { canChange: false }) : o) })
    wx.showToast({ title: '扣料已超过 10 分钟，不能修改或删除', icon: 'none' })
    return false
  },
  closeNew() { this.setData({ newShow: false }) },
  onDishQty(e) {
    this.setData({ ['qty.' + e.currentTarget.dataset.id]: e.detail.value })
    this.refreshIngredients()
  },
  // 选中菜品的已发布配方按需拉取一次
  loadRecipes() {
    const chosen = this.data.dishes.filter(d => Number(this.data.qty[d.productId]) > 0 && d.publishedRecipeId && !this.recipes[d.publishedRecipeId])
    return Promise.all(chosen.map(d => api.get(this.ctx, 'FnbRecipe/GetRecipe', { recipeId: d.publishedRecipeId })
      .then(res => { this.recipes[d.publishedRecipeId] = { output: res.recipe.output_qty, lines: res.lines } })))
  },
  // 按菜品重算配料，并与手动改动合并
  refreshIngredients() {
    return this.loadRecipes().then(() => {
      const computed = kitchen.dishNeeds(this.data.dishes, this.data.qty, this.recipes)
      this.setData({ ingredients: kitchen.mergeIngredients(this.data.ingredients, computed, this.removed, this.src.materials, this.src.units) })
    }).catch(base.fail)
  },
  setIngQty(e) {
    const i = e.currentTarget.dataset.index
    this.setData({ ['ingredients[' + i + '].qty']: e.detail.value, ['ingredients[' + i + '].touched']: true })
  },
  removeIng(e) {
    const list = this.data.ingredients.slice()
    const [gone] = list.splice(Number(e.currentTarget.dataset.index), 1)
    if (gone.auto) this.removed.push(gone.itemId)
    this.setData({ ingredients: list })
  },
  openPicker() { this.setData({ pickShow: true, pickQuery: '' }); this.filterPick('') },
  closePicker() { this.setData({ pickShow: false }) },
  onPickQuery(e) { this.setData({ pickQuery: e.detail.value }); this.filterPick(e.detail.value) },
  filterPick(q) {
    const used = new Set(this.data.ingredients.map(l => l.itemId))
    this.setData({ pickList: this.src.materials.filter(m => !used.has(m.id) && (!q || m.name.indexOf(q) >= 0)).slice(0, 60)
      .map(m => ({ id: m.id, name: m.name, unit: units.unitName(m.default_input_unit_code || m.base_unit_code), prepared: m.item_type === 'prepared' })) })
  },
  onPick(e) {
    const m = this.src.materials.find(x => x.id === Number(e.currentTarget.dataset.id))
    this.removed = this.removed.filter(id => id !== m.id)
    const line = Object.assign(recipe.editorLine(m, null, this.src.units), { auto: false, touched: true })
    this.setData({ ingredients: this.data.ingredients.concat([line]), pickShow: false })
  },
  onTable(e) { this.setData({ tableNo: e.detail.value }) },
  onRemark(e) { this.setData({ remark: e.detail.value }) },
  createOrder() {
    if (this.data.creating) return
    const lines = this.data.dishes.filter(d => Number(this.data.qty[d.productId]) > 0)
      .map(d => ({ productId: d.productId, quantity: Number(this.data.qty[d.productId]), remark: null }))
    if (!lines.length) { wx.showToast({ title: '请至少选一道菜', icon: 'none' }); return }
    const built = kitchen.ingredientBody(this.data.ingredients, this.src.units)
    if (built.error) { wx.showToast({ title: built.error, icon: 'none' }); return }
    this.setData({ creating: true })
    if (this.data.editingId) { this.saveEdit(lines, built.ingredients); return }
    api.post(this.ctx, 'FnbKitchen/CreateAndServe', { requestId: this.keeper.get('order'), tableNo: this.data.tableNo.trim() || null,
      remark: this.data.remark.trim() || null, lines, ingredients: built.ingredients })
      .then(res => {
        this.keeper.done('order')
        const short = (res.needs || []).filter(n => n.shortageQuantity > 0).length
        this.setData({ creating: false, newShow: false, openId: res.orderId })
        wx.showToast({ title: short ? '已建单扣料，' + short + ' 种欠料' : '已建单并扣料', icon: short ? 'none' : 'success' })
        this.load()
      }).catch(err => { this.setData({ creating: false }); if (!err.retryable) this.keeper.done('order'); base.fail(err) })
  },

  // 编辑保存：服务端退回原配料，换菜品、桌号、备注后按新配料重新扣料（时限仍从第一次扣料算起）
  saveEdit(lines, ingredients) {
    const orderId = this.data.editingId
    api.post(this.ctx, 'FnbKitchen/UpdateServedOrder', { orderId, tableNo: this.data.tableNo.trim() || null,
      remark: this.data.remark.trim() || null, lines, ingredients })
      .then(res => {
        const short = (res.needs || []).filter(n => n.shortageQuantity > 0).length
        this.setData({ creating: false, newShow: false, editingId: '', openId: orderId })
        wx.showToast({ title: short ? '已保存，' + short + ' 种欠料' : '已保存并重新扣料', icon: short ? 'none' : 'success' })
        this.load()
      }).catch(err => { this.setData({ creating: false }); base.fail(err) })
  },

  // ---- 删除已扣料厨房单（10 分钟内，配料退回）----
  onDeleteOrder(e) {
    const order = this.data.orders.find(o => o.id === e.currentTarget.dataset.id)
    if (!this.stillChangeable(order)) return
    wx.showModal({ title: '删除厨房单', content: '删除「' + order.summary + '」，扣掉的配料将退回库存。', confirmText: '删除', confirmColor: '#EF4444',
      success: r => {
        if (!r.confirm) return
        api.post(this.ctx, 'FnbKitchen/DeleteServedOrder', { orderId: order.id })
          .then(() => { wx.showToast({ title: '已删除，配料已退回', icon: 'none' }); this.load() })
          .catch(err => { base.fail(err); this.load() })
      } })
  },

  // ---- 旧厨房单：核对 / 取消 / 预览 / 出餐 ----
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
      const short = kitchen.needRows(res.needs, this.unitOf).filter(r => r.short).length
      this.setData({ working: '', ['preview.' + orderId]: null })
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

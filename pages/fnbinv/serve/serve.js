// 出餐扣减：一张厨房单一道菜（将来由外部订单自动导入，手动输入是少数情况）。菜名文本框输入、按菜品库自动提示，
// 建单即按该菜已发布配方 × 份数扣料，用量可在单上微调（FEFO，欠料不扣负）；扣料 10 分钟内本人或店长可编辑（退回原配料后按新菜品重扣）
// 或删除（配料退回原批次）。建单前逐项提示库存够不够，缺的是整包没开封时可直接开封；库存不够仍可建单，欠的记为欠料，
// 之后补录入库或开封，在单上「补扣欠料」（不受 10 分钟限制）。旧的「待核对 / 待出餐」厨房单仍可核对、预览、出餐或取消
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
    blocked: '', loading: true, isManager: false, filter: 'today', orders: [], openId: '', preview: {},
    newShow: false, editingId: '', dishes: [], dishQuery: '', dishHints: [], dish: null, portions: 1, deduct: [],
    tableNo: '', remark: '', creating: false, working: ''
  },

  onLoad() {
    this.keeper = requestId.createKeeper()
    this.recipes = {}
    this.stockOf = {}
    this.servedQty = {}
    base.boot(this).then(() => this.load()).catch(() => {})
  },
  onShow() { if (this.loadedOnce) this.load() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    if (!this.ctx) return Promise.resolve()
    const token = this.loadToken = (this.loadToken || 0) + 1
    // 「有欠料」看近 7 天还没补的单，前几天的也能找回来补扣
    const list = this.data.filter === 'short'
      ? api.get(this.ctx, 'FnbKitchen/ListShortageOrders', { days: 7 })
      : api.getAll(this.ctx, 'FnbKitchen/ListOrders', { businessDate: this.data.today })
    return Promise.all([
      list,
      api.getAll(this.ctx, 'FnbCatalog/ListMaterials'),
      api.get(this.ctx, 'FnbRecipe/ListDishes'),
      api.get(this.ctx, 'FnbCatalog/GetUnits')
    ]).then(([orders, materials, dishList, unitList]) => {
      this.units = unitList
      this.materialOf = {}
      this.unitOf = {}
      materials.forEach(m => { this.materialOf[m.id] = m; this.unitOf[m.id] = m.base_unit_code })
      this.setData({ dishes: dishList.dishes.map(d => Object.assign({ status: recipe.dishStatus(d) }, d)) })
      // ListOrders 不带出餐标记与菜品，逐单取 GetOrder（限 4 路并发）
      return limit(orders.map(o => () => api.get(this.ctx, 'FnbKitchen/GetOrder', { orderId: o.id })), 4)
    }).then(details => {
      if (token !== this.loadToken) return
      this.loadedOnce = true
      this.details = {}
      details.forEach(d => { this.details[d.order.id] = d })
      const now = Date.now()
      const orders = kitchen.sortOrders(details).map(d => ({
        id: d.order.id, displayNo: d.order.display_no, table: d.order.table_no || '', time: kitchen.localTime(d.order.ordered_at),
        date: String(d.order.business_date || '').slice(5, 10), canFill: kitchen.openShortage(d.servedNeeds).length > 0,
        remark: d.order.remark || '', status: kitchen.orderStatus(d.order, d.served), summary: kitchen.lineSummary(d.lines),
        lines: d.lines.map(l => ({ id: l.id, name: l.item_name, qty: units.trimNum(l.quantity), remark: l.remark || '' })),
        used: kitchen.needRows(d.servedNeeds, this.unitOf), usedLine: kitchen.usedSummary(d.servedNeeds, this.unitOf),
        changeUntil: d.changeSecondsLeft > 0 ? now + d.changeSecondsLeft * 1000 : 0, canChange: d.changeSecondsLeft > 0
      }))
      this.setData({ loading: false, orders })
    }).catch(err => { if (token === this.loadToken) this.setData({ loading: false }); base.fail(err) })
  },

  onFilter(e) {
    const filter = e.currentTarget.dataset.filter
    if (filter === this.data.filter) return
    this.setData({ filter, openId: '', loading: true, orders: [] })
    this.load()
  },

  onToggle(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ openId: this.data.openId === id ? '' : id })
  },

  // ---- 新建 / 编辑厨房单：一道菜 + 份数，按配方扣料 ----
  openNew() {
    if (!this.data.dishes.length) { wx.showToast({ title: '还没有菜品，请店长先在「配方」里建菜品', icon: 'none' }); return }
    this.stockOf = {}
    this.servedQty = {}
    this.setData({ newShow: true, editingId: '', dishQuery: '', dishHints: [], dish: null, portions: 1, deduct: [], tableNo: '', remark: '' })
  },
  closeNew() { this.setData({ newShow: false }) },
  // 菜名输入：与菜品库同名时直接选中，否则按包含关系提示
  onDishInput(e) {
    const q = e.detail.value
    const same = this.data.dishes.find(d => d.name === q.trim())
    if (same) { this.pickDish(same, q); return }
    const hints = q.trim() ? this.data.dishes.filter(d => d.name.indexOf(q.trim()) >= 0).slice(0, 8) : []
    this.setData({ dishQuery: q, dish: null, dishHints: hints, deduct: [] })
  },
  onDishHint(e) { this.pickDish(this.data.dishes.find(d => d.productId === Number(e.currentTarget.dataset.id))) },
  pickDish(dish, query) {
    this.setData({ dish, dishQuery: query === undefined ? dish.name : query, dishHints: [], deduct: [] })
    this.refreshDeduct()
  },
  onPortions(e) { this.setData({ portions: e.detail.value }); this.refreshDeduct() },
  // 按所选菜品的已发布配方 × 份数带出将扣减的用料；微调过的保留（以服务端过账为准）
  refreshDeduct() {
    const dish = this.data.dish
    if (!dish || !dish.publishedRecipeId) { this.setData({ deduct: [] }); return Promise.resolve() }
    const cached = this.recipes[dish.publishedRecipeId]
    const loaded = cached ? Promise.resolve(cached) : api.get(this.ctx, 'FnbRecipe/GetRecipe', { recipeId: dish.publishedRecipeId })
      .then(res => { this.recipes[dish.publishedRecipeId] = { output: res.recipe.output_qty, lines: res.lines }; return this.recipes[dish.publishedRecipeId] })
    return loaded.then(r => {
      if (this.data.dish !== dish) return
      const lines = kitchen.deductLines(kitchen.portionNeeds(r, this.data.portions), this.data.deduct, this.materialOf, this.units)
      this.setData({ deduct: kitchen.withStock(lines, this.stockOf, this.units, this.servedQty) })
      return this.loadStock(lines.map(l => l.itemId)).then(() => {
        if (this.data.dish === dish) this.setData({ deduct: kitchen.withStock(this.data.deduct, this.stockOf, this.units, this.servedQty) })
      })
    }).catch(base.fail)
  },
  // 配料库存只是提示：查不到（网络或旧版服务端）就不显示，不影响建单
  loadStock(itemIds, force) {
    const ids = force ? itemIds : itemIds.filter(id => !this.stockOf[id])
    if (!ids.length) return Promise.resolve()
    return api.get(this.ctx, 'FnbKitchen/GetDeductStock', { itemIds: ids.join(',') })
      .then(rows => { (rows || []).forEach(r => { this.stockOf[r.itemId] = r }) })
      .catch(() => {})
  },
  setDeductQty(e) {
    const i = e.currentTarget.dataset.index
    const lines = this.data.deduct.slice()
    lines[i] = Object.assign({}, lines[i], { qty: e.detail.value, touched: true })
    this.setData({ deduct: kitchen.withStock(lines, this.stockOf, this.units, this.servedQty) })
  },
  // 缺的是整包没开封：直接开封最早到期的那一件，再刷新库存提示
  onOpenPack(e) {
    const line = this.data.deduct[e.currentTarget.dataset.index]
    const s = line && this.stockOf[line.itemId]
    if (!s || !s.openBatchId) return
    const packName = s.packUnitName || '件'
    wx.showModal({
      title: '开封 1 ' + packName + line.name,
      content: '批次 ' + (s.openBatchNo || '') + '，放出 ' + units.formatQty(s.openPackSize, line.baseUnit) + '，之后按开封后保质期计算。',
      confirmText: '开封',
      success: r => {
        if (!r.confirm) return
        const key = 'open:' + s.openBatchId
        api.post(this.ctx, 'FnbInventory/PostOpen', { requestId: this.keeper.get(key), parentBatchId: s.openBatchId, packCount: 1 })
          .then(() => {
            this.keeper.done(key)
            wx.showToast({ title: '已开封 1 ' + packName, icon: 'success' })
            return this.loadStock(this.data.deduct.map(l => l.itemId), true)
          })
          .then(() => this.setData({ deduct: kitchen.withStock(this.data.deduct, this.stockOf, this.units, this.servedQty) }))
          .catch(err => { if (!err.retryable) this.keeper.done(key); base.fail(err) })
      }
    })
  },
  onTable(e) { this.setData({ tableNo: e.detail.value }) },
  onRemark(e) { this.setData({ remark: e.detail.value }) },
  createOrder() {
    const d = this.data
    if (d.creating) return
    if (!d.dish) { wx.showToast({ title: d.dishQuery.trim() ? '请从提示里选择菜品库中的菜' : '请输入菜名', icon: 'none' }); return }
    if (!d.dish.publishedRecipeId) { wx.showToast({ title: '「' + d.dish.name + '」还没有已发布的配方', icon: 'none' }); return }
    const portions = Number(d.portions)
    if (!(portions > 0)) { wx.showToast({ title: '份数要大于 0', icon: 'none' }); return }
    const tuned = kitchen.adjustments(d.deduct, this.units)
    if (tuned.error) { wx.showToast({ title: tuned.error, icon: 'none' }); return }
    const body = { tableNo: d.tableNo.trim() || null, remark: d.remark.trim() || null,
      lines: [{ productId: d.dish.productId, quantity: portions, remark: null }], ingredients: tuned.ingredients.length ? tuned.ingredients : null }
    // 库存不够也能建单（菜已经做出来了），欠的部分记为欠料；先让人确认一下
    const short = kitchen.shortageText(d.deduct)
    if (!short) { this.submitOrder(body); return }
    wx.showModal({
      title: '库存不够',
      content: short + '。仍然建单的话，欠的部分记为欠料，补录入库或开封后可在单上「补扣欠料」。',
      confirmText: '仍然建单', cancelText: '先去处理',
      success: r => { if (r.confirm) this.submitOrder(body) }
    })
  },
  submitOrder(body) {
    const d = this.data
    if (d.creating) return
    this.setData({ creating: true })
    const editing = d.editingId
    const call = editing
      ? api.post(this.ctx, 'FnbKitchen/UpdateServedOrder', Object.assign({ orderId: editing }, body))
      : api.post(this.ctx, 'FnbKitchen/CreateAndServe', Object.assign({ requestId: this.keeper.get('order') }, body))
    call.then(res => {
      if (!editing) this.keeper.done('order')
      const short = (res.needs || []).filter(n => n.shortageQuantity > 0).length
      this.setData({ creating: false, newShow: false, editingId: '', openId: res.orderId })
      const done = editing ? '已保存并重新扣料' : '已建单并扣料'
      wx.showToast({ title: short ? done + '，' + short + ' 种欠料' : done, icon: short ? 'none' : 'success' })
      this.load()
    }).catch(err => {
      this.setData({ creating: false })
      if (!editing && !err.retryable) this.keeper.done('order')
      base.fail(err)
    })
  },

  // ---- 扣料 10 分钟内：编辑（换菜、份数、桌号、备注）/ 删除（配料退回）----
  stillChangeable(order) {
    if (Date.now() < order.changeUntil) return true
    this.setData({ orders: this.data.orders.map(o => o.id === order.id ? Object.assign({}, o, { canChange: false }) : o) })
    wx.showToast({ title: '扣料已超过 10 分钟，不能修改或删除', icon: 'none' })
    return false
  },
  onEditOrder(e) {
    const order = this.data.orders.find(o => o.id === e.currentTarget.dataset.id)
    if (!this.stillChangeable(order)) return
    const d = this.details[order.id]
    const line = d.lines[0]
    const dish = line && this.data.dishes.find(x => x.specId === line.dish_spec_id)
    if (!dish) { wx.showToast({ title: '「' + (line ? line.item_name : '') + '」已停用，不能编辑这张单', icon: 'none' }); return }
    // 保存时先退回这单已扣的配料，算可用量时加回
    this.stockOf = {}
    this.servedQty = {}
    d.servedNeeds.forEach(n => { this.servedQty[n.itemId] = n.actualQuantity })
    this.setData({ newShow: true, editingId: order.id, dish, dishQuery: dish.name, dishHints: [], portions: Number(line.quantity),
      deduct: [], tableNo: d.order.table_no || '', remark: d.order.remark || '' })
    // 这单当时实际确认的用量与配方 × 份数不同的，按微调过带出（没扣的记 0）
    const served = {}
    d.servedNeeds.forEach(n => { served[n.itemId] = n.plannedQuantity })
    return this.refreshDeduct().then(() => this.setData({ deduct: kitchen.withStock(this.data.deduct.map(l => {
      const planned = served[l.itemId] === undefined ? 0 : served[l.itemId]
      if (Math.abs(planned - l.recipeQty) < 1e-6) return l
      return Object.assign({}, l, { qty: recipe.editorLine(this.materialOf[l.itemId] || { base_unit_code: '' }, planned, this.units).qty, touched: true })
    }), this.stockOf, this.units, this.servedQty) }))
  },

  // ---- 补扣欠料：补录入库或开封后按现在的库存再扣一次，不受 10 分钟限制 ----
  onFillShortage(e) {
    const order = this.data.orders.find(o => o.id === e.currentTarget.dataset.id)
    const d = order && this.details[order.id]
    if (!d || this.data.working) return
    const list = kitchen.openShortage(d.servedNeeds)
      .map(n => n.itemName + ' 欠 ' + units.formatQty(n.shortageQuantity, this.unitOf[n.itemId])).join('；')
    wx.showModal({
      title: '补扣欠料',
      content: '按现在的库存补扣这单欠的配料：' + list + '。还不够的继续记欠料。',
      confirmText: '补扣',
      success: r => {
        if (!r.confirm || this.data.working) return
        this.setData({ working: order.id })
        api.post(this.ctx, 'FnbKitchen/FillShortage', { orderId: order.id }).then(res => {
          const left = kitchen.openShortage(res.needs).length
          this.setData({ working: '' })
          wx.showToast({ title: left ? '已补扣，还欠 ' + left + ' 种' : '欠料已补扣完', icon: left ? 'none' : 'success' })
          this.load()
        }).catch(err => { this.setData({ working: '' }); base.fail(err); this.load() })
      }
    })
  },
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

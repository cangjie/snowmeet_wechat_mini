// 页面级冒烟：假后端 + 假 wx，逐页 onLoad，并走通入库提交、建厨房单、开始盘点、开封这几条关键交互
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const api = require('../pages/fnbinv/common/api.js')

const TODAY_BATCH = { id: 100, name: '大白菜', batch_no: 'B1', expire_date: '2099-09-30T00:00:00', warn_days: 1, create_date: '2026-09-23T10:00:00', image_ids: '5' }
const RESPONSES = {
  'FnbCatalog/ListCategories': [
    { id: 1, level: 1, parent_id: null, name: '生鲜', valid: true, sort: 1 },
    { id: 2, level: 2, parent_id: 1, name: '蔬菜类', default_storage: 'chilled', valid: true, sort: 1 },
    { id: 3, level: 2, parent_id: 1, name: '菌菇类', default_storage: 'chilled', valid: true, sort: 2 },
    { id: 4, level: 1, parent_id: null, name: '干货', valid: true, sort: 2 },
    { id: 5, level: 2, parent_id: 4, name: '豆类', default_storage: 'ambient', valid: true, sort: 1 }],
  'FnbCatalog/ListMaterials': { total: 3, rows: [
    { id: 10, code: 'VEG1', name: '大白菜', category_id: 2, item_type: 'raw', base_unit_code: 'g', default_input_unit_code: 'kg', warn_days: 1, valid: true },
    { id: 11, code: 'DGH1', name: '面团', category_id: 2, item_type: 'prepared', base_unit_code: 'piece', default_input_unit_code: 'piece', warn_days: 2, valid: true },
    { id: 12, code: 'SAU1', name: '番茄酱', category_id: 2, item_type: 'raw', base_unit_code: 'ml', default_input_unit_code: 'ml', warn_days: 30,
      default_open_storage: 'chilled', default_open_days: 7, valid: true }] },
  'FnbCatalog/GetUnits': [{ code: 'g', name: '克', dimension: 1, factor_to_base: 1, valid: true }, { code: 'kg', name: '千克', dimension: 1, factor_to_base: 1000, valid: true },
    { code: 'ml', name: '毫升', dimension: 2, factor_to_base: 1, valid: true }, { code: 'piece', name: '个', dimension: 3, factor_to_base: 1, valid: true }],
  'FnbCatalog/ListShelfLifeRules': [],
  'FnbCatalog/GetMaterial': { id: 10, name: '大白菜', base_unit_code: 'g', default_input_unit_code: 'kg' },
  'FnbInventory/ListBatches': { total: 2, rows: [
    { batch: TODAY_BATCH, stock: { batch_id: 100, item_id: 10, stock_form: 'bulk', storage_type: 'chilled', quantity: 5000, is_destroyed: false } },
    { batch: { id: 101, name: '番茄酱', batch_no: 'B2', expire_date: '2099-03-01T00:00:00', warn_days: 30 },
      stock: { batch_id: 101, item_id: 12, stock_form: 'sealed', storage_type: 'chilled', quantity: 2000, pack_size: 1000, pack_unit_name: '瓶', sealed_pack_count: 2, is_destroyed: false } }] },
  'FnbInventory/GetBatch': { batch: TODAY_BATCH, stock: { batch_id: 100, item_id: 10, stock_form: 'bulk', storage_type: 'chilled', quantity: 5000, stock_amount: 20, expiry_source: 'category', is_destroyed: false } },
  'FnbInventory/GetStock': [{ item_id: 10, itemName: '大白菜', base_unit_code: 'g', totalQty: 5000, availableQty: 5000, sealedQty: 0 }],
  'FnbInventory/ListLowStock': [
    { itemId: 10, itemName: '大白菜', categoryId: 2, baseUnitCode: 'g', defaultInputUnitCode: 'kg', availableQuantity: 400, lastBatchQuantity: 5000, ratio: null, fixedQuantity: null, threshold: 500, low: true },
    { itemId: 12, itemName: '番茄酱', categoryId: 2, baseUnitCode: 'ml', defaultInputUnitCode: 'ml', availableQuantity: 2000, lastBatchQuantity: 3000, ratio: 0.2, fixedQuantity: null, threshold: 600, low: false }],
  'FnbCatalog/SaveLowStockAlert': { id: 10, low_stock_ratio: null, low_stock_qty: 300 },
  'FnbReport/GetExpirySummary': { total: 1, rows: [{ batch_id: 100, item_id: 10, itemName: '大白菜', base_unit_code: 'g', batch_no: 'B1', expire_date: '2020-01-01T00:00:00', quantity: 5000, stock_form: 'bulk', status: '已过期' }] },
  'FnbReport/GetOverview': { total: 1, rows: [{ item_id: 10, category_id: 2, total_qty: 5000, total_amount: 20 }] },
  'FnbReport/GetLossLedger': { total: 1, rows: [{ movementId: '1', item_name: '大白菜', reason_code: 'damage', batch_no: 'B1', base_unit_code: 'g', delta_qty: -100, delta_amount: -0.4, business_date: '2026-09-23T00:00:00', posted_at: '2026-09-23T02:00:00' }] },
  'FnbMaterial/GenBatchNo': { batchNo: 'B260923-01' },
  'FnbMaterial/GetImages': [{ id: 5, file_path_name: '/a.jpg' }],
  'FnbRecipe/ListDishes': { dishes: [{ productId: 7, name: '酸菜白肉锅', salePrice: 68, categoryId: 30, categoryName: '热菜', specId: 3, specName: '标准份', publishedRecipeId: '9', publishedVersion: 1, draftRecipeId: null }], categories: [{ id: 30, name: '热菜' }] },
  'FnbRecipe/ListRecipes': [{ id: '20', recipe_type: 'prep', output_item_id: 11, output_qty: 10, status: 'published', version_no: 1 }],
  'FnbRecipe/GetRecipe': { recipe: { id: '20', output_qty: 10, row_version: 'AAA=' }, lines: [{ item_id: 10, quantity: 1000, sort: 1 }] },
  'FnbKitchen/ListOrders': { total: 1, rows: [{ id: '5' }] },
  'FnbKitchen/GetOrder': { order: { id: '5', display_no: 'M0923', ordered_at: '2026-09-23T03:42:00', order_status: 'pending', review_status: 'verified', table_no: 'A3', remark: '少盐' },
    lines: [{ id: '1', item_name: '酸菜白肉锅', quantity: 2, remark: null, dish_spec_id: 3 }], served: false, servedNeeds: [], changeSecondsLeft: null },
  'FnbKitchen/CreateManualOrder': { orderId: '6', displayNo: 'M1', reviewStatus: 'verified', lineCount: 1, replayed: false },
  'FnbKitchen/CreateAndServe': { orderId: '6', displayNo: 'M1', documentId: '12', replayed: false, needs: [{ itemId: 10, itemName: '大白菜', plannedQuantity: 200, actualQuantity: 200, shortageQuantity: 0 }] },
  'FnbKitchen/DeleteServedOrder': { orderId: '5' },
  'FnbKitchen/UpdateServedOrder': { orderId: '5', displayNo: 'M0923', documentId: '12', needs: [] },
  'FnbStocktake/CreateSnapshot': { documentId: '77' },
  'FnbStocktake/GetSnapshot': { documentId: '77', status: 'draft', rows: [{ item_id: 10, system_qty: 5000, counted_qty: null, rowVersion: 'v1' }] },
  'FnbInventory/PostReceipt': { documentId: '11', batchId: 104, quantity: 3000, amount: null, replayed: false },
  'FnbInventory/PostOpen': { documentId: '8', batchId: 102, quantity: 1000, amount: null, replayed: false },
  'FnbInventory/PostWaste': { documentId: '9', batchId: 100, quantity: 5000, amount: 20, replayed: false },
  'FnbInventory/PostPreparation': { documentId: '10', batchId: 103, quantity: 20, amount: null, replayed: false },
  'FnbRecipe/SaveRecipeDraft': { id: '21', version_no: 2, rowVersion: 'RV21' },
  'FnbRecipe/PublishRecipe': { id: '21', version_no: 2 },
  'FnbRecipe/SaveDish': { productId: 8, name: '榛果饮', salePrice: 0, categoryId: 31, categoryName: '未分类', specId: 4, specName: '标准份' },
  'FnbCatalog/SaveCategory': { id: 2 },
  'FnbCatalog/SaveMaterial': { id: 10, code: 'VEG1', name: '大白菜', category_id: 2, item_type: 'raw', base_unit_code: 'g', default_input_unit_code: 'kg', warn_days: 1, valid: true },
  'FnbCatalog/DeleteCategory': { ids: [3] },
  'FnbInventory/DeleteReceipt': { batchId: 104 },
  'FnbCatalog/SaveShelfLifeRule': { id: 1 }
}

let calls = []
function installFakes(staff) {
  calls = []
  const storage = {}
  api.setTransport(function (options) {
    const p = options.url.replace('https://x/api/', '').split('?')[0]
    calls.push({ path: p, method: options.method, data: options.data, url: options.url })
    const data = RESPONSES[p]
    setImmediate(() => data === undefined
      ? options.success({ statusCode: 200, data: { code: 1, message: '未模拟 ' + p } })
      : options.success({ statusCode: 200, data: { code: 0, message: '', data: JSON.parse(JSON.stringify(data)) } }))
  })
  global.wx = {
    showToast() {}, setNavigationBarTitle() {}, stopPullDownRefresh() {}, redirectTo() {}, navigateTo() {}, navigateBack() {}, previewImage() {},
    showModal(o) { setImmediate(() => o.success && o.success({ confirm: true, content: o.content })) },
    showActionSheet(o) { setImmediate(() => o.success && o.success({ tapIndex: 0 })) },
    getStorageSync(k) { return storage[k] }, setStorageSync(k, v) { storage[k] = v }, removeStorageSync(k) { delete storage[k] }
  }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { staff, sessionKey: 'k', requestPrefix: 'https://x/api/' } })
}

function loadPage(name) {
  const file = path.join(__dirname, '../pages/fnbinv', name, name + '.js')
  delete require.cache[require.resolve(file)]
  let def = null
  global.Page = d => { def = d }
  require(file)
  delete global.Page
  const page = Object.assign({}, def, { data: JSON.parse(JSON.stringify(def.data)) })
  page.setData = function (patch) {
    Object.keys(patch).forEach(key => {
      const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.')
      let o = this.data
      parts.slice(0, -1).forEach(k => { if (o[k] === undefined || o[k] === null) o[k] = {}; o = o[k] })
      o[parts[parts.length - 1]] = patch[key]
    })
  }
  Object.keys(def).filter(k => typeof def[k] === 'function').forEach(k => { page[k] = def[k].bind(page) })
  return page
}

const settle = () => new Promise(r => setTimeout(r, 30))
const receipts = () => calls.filter(c => c.path === 'FnbInventory/PostReceipt').map(c => c.data)
const MANAGER = { id: 1, title_level: 200, base_shop_id: 12 }

for (const name of ['stock', 'expiry', 'lowstock', 'destroy', 'batch', 'inbound', 'cats', 'prep', 'recipe', 'serve', 'count', 'dash']) {
  test('页面 ' + name + '：店长打开无报错且不阻塞', async () => {
    installFakes(MANAGER)
    const page = loadPage(name)
    page.onLoad({ id: '100' })
    await settle()
    assert.equal(page.data.blocked, '', name + ' blocked: ' + page.data.blocked)
    assert.ok(calls.length > 0, name + ' 没有发请求')
    assert.ok(calls.every(c => RESPONSES[c.path] !== undefined), '未模拟的接口：' + calls.filter(c => RESPONSES[c.path] === undefined).map(c => c.path))
    assert.ok(calls.every(c => /sessionKey=k/.test(c.url)), 'sessionKey 缺失')
  })
}

test('未绑定门店的员工整页提示原因', async () => {
  installFakes({ id: 2, title_level: 100, base_shop_id: null })
  const page = loadPage('stock')
  page.onLoad({})
  await settle()
  assert.match(page.data.blocked, /门店/)
})

test('库存页：按食材分组、临期角标、开封发 PostOpen', async () => {
  installFakes(MANAGER)
  const page = loadPage('stock')
  page.onLoad({})
  await settle()
  assert.deepEqual(page.data.items.map(i => i.name), ['大白菜', '番茄酱'])
  assert.equal(page.data.alertCount, 1)
  page.onOpen({ currentTarget: { dataset: { id: 101 } } })
  await settle()
  const open = calls.find(c => c.path === 'FnbInventory/PostOpen')
  assert.deepEqual({ shopId: open.data.shopId, parentBatchId: open.data.parentBatchId, packCount: open.data.packCount }, { shopId: 12, parentBatchId: 101, packCount: 1 })
  assert.match(open.data.requestId, /^[0-9a-f-]{36}$/)
})

test('库存页：用量预警卡和临期卡并排，库存低的食材带标签，角标算上用量预警', async () => {
  installFakes(MANAGER)
  const page = loadPage('stock')
  page.onLoad({})
  await settle()
  assert.deepEqual([page.data.lowKnown, page.data.lowCount, page.data.lowSummary, page.data.badge], [true, 1, '大白菜快用完了', 2])
  assert.deepEqual(page.data.items.map(i => [i.name, i.low]), [['大白菜', true], ['番茄酱', false]])
})

test('库存页：旧版服务端没有用量预警接口时不显示这张卡，其余照常', async () => {
  installFakes(MANAGER)
  const saved = RESPONSES['FnbInventory/ListLowStock']
  delete RESPONSES['FnbInventory/ListLowStock']
  try {
    const page = loadPage('stock')
    page.onLoad({})
    await settle()
    assert.deepEqual([page.data.lowKnown, page.data.alertCount, page.data.items.length], [false, 1, 2])
  } finally {
    RESPONSES['FnbInventory/ListLowStock'] = saved
  }
})

test('用量预警页：库存低的排前面；店长按数量设置预警，按常用单位换成基本单位保存', async () => {
  installFakes(MANAGER)
  const page = loadPage('lowstock')
  page.onLoad({})
  await settle()
  assert.deepEqual(page.data.groups.map(g => [g.title, g.rows.map(r => r.name)]), [['需要补货', ['大白菜']], ['其他食材', ['番茄酱']]])
  const cabbage = page.data.groups[0].rows[0]
  assert.deepEqual([cabbage.tag.text, cabbage.availLabel, cabbage.lineLabel, cabbage.ruleLabel], ['库存低', '可用 400 g', '预警线 500 g', '最近一批的 10%（默认）'])
  page.onEdit({ currentTarget: { dataset: { id: 10 } } })
  assert.deepEqual([page.data.edit.mode, page.data.edit.ratioText, page.data.edit.unitLabel], ['ratio', '10', 'kg'])
  page.setMode({ currentTarget: { dataset: { mode: 'qty' } } })
  page.setQty({ detail: { value: '0.3' } })
  page.onSave()
  await settle()
  assert.deepEqual(calls.find(c => c.path === 'FnbCatalog/SaveLowStockAlert').data, { shopId: 12, itemId: 10, ratio: null, quantity: 300 })
  assert.equal(page.data.editShow, false)
})

test('入库页：选食材、拍照、填到期日后提交即入库，出现在本次已入库', async () => {
  installFakes(MANAGER)
  const page = loadPage('inbound')
  page.onLoad({})
  await settle()
  page.onHint({ currentTarget: { dataset: { id: 10 } } })
  page.onPhotos({ detail: { photos: [{ id: 5, url: 'u', status: 'done' }], uploading: 0 } })
  page.onExpireDate({ detail: { date: '2099-10-01' } })
  page.onQty({ detail: { value: 3 } })
  page.submit()
  await settle()
  assert.equal(receipts().length, 1)
  const body = receipts()[0]
  assert.deepEqual({ itemId: body.itemId, quantity: body.quantity, inputUnitCode: body.inputUnitCode, expirySource: body.expirySource, imageIds: body.imageIds },
    { itemId: 10, quantity: 3, inputUnitCode: 'kg', expirySource: 'package', imageIds: [5] })
  assert.deepEqual({ batchId: page.data.done[0].batchId, name: page.data.done[0].name }, { batchId: 104, name: '大白菜' })
  assert.equal(page.data.material, null, '入库成功后表单清空')
})

test('出餐页：一单一道菜，菜名输入按菜品库提示，预览配方扣减，建单即扣料发 CreateAndServe', async () => {
  installFakes(MANAGER)
  const page = loadPage('serve')
  page.onLoad({})
  await settle()
  assert.equal(page.data.orders[0].status.text, '待出餐')
  assert.equal(page.data.orders[0].time, '11:42')
  page.openNew()
  page.onDishInput({ detail: { value: '酸菜' } })
  assert.deepEqual({ dish: page.data.dish, hints: page.data.dishHints.map(d => d.productId) }, { dish: null, hints: [7] })
  page.onDishInput({ detail: { value: '不存在的菜' } })
  page.createOrder()
  await settle()
  assert.equal(calls.filter(c => c.path === 'FnbKitchen/CreateAndServe').length, 0, '没选中菜品库里的菜不建单')
  page.onDishInput({ detail: { value: '酸菜白肉锅' } })
  await settle()
  assert.equal(page.data.dish.productId, 7, '输入完整菜名直接选中')
  // 假后端配方：每 10 份用大白菜 1000 g → 1 份 100 g，按常用单位 kg 显示
  assert.deepEqual(page.data.deduct.map(d => [d.name, d.qty, d.unitCode, d.touched]), [['大白菜', '100', 'g', false]])
  page.onPortions({ detail: { value: 2 } })
  await settle()
  assert.deepEqual(page.data.deduct.map(d => d.qty), ['200'])
  // 微调用量后再改份数：改过的保留，并注明配方原用量
  page.setDeductQty({ currentTarget: { dataset: { index: 0 } }, detail: { value: '150' } })
  page.onPortions({ detail: { value: 3 } })
  await settle()
  assert.deepEqual(page.data.deduct.map(d => [d.qty, d.touched, d.recipeLabel]), [['150', true, '300 g']])
  page.onTable({ detail: { value: 'A3' } })
  page.createOrder()
  await settle()
  const created = calls.find(c => c.path === 'FnbKitchen/CreateAndServe').data
  assert.deepEqual({ tableNo: created.tableNo, remark: created.remark, lines: created.lines, ingredients: created.ingredients },
    { tableNo: 'A3', remark: null, lines: [{ productId: 7, quantity: 3, remark: null }], ingredients: [{ itemId: 10, quantity: 150 }] })
  assert.ok(created.requestId)
  assert.equal(page.data.newShow, false)
})

test('出餐页：选中的菜还没有已发布配方时提示且不建单', async () => {
  installFakes(MANAGER)
  const saved = RESPONSES['FnbRecipe/ListDishes']
  RESPONSES['FnbRecipe/ListDishes'] = { dishes: [Object.assign({}, saved.dishes[0], { publishedRecipeId: null, publishedVersion: null })], categories: [] }
  try {
    const page = loadPage('serve')
    page.onLoad({})
    await settle()
    page.openNew()
    page.onDishInput({ detail: { value: '酸菜白肉锅' } })
    await settle()
    assert.deepEqual(page.data.deduct, [])
    page.createOrder()
    await settle()
    assert.equal(calls.filter(c => c.path === 'FnbKitchen/CreateAndServe').length, 0)
  } finally {
    RESPONSES['FnbRecipe/ListDishes'] = saved
  }
})

test('出餐页：扣料 10 分钟内的厨房单显示已扣配料，可删除并退回配料', async () => {
  installFakes(MANAGER)
  const saved = RESPONSES['FnbKitchen/GetOrder']
  RESPONSES['FnbKitchen/GetOrder'] = Object.assign({}, saved, { served: true, changeSecondsLeft: 300,
    servedNeeds: [{ itemId: 10, itemName: '大白菜', plannedQuantity: 300, actualQuantity: 200, shortageQuantity: 100 }] })
  try {
    const page = loadPage('serve')
    page.onLoad({})
    await settle()
    const order = page.data.orders[0]
    assert.equal(order.status.text, '已出餐')
    assert.deepEqual({ canChange: order.canChange, used: order.used.map(u => [u.planned, u.actual, u.shortLabel]) },
      { canChange: true, used: [['300 g', '200 g', '欠 100 g']] })
    assert.equal(order.usedLine, '大白菜 200 g（欠 100 g）', '列表卡片直接列出耗用')
    page.onDeleteOrder({ currentTarget: { dataset: { id: '5' } } })
    await settle()
    assert.deepEqual(calls.filter(c => c.path === 'FnbKitchen/DeleteServedOrder').map(c => c.data), [{ shopId: 12, orderId: '5' }])
  } finally {
    RESPONSES['FnbKitchen/GetOrder'] = saved
  }
})

test('出餐页：扣料 10 分钟内可编辑，带出原菜品、份数、桌号、备注，改份数后发 UpdateServedOrder', async () => {
  installFakes(MANAGER)
  const saved = RESPONSES['FnbKitchen/GetOrder']
  RESPONSES['FnbKitchen/GetOrder'] = Object.assign({}, saved, { served: true, changeSecondsLeft: 300,
    servedNeeds: [{ itemId: 10, itemName: '大白菜', plannedQuantity: 180, actualQuantity: 180, shortageQuantity: 0 }] })
  try {
    const page = loadPage('serve')
    page.onLoad({})
    await settle()
    page.onEditOrder({ currentTarget: { dataset: { id: '5' } } })
    await settle()
    // 当时微调成 180 g（配方 2 份是 200 g），编辑时按微调过带出
    assert.deepEqual({ editingId: page.data.editingId, dish: page.data.dish.productId, dishQuery: page.data.dishQuery, portions: page.data.portions,
      tableNo: page.data.tableNo, remark: page.data.remark, deduct: page.data.deduct.map(d => [d.qty, d.touched]) },
    { editingId: '5', dish: 7, dishQuery: '酸菜白肉锅', portions: 2, tableNo: 'A3', remark: '少盐', deduct: [['180', true]] })
    page.onPortions({ detail: { value: 3 } })
    await settle()
    page.createOrder()
    await settle()
    assert.equal(calls.filter(c => c.path === 'FnbKitchen/CreateAndServe').length, 0)
    assert.deepEqual(calls.find(c => c.path === 'FnbKitchen/UpdateServedOrder').data,
      { shopId: 12, orderId: '5', tableNo: 'A3', remark: '少盐', lines: [{ productId: 7, quantity: 3, remark: null }], ingredients: [{ itemId: 10, quantity: 180 }] })
    assert.deepEqual({ newShow: page.data.newShow, editingId: page.data.editingId }, { newShow: false, editingId: '' })
  } finally {
    RESPONSES['FnbKitchen/GetOrder'] = saved
  }
})

test('出餐页：建单前逐项提示库存，缺的是没开封的整包可直接开封；库存不够要确认才建单', async () => {
  installFakes(MANAGER)
  RESPONSES['FnbKitchen/GetDeductStock'] = [{ itemId: 10, availableQuantity: 150, sealedQuantity: 1000, sealedPacks: 2,
    openBatchId: 101, openBatchNo: 'B2', openPackSize: 500, packUnitName: '袋' }]
  try {
    const page = loadPage('serve')
    page.onLoad({})
    await settle()
    page.openNew()
    page.onDishInput({ detail: { value: '酸菜白肉锅' } })
    page.onPortions({ detail: { value: 2 } })
    await settle()
    assert.match(calls.find(c => c.path === 'FnbKitchen/GetDeductStock').url, /itemIds=10/)
    const line = page.data.deduct[0]
    assert.deepEqual([line.availLabel, line.short, line.shortLabel, line.openHint, line.canOpen, line.openLabel],
      ['可用 150 g', true, '欠 50 g', '另有 2 袋未开封', true, '开封 1 袋'])

    // 开封一袋后重新查库存，够了就不再提示欠料
    RESPONSES['FnbKitchen/GetDeductStock'] = [{ itemId: 10, availableQuantity: 650, sealedQuantity: 500, sealedPacks: 1,
      openBatchId: 101, openBatchNo: 'B2', openPackSize: 500, packUnitName: '袋' }]
    page.onOpenPack({ currentTarget: { dataset: { index: 0 } } })
    await settle()
    const opened = calls.find(c => c.path === 'FnbInventory/PostOpen').data
    assert.deepEqual([opened.parentBatchId, opened.packCount], [101, 1])
    assert.deepEqual([page.data.deduct[0].availLabel, page.data.deduct[0].short], ['可用 650 g', false])

    // 微调到 1 kg 又不够：先确认，取消就不建单，确认才建单
    page.setDeductQty({ currentTarget: { dataset: { index: 0 } }, detail: { value: '1000' } })
    assert.equal(page.data.deduct[0].shortLabel, '欠 350 g')
    const modals = []
    let answer = false
    wx.showModal = o => { modals.push(o); setImmediate(() => o.success({ confirm: answer })) }
    page.createOrder()
    await settle()
    assert.equal(modals[0].title, '库存不够')
    assert.match(modals[0].content, /大白菜 欠 350 g/)
    assert.equal(calls.filter(c => c.path === 'FnbKitchen/CreateAndServe').length, 0)
    answer = true
    page.createOrder()
    await settle()
    assert.deepEqual(calls.find(c => c.path === 'FnbKitchen/CreateAndServe').data.ingredients, [{ itemId: 10, quantity: 1000 }])
  } finally {
    delete RESPONSES['FnbKitchen/GetDeductStock']
  }
})

test('出餐页：有欠料的单可补扣欠料（过了 10 分钟也行），「有欠料」看近 7 天没补的单，已盘点的不能补', async () => {
  installFakes(MANAGER)
  const saved = RESPONSES['FnbKitchen/GetOrder']
  const shortNeed = { itemId: 10, itemName: '大白菜', plannedQuantity: 300, actualQuantity: 200, shortageQuantity: 100, settledByStocktake: false }
  RESPONSES['FnbKitchen/GetOrder'] = Object.assign({}, saved, { served: true, changeSecondsLeft: null, servedNeeds: [shortNeed] })
  RESPONSES['FnbKitchen/FillShortage'] = { orderId: '5', filledItems: 1, settledByStocktake: [],
    needs: [Object.assign({}, shortNeed, { actualQuantity: 300, shortageQuantity: 0 })] }
  RESPONSES['FnbKitchen/ListShortageOrders'] = [{ id: '5', business_date: '2026-09-24T00:00:00' }]
  try {
    const page = loadPage('serve')
    page.onLoad({})
    await settle()
    assert.deepEqual([page.data.orders[0].canChange, page.data.orders[0].canFill], [false, true])
    const modals = []
    const confirm = wx.showModal
    wx.showModal = o => { modals.push(o); confirm(o) }
    page.onFillShortage({ currentTarget: { dataset: { id: '5' } } })
    await settle()
    assert.match(modals[0].content, /大白菜 欠 100 g/)
    assert.deepEqual(calls.filter(c => c.path === 'FnbKitchen/FillShortage').map(c => c.data), [{ shopId: 12, orderId: '5' }])

    page.onFilter({ currentTarget: { dataset: { filter: 'short' } } })
    await settle()
    assert.match(calls.find(c => c.path === 'FnbKitchen/ListShortageOrders').url, /days=7/)
    assert.deepEqual([page.data.filter, page.data.orders.length], ['short', 1])

    RESPONSES['FnbKitchen/GetOrder'] = Object.assign({}, saved, { served: true, changeSecondsLeft: null,
      servedNeeds: [Object.assign({}, shortNeed, { settledByStocktake: true })] })
    page.load()
    await settle()
    const order = page.data.orders[0]
    assert.deepEqual([order.canFill, order.used[0].shortLabel, order.usedLine], [false, '欠 100 g · 已盘点', '大白菜 200 g（欠 100 g，已盘点）'])
  } finally {
    RESPONSES['FnbKitchen/GetOrder'] = saved
    delete RESPONSES['FnbKitchen/FillShortage']
    delete RESPONSES['FnbKitchen/ListShortageOrders']
  }
})

test('盘点页：店长开始盘点只快照有可用量的食材并记住单号', async () => {
  installFakes(MANAGER)
  const page = loadPage('count')
  page.onLoad({})
  await settle()
  page.onStart()
  await settle()
  const snap = calls.find(c => c.path === 'FnbStocktake/CreateSnapshot')
  assert.deepEqual(snap.data.itemIds, [10])
  assert.equal(page.data.documentId, '77')
  assert.equal(page.data.rows[0].systemLabel, '5 kg')
  assert.equal(page.data.pending, 1)
})

test('销毁清单：店长确认销毁按过期原因整批报损', async () => {
  installFakes(MANAGER)
  const page = loadPage('destroy')
  page.onLoad({})
  await settle()
  assert.equal(page.data.pending.length, 1)
  page.onDestroy({ currentTarget: { dataset: { id: 100 } } })
  await settle()
  const waste = calls.find(c => c.path === 'FnbInventory/PostWaste')
  assert.deepEqual({ batchId: waste.data.batchId, quantity: waste.data.quantity, reasonCode: waste.data.reasonCode }, { batchId: 100, quantity: 5000, reasonCode: 'expiry' })
})

test('制作页：填实际产出数量按配方比例算原料，不足不能制作；按产出量过账，带照片和到期日', async () => {
  installFakes(MANAGER)
  RESPONSES['FnbKitchen/GetDeductStock'] = [{ itemId: 10, availableQuantity: 5000, sealedPacks: 0 }]
  try {
    const page = loadPage('prep')
    page.onLoad({})
    await settle()
    page.onToggle({ currentTarget: { dataset: { id: 11 } } })
    await settle()
    assert.match(calls.find(c => c.path === 'FnbKitchen/GetDeductStock').url, /itemIds=10/)
    assert.equal(page.data.outQty, 10, '默认一份配方的产出')
    page.onOutQty({ detail: { value: 60 } })
    assert.deepEqual([page.data.needs[0].needLabel, page.data.needs[0].canOpen], ['6 kg', false])
    page.onExpire({ detail: { date: '2099-01-01' } })
    page.onPhotos({ detail: { photos: [{ id: 5 }], uploading: 0 } })
    assert.equal(page.data.canMake, false)
    page.onOutQty({ detail: { value: 10 } })
    assert.equal(page.data.canMake, true)
    page.onMake()
    await settle()
    const made = calls.find(c => c.path === 'FnbInventory/PostPreparation')
    assert.deepEqual({ recipeId: made.data.recipeId, outputQuantity: made.data.outputQuantity, imageIds: made.data.imageIds, expireDate: made.data.expireDate },
      { recipeId: '20', outputQuantity: 10, imageIds: [5], expireDate: '2099-01-01' })
  } finally {
    delete RESPONSES['FnbKitchen/GetDeductStock']
  }
})

test('制作页：原料不够而且有整包没开封，可直接开封，开封后重新查库存，够了就能制作', async () => {
  installFakes(MANAGER)
  RESPONSES['FnbKitchen/GetDeductStock'] = [{ itemId: 10, availableQuantity: 0, sealedQuantity: 1000, sealedPacks: 2,
    openBatchId: 101, openBatchNo: 'B2', openPackSize: 500, packUnitName: '袋' }]
  try {
    const page = loadPage('prep')
    page.onLoad({})
    await settle()
    page.onToggle({ currentTarget: { dataset: { id: 11 } } })
    await settle()
    const row = page.data.needs[0]
    assert.deepEqual([row.stockLabel, row.short, row.openHint, row.canOpen, row.openLabel, page.data.canMake],
      ['可用 0 g', true, '另有 2 袋未开封', true, '开封 1 袋', false])
    RESPONSES['FnbKitchen/GetDeductStock'] = [{ itemId: 10, availableQuantity: 1000, sealedQuantity: 0, sealedPacks: 0 }]
    page.onOpenPack({ currentTarget: { dataset: { index: 0 } } })
    await settle()
    const opened = calls.find(c => c.path === 'FnbInventory/PostOpen').data
    assert.deepEqual([opened.parentBatchId, opened.packCount], [101, 1])
    assert.deepEqual([page.data.needs[0].stockLabel, page.data.needs[0].short, page.data.canMake], ['可用 1 kg', false, true])
    // 照片选填：不拍照也能制作
    page.onExpire({ detail: { date: '2099-01-01' } })
    page.onMake()
    await settle()
    assert.deepEqual(calls.find(c => c.path === 'FnbInventory/PostPreparation').data.imageIds, [])
  } finally {
    delete RESPONSES['FnbKitchen/GetDeductStock']
  }
})

test('配方页：新建菜品只填名称和用料，先建菜品再存用料并发布，不带售价和分类', async () => {
  installFakes(MANAGER)
  const page = loadPage('recipe')
  page.onLoad({})
  await settle()
  const posted = path => calls.filter(c => c.path === path).map(c => c.data)
  page.newDish()
  assert.equal(page.data.editor.isNew, true)
  page.onPublish()
  await settle()
  assert.equal(posted('FnbRecipe/SaveDish').length, 0, '没填名称不建菜品')
  page.setEditorName({ detail: { value: '榛果饮' } })
  page.onPublish()
  await settle()
  assert.equal(posted('FnbRecipe/SaveDish').length, 0, '没有用料不建菜品')
  page.openPicker()
  page.onPick({ currentTarget: { dataset: { id: 10 } } })
  page.setLineQty({ currentTarget: { dataset: { index: 0 } }, detail: { value: '200' } })
  page.onPublish()
  await settle()
  assert.deepEqual(posted('FnbRecipe/SaveDish'), [{ shopId: 12, id: 0, name: '榛果饮', valid: true }])
  const draft = posted('FnbRecipe/SaveRecipeDraft')[0]
  assert.deepEqual({ dishSpecId: draft.dishSpecId, lines: draft.lines }, { dishSpecId: 4, lines: [{ itemId: 10, quantity: 200, sort: 1, remark: null }] })
  assert.equal(posted('FnbRecipe/PublishRecipe').length, 1)
  assert.equal(page.data.editShow, false)
})

test('配方页：菜品资料只改名称，不带售价和分类', async () => {
  installFakes(MANAGER)
  const page = loadPage('recipe')
  page.onLoad({})
  await settle()
  assert.equal(page.data.dishes[0].meta, '热菜 · ¥68.00')
  page.editDish({ currentTarget: { dataset: { key: 'd7' } } })
  page.setDish({ currentTarget: { dataset: { field: 'name' } }, detail: { value: '酸菜白肉锅（大）' } })
  page.onSaveDish()
  await settle()
  assert.deepEqual(calls.find(c => c.path === 'FnbRecipe/SaveDish').data, { shopId: 12, id: 7, name: '酸菜白肉锅（大）', valid: true })
})

test('配方页：编辑已发布配方 → 存新草稿 → 用返回的 rowVersion 发布', async () => {
  installFakes(MANAGER)
  const page = loadPage('recipe')
  page.onLoad({})
  await settle()
  page.editRecipe({ currentTarget: { dataset: { key: 'd7' } } })
  await settle()
  assert.equal(page.data.editor.lines[0].qty, '1000')
  page.setLineQty({ currentTarget: { dataset: { index: 0 } }, detail: { value: '400' } })
  page.onPublish()
  await settle()
  const draft = calls.find(c => c.path === 'FnbRecipe/SaveRecipeDraft')
  assert.deepEqual({ id: draft.data.id, dishSpecId: draft.data.dishSpecId, lines: draft.data.lines }, { id: 0, dishSpecId: 3, lines: [{ itemId: 10, quantity: 400, sort: 1, remark: null }] })
  const publish = calls.find(c => c.path === 'FnbRecipe/PublishRecipe')
  assert.deepEqual({ recipeId: publish.data.recipeId, rowVersion: publish.data.rowVersion }, { recipeId: '21', rowVersion: 'RV21' })
})

test('配方页：新建半成品先建半成品食材（所选半成品分类），再按每 1 千克的用量存配方并发布，不填产出量', async () => {
  installFakes(MANAGER)
  const savedCats = RESPONSES['FnbCatalog/ListCategories']
  const savedMat = RESPONSES['FnbCatalog/SaveMaterial']
  RESPONSES['FnbCatalog/ListCategories'] = savedCats.concat([{ id: 60, level: 1, parent_id: null, name: '半成品', is_prepared: true, valid: true, sort: 3 },
    { id: 61, level: 2, parent_id: 60, name: 'Pizza面团', default_storage: 'chilled', valid: true, sort: 1 }])
  RESPONSES['FnbCatalog/SaveMaterial'] = { id: 30, code: 'M1', name: 'Pizza面团', category_id: 61, item_type: 'prepared', base_unit_code: 'g', default_input_unit_code: 'kg', warn_days: 1, valid: true }
  try {
    const page = loadPage('recipe')
    page.onLoad({})
    await settle()
    assert.deepEqual(page.data.prepCats, [{ id: 61, name: 'Pizza面团' }])
    page.onSeg({ currentTarget: { dataset: { seg: 'prep' } } })
    page.newPrep()
    assert.deepEqual([page.data.editor.kind, page.data.editor.isNew, page.data.editor.categoryId, page.data.editor.outputUnit], ['prep', true, 61, 'kg'])
    page.setEditorName({ detail: { value: 'Pizza面团' } })
    page.openPicker()
    page.onPick({ currentTarget: { dataset: { id: 10 } } })
    page.setLineQty({ currentTarget: { dataset: { index: 0 } }, detail: { value: '600' } })
    page.onPublish()
    await settle()
    await settle()
    const mat = calls.find(c => c.path === 'FnbCatalog/SaveMaterial').data
    assert.deepEqual({ id: mat.id, name: mat.name, categoryId: mat.categoryId, baseUnitCode: mat.baseUnitCode, defaultInputUnitCode: mat.defaultInputUnitCode },
      { id: 0, name: 'Pizza面团', categoryId: 61, baseUnitCode: 'g', defaultInputUnitCode: 'kg' })
    const draft = calls.find(c => c.path === 'FnbRecipe/SaveRecipeDraft').data
    assert.deepEqual({ recipeType: draft.recipeType, outputItemId: draft.outputItemId, outputQty: draft.outputQty, lines: draft.lines },
      { recipeType: 'prep', outputItemId: 30, outputQty: 1000, lines: [{ itemId: 10, quantity: 600, sort: 1, remark: null }] })
    assert.ok(calls.some(c => c.path === 'FnbRecipe/PublishRecipe'))
    assert.equal(page.data.editShow, false)
  } finally {
    RESPONSES['FnbCatalog/ListCategories'] = savedCats
    RESPONSES['FnbCatalog/SaveMaterial'] = savedMat
  }
})

test('配方页：早先按每批 10 个存的半成品配方，编辑时换成每 1 个的用量，重新发布只存 1 个', async () => {
  installFakes(MANAGER)
  const page = loadPage('recipe')
  page.onLoad({})
  await settle()
  assert.equal(page.data.preps[0].yieldLabel, '每 10 个的用量')
  page.editRecipe({ currentTarget: { dataset: { key: 'p11' } } })
  await settle()
  assert.deepEqual([page.data.editor.outputUnitLabel, page.data.editor.lines[0].qty], ['个', '100'])
  page.onPublish()
  await settle()
  const draft = calls.find(c => c.path === 'FnbRecipe/SaveRecipeDraft').data
  assert.deepEqual({ outputItemId: draft.outputItemId, outputQty: draft.outputQty, lines: draft.lines },
    { outputItemId: 11, outputQty: 1, lines: [{ itemId: 10, quantity: 100, sort: 1, remark: null }] })
})

test('配方页：还没有半成品分类时，新建半成品提示先去分类页', async () => {
  installFakes(MANAGER)
  const page = loadPage('recipe')
  page.onLoad({})
  await settle()
  const modals = []
  wx.showModal = o => { modals.push(o) }
  page.newPrep()
  assert.equal(page.data.editShow, false)
  assert.equal(modals[0].title, '还没有半成品分类')
})

test('分类页：新增二级分类只存名称和储存方式，不写保质期规则', async () => {
  installFakes(MANAGER)
  const page = loadPage('cats')
  page.onLoad({})
  await settle()
  page.addL2({ currentTarget: { dataset: { id: 1 } } })
  page.setEdit({ currentTarget: { dataset: { field: 'name' } }, detail: { value: '速冻面点' } })
  page.setEdit({ currentTarget: { dataset: { field: 'defaultStorage', value: 'frozen' } }, detail: {} })
  page.saveEditor()
  await settle()
  assert.deepEqual(calls.find(c => c.path === 'FnbCatalog/SaveCategory').data,
    { shopId: 12, id: 0, parentId: 1, level: 2, name: '速冻面点', defaultStorage: 'frozen', sort: 3, valid: true, isPrepared: false })
  assert.equal(calls.filter(c => c.path === 'FnbCatalog/SaveShelfLifeRule').length, 0)
  assert.equal(page.data.editShow, false)
})

test('分类页：新增一级分类可选半成品，保存后展开该分类', async () => {
  installFakes(MANAGER)
  const page = loadPage('cats')
  page.onLoad({})
  await settle()
  page.addL1()
  assert.deepEqual([page.data.editShow, page.data.edit.level, page.data.edit.parentPrepared], [true, 1, false])
  page.setEdit({ currentTarget: { dataset: { field: 'name' } }, detail: { value: '半成品' } })
  page.setEdit({ currentTarget: { dataset: { field: 'isPrepared', value: true } }, detail: {} })
  page.saveEditor()
  await settle()
  assert.deepEqual(calls.find(c => c.path === 'FnbCatalog/SaveCategory').data,
    { shopId: 12, id: 0, parentId: null, level: 1, name: '半成品', defaultStorage: null, sort: 3, valid: true, isPrepared: true })
  assert.equal(page.data.openL1, 2)
})

test('分类页：编辑食材带临期和开封默认，冷藏规则挂在食材上且只写有变化的月份', async () => {
  installFakes(MANAGER)
  const page = loadPage('cats')
  page.onLoad({})
  await settle()
  page.editMaterial({ currentTarget: { dataset: { id: 10 } } })
  page.setMat({ currentTarget: { dataset: { field: 'warnDays' } }, detail: { value: '2' } })
  page.pickOpenStorage({ currentTarget: { dataset: { value: 'frozen' } } })
  page.setMat({ currentTarget: { dataset: { field: 'openDays' } }, detail: { value: '3' } })
  page.setMat({ currentTarget: { dataset: { field: 'rules.chilled.mode', value: 'all' } }, detail: {} })
  page.setMat({ currentTarget: { dataset: { field: 'rules.chilled.all' } }, detail: { value: '7' } })
  page.onSaveMat()
  await settle()
  const saved = calls.find(c => c.path === 'FnbCatalog/SaveMaterial').data
  assert.deepEqual({ id: saved.id, code: saved.code, warnDays: saved.warnDays, defaultOpenStorage: saved.defaultOpenStorage, defaultOpenDays: saved.defaultOpenDays, baseUnitCode: saved.baseUnitCode },
    { id: 10, code: 'VEG1', warnDays: 2, defaultOpenStorage: 'frozen', defaultOpenDays: 3, baseUnitCode: 'g' })
  const rules = calls.filter(c => c.path === 'FnbCatalog/SaveShelfLifeRule')
  assert.equal(rules.length, 12)
  assert.ok(rules.every(r => r.data.itemId === 10 && r.data.shelfLifeValue === 7 && r.data.categoryId === undefined))
  assert.equal(page.data.matShow, false)
})

test('分类页：开封后储存方式再点一次取消，保存为空', async () => {
  installFakes(MANAGER)
  const page = loadPage('cats')
  page.onLoad({})
  await settle()
  page.editMaterial({ currentTarget: { dataset: { id: 12 } } })
  assert.equal(page.data.mat.openStorage, 'chilled')
  assert.equal(page.data.mat.openDays, '7')
  page.pickOpenStorage({ currentTarget: { dataset: { value: 'chilled' } } })
  page.onSaveMat()
  await settle()
  assert.equal(calls.find(c => c.path === 'FnbCatalog/SaveMaterial').data.defaultOpenStorage, null)
})

test('入库页：开封后默认、临期天数、保质期规则都取自所选食材', async () => {
  installFakes(MANAGER)
  const saved = RESPONSES['FnbCatalog/ListShelfLifeRules']
  RESPONSES['FnbCatalog/ListShelfLifeRules'] = [{ id: 77, item_id: 10, storage_type: 'chilled', production_month: 9, shelf_life_value: 7, shelf_life_unit: 'day', valid: true }]
  try {
    const page = loadPage('inbound')
    page.onLoad({})
    await settle()
    page.onHint({ currentTarget: { dataset: { id: 12 } } })
    assert.deepEqual({ openStorage: page.data.openStorage, openDays: page.data.openDays, warnDays: page.draftState().warnDays },
      { openStorage: 'chilled', openDays: '7', warnDays: 30 })
    page.onProdDate({ detail: { date: '2099-09-20' } })
    assert.match(page.data.ruleText, /该食材的冷藏没有保质期规则/)
    page.onHint({ currentTarget: { dataset: { id: 10 } } })
    assert.match(page.data.ruleText, /按食材规则 → 2099-09-27 到期/)
    assert.deepEqual({ openStorage: page.data.openStorage, openDays: page.data.openDays }, { openStorage: 'chilled', openDays: '' })
  } finally {
    RESPONSES['FnbCatalog/ListShelfLifeRules'] = saved
  }
})

test('入库页：生产日期 + 保质期自动填出到期日期；手填到期日期后生产日期和保质期锁定、不提交，可改回计算', async () => {
  installFakes(MANAGER)
  const page = loadPage('inbound')
  page.onLoad({})
  await settle()
  page.onHint({ currentTarget: { dataset: { id: 10 } } })
  page.onProdDate({ detail: { date: '2099-09-23' } })
  page.onShelf({ detail: { value: '7' } })
  assert.equal(page.data.expireDate, '')
  assert.equal(page.data.expireShown, '2099-09-30')

  page.onExpireDate({ detail: { date: '2099-10-15' } })
  assert.equal(page.data.expireShown, '2099-10-15')
  page.onProdDate({ detail: { date: '2099-09-01' } })
  page.onShelf({ detail: { value: '99' } })
  page.onScan({ currentTarget: { dataset: { mode: 'date' } } })
  assert.deepEqual({ prodDate: page.data.prodDate, shelfValue: page.data.shelfValue, scan: page.data.scan.show }, { prodDate: '2099-09-23', shelfValue: '7', scan: false })
  page.onPhotos({ detail: { photos: [{ id: 5 }], uploading: 0 } })
  page.submit()
  await settle()
  await settle()
  const body = receipts()[0]
  assert.deepEqual({ expireDate: body.expireDate, source: body.expirySource, productionDate: body.productionDate, shelfLifeValue: body.shelfLifeValue },
    { expireDate: '2099-10-15', source: 'package', productionDate: null, shelfLifeValue: null })

  page.onHint({ currentTarget: { dataset: { id: 10 } } })
  page.onProdDate({ detail: { date: '2099-09-23' } })
  page.onShelf({ detail: { value: '7' } })
  page.onExpireDate({ detail: { date: '2099-10-15' } })
  page.clearExpire()
  assert.deepEqual({ expireDate: page.data.expireDate, expireShown: page.data.expireShown }, { expireDate: '', expireShown: '2099-09-30' })
})

test('入库页：封装含量可选单位，选了按毫升计量的食材后只能用 ml / L，按 L 填的含量换成毫升提交', async () => {
  installFakes(MANAGER)
  const saved = RESPONSES['FnbCatalog/GetUnits']
  RESPONSES['FnbCatalog/GetUnits'] = saved.concat([{ code: 'l', name: '升', dimension: 2, factor_to_base: 1000, valid: true }])
  try {
    const page = loadPage('inbound')
    page.onLoad({})
    await settle()
    page.onPacked({ currentTarget: { dataset: { v: '1' } } })
    assert.ok(page.data.contentUnits.length === 5 && page.data.contentUnits.every(u => !u.off), '没选食材时全部单位可选')
    page.onHint({ currentTarget: { dataset: { id: 12 } } })
    assert.deepEqual(page.data.contentUnits.filter(u => !u.off).map(u => u.code), ['ml', 'l'])
    assert.equal(page.data.contentUnit, 'ml')
    page.onContentUnit({ currentTarget: { dataset: { code: 'g' } } })
    assert.equal(page.data.contentUnit, 'ml')
    page.onContentUnit({ currentTarget: { dataset: { code: 'l' } } })
    page.onPackSize({ detail: { value: '1.5' } })
    page.onQty({ detail: { value: 2 } })
    page.onExpireDate({ detail: { date: '2099-10-01' } })
    page.onPhotos({ detail: { photos: [{ id: 5 }], uploading: 0 } })
    page.submit()
    await settle()
    const body = receipts()[0]
    assert.deepEqual({ stockForm: body.stockForm, packSize: body.packSize, quantity: body.quantity, inputUnitCode: body.inputUnitCode },
      { stockForm: 'sealed', packSize: 1500, quantity: 2, inputUnitCode: 'ml' })
  } finally {
    RESPONSES['FnbCatalog/GetUnits'] = saved
  }
})

test('入库页：输入与已建档食材同名时直接选中；不拍照也能提交入库', async () => {
  installFakes(MANAGER)
  const page = loadPage('inbound')
  page.onLoad({})
  await settle()
  page.onName({ detail: { value: '大白' } })
  assert.equal(page.data.material, null)
  assert.deepEqual(page.data.hints.map(h => h.id), [10])
  page.onName({ detail: { value: '大白菜' } })
  assert.equal(page.data.material.id, 10)
  assert.equal(page.data.nameQuery, '大白菜')
  page.onInputUnit({ currentTarget: { dataset: { code: 'g' } } })
  page.onName({ detail: { value: '大白菜' } })
  assert.equal(page.data.inputUnit, 'g', '已选中同一食材时不重新带出默认值')
  page.onExpireDate({ detail: { date: '2099-10-01' } })
  page.submit()
  await settle()
  assert.equal(receipts().length, 1)
  assert.deepEqual(receipts()[0].imageIds, [])
})

test('入库页：新食材不用单独建档，表单填完提交入库时按所选数量单位自动建档', async () => {
  installFakes(MANAGER)
  const page = loadPage('inbound')
  page.onLoad({})
  await settle()
  page.onName({ detail: { value: '冬瓜' } })
  assert.equal(page.data.canCreate, true)
  assert.deepEqual(page.data.inputUnits.map(u => u.code), ['g', 'kg', 'ml', 'piece'])
  page.onInputUnit({ currentTarget: { dataset: { code: 'g' } } })
  page.onQty({ detail: { value: 3 } })
  page.submit()
  await settle()
  assert.equal(calls.filter(c => c.path === 'FnbCatalog/SaveMaterial').length, 0, '表单不完整时不建档')
  page.onExpireDate({ detail: { date: '2099-10-01' } })
  page.submit()
  await settle()
  const body = calls.find(c => c.path === 'FnbCatalog/SaveMaterial').data
  assert.deepEqual({ name: body.name, categoryId: body.categoryId, baseUnitCode: body.baseUnitCode, defaultInputUnitCode: body.defaultInputUnitCode, warnDays: body.warnDays },
    { name: '冬瓜', categoryId: 2, baseUnitCode: 'g', defaultInputUnitCode: 'g', warnDays: 1 })
  assert.equal(receipts().length, 1)
  assert.deepEqual({ itemId: receipts()[0].itemId, quantity: receipts()[0].quantity, inputUnitCode: receipts()[0].inputUnitCode },
    { itemId: 10, quantity: 3, inputUnitCode: 'g' })
  assert.equal(page.data.submitting, false)
})

test('入库页：封装的新食材须选含量单位，按含量单位建档并带上本次的开封后默认', async () => {
  installFakes(MANAGER)
  const page = loadPage('inbound')
  page.onLoad({})
  await settle()
  page.onName({ detail: { value: '香草糖浆' } })
  page.onPacked({ currentTarget: { dataset: { v: '1' } } })
  page.onPackSize({ detail: { value: '750' } })
  page.onOpenStorage({ currentTarget: { dataset: { code: 'chilled' } } })
  page.onOpenDays({ detail: { value: '30' } })
  page.onExpireDate({ detail: { date: '2099-10-01' } })
  assert.equal(page.data.contentUnit, '')
  page.submit()
  await settle()
  assert.equal(calls.filter(c => c.path === 'FnbCatalog/SaveMaterial').length, 0, '没选含量单位不建档')
  page.onContentUnit({ currentTarget: { dataset: { code: 'ml' } } })
  page.submit()
  await settle()
  const body = calls.find(c => c.path === 'FnbCatalog/SaveMaterial').data
  assert.deepEqual({ baseUnitCode: body.baseUnitCode, defaultInputUnitCode: body.defaultInputUnitCode, defaultOpenStorage: body.defaultOpenStorage, defaultOpenDays: body.defaultOpenDays },
    { baseUnitCode: 'ml', defaultInputUnitCode: 'ml', defaultOpenStorage: 'chilled', defaultOpenDays: 30 })
  const draft = receipts()[0]
  assert.deepEqual({ stockForm: draft.stockForm, packSize: draft.packSize, openShelfLifeDays: draft.openShelfLifeDays }, { stockForm: 'sealed', packSize: 750, openShelfLifeDays: 30 })
})

test('入库页：网络失败时表单保留，重试沿用同一请求号不会重复入库；成功后清空表单', async () => {
  installFakes(MANAGER)
  let failOnce = true
  api.setTransport(function (options) {
    const p = options.url.replace('https://x/api/', '').split('?')[0]
    calls.push({ path: p, method: options.method, data: options.data, url: options.url })
    if (p === 'FnbInventory/PostReceipt' && failOnce) { failOnce = false; setImmediate(() => options.fail()); return }
    const data = RESPONSES[p]
    setImmediate(() => options.success({ statusCode: 200, data: { code: 0, message: '', data: JSON.parse(JSON.stringify(data)) } }))
  })
  const page = loadPage('inbound')
  page.onLoad({})
  await settle()
  page.onHint({ currentTarget: { dataset: { id: 10 } } })
  page.onExpireDate({ detail: { date: '2099-10-01' } })
  page.submit()
  await settle()
  assert.equal(page.data.material.id, 10, '失败后表单保留')
  assert.equal(page.data.done.length, 0)
  page.submit()
  await settle()
  const [first, second] = receipts()
  assert.equal(first.requestId, second.requestId)
  assert.equal(page.data.done.length, 1)
  assert.equal(page.data.material, null)
})

test('入库页：提交前弹确认框，取消则不入库；确认后才建档入库', async () => {
  installFakes(MANAGER)
  const modals = []
  let answer = false
  wx.showModal = o => { modals.push(o); setImmediate(() => o.success({ confirm: answer })) }
  const page = loadPage('inbound')
  page.onLoad({})
  await settle()
  page.onHint({ currentTarget: { dataset: { id: 10 } } })
  page.onExpireDate({ detail: { date: '2099-10-01' } })
  page.onQty({ detail: { value: 2 } })
  page.submit()
  await settle()
  assert.equal(receipts().length, 0)
  assert.match(modals[0].content, /大白菜：2 kg · 冷藏 · 2099-10-01 到期/)
  answer = true
  page.submit()
  await settle()
  assert.equal(receipts().length, 1)
})

test('入库页：本次已入库 10 分钟内可删除，超时后不再发删除请求', async () => {
  installFakes(MANAGER)
  const page = loadPage('inbound')
  page.onLoad({})
  await settle()
  const receive = async () => {
    page.onHint({ currentTarget: { dataset: { id: 10 } } })
    page.onExpireDate({ detail: { date: '2099-10-01' } })
    page.submit()
    await settle()
  }
  const deletes = () => calls.filter(c => c.path === 'FnbInventory/DeleteReceipt').map(c => c.data)
  await receive()
  assert.equal(page.data.done[0].canDelete, true)
  page.onDeleteDone({ currentTarget: { dataset: { id: 104 } } })
  await settle()
  assert.deepEqual(deletes(), [{ shopId: 12, batchId: 104 }])
  assert.equal(page.data.done.length, 0)

  await receive()
  page.data.done[0].deleteUntil = Date.now() - 1
  page.onDeleteDone({ currentTarget: { dataset: { id: 104 } } })
  await settle()
  assert.equal(deletes().length, 1, '超过 10 分钟不发删除请求')
  assert.equal(page.data.done[0].canDelete, false)
})

test('批次页：服务端给出剩余可删秒数时显示「删除这次入库」，删除发 DeleteReceipt', async () => {
  installFakes(MANAGER)
  const saved = RESPONSES['FnbInventory/GetBatch']
  RESPONSES['FnbInventory/GetBatch'] = Object.assign({}, saved, { deleteSecondsLeft: 300 })
  try {
    const page = loadPage('batch')
    page.onLoad({ id: '100' })
    await settle()
    assert.equal(page.data.info.canDelete, true)
    page.onDelete()
    await settle()
    assert.deepEqual(calls.filter(c => c.path === 'FnbInventory/DeleteReceipt').map(c => c.data), [{ shopId: 12, batchId: 100 }])
  } finally {
    RESPONSES['FnbInventory/GetBatch'] = saved
  }
  installFakes(MANAGER)
  const plain = loadPage('batch')
  plain.onLoad({ id: '100' })
  await settle()
  assert.equal(plain.data.info.canDelete, false)
})

test('入库页 / 分类页：开封后可选「保质期不变」，提交与建档都记为 OPEN_KEEP_DAYS', async () => {
  const KEEP = require('../pages/fnbinv/common/expiry.js').OPEN_KEEP_DAYS
  installFakes(MANAGER)
  const inbound = loadPage('inbound')
  inbound.onLoad({})
  await settle()
  inbound.onHint({ currentTarget: { dataset: { id: 12 } } })
  inbound.onPacked({ currentTarget: { dataset: { v: '1' } } })
  assert.deepEqual({ openKeep: inbound.data.openKeep, openDays: inbound.data.openDays }, { openKeep: false, openDays: '7' })
  inbound.onOpenKeep()
  assert.deepEqual({ openKeep: inbound.data.openKeep, openDays: inbound.data.openDays }, { openKeep: true, openDays: '' })
  inbound.onPackSize({ detail: { value: '500' } })
  inbound.onExpireDate({ detail: { date: '2099-10-01' } })
  inbound.submit()
  await settle()
  assert.equal(receipts()[0].openShelfLifeDays, KEEP)

  installFakes(MANAGER)
  const cats = loadPage('cats')
  cats.onLoad({})
  await settle()
  cats.editMaterial({ currentTarget: { dataset: { id: 12 } } })
  cats.toggleOpenKeep()
  cats.onSaveMat()
  await settle()
  assert.equal(calls.find(c => c.path === 'FnbCatalog/SaveMaterial').data.defaultOpenDays, KEEP)
})

test('入库页：普通员工输入未建档的新名字不能入库，也不会建档', async () => {
  installFakes({ id: 3, title_level: 100, base_shop_id: 12 })
  const page = loadPage('inbound')
  page.onLoad({})
  await settle()
  page.onName({ detail: { value: '冬瓜' } })
  page.onExpireDate({ detail: { date: '2099-10-01' } })
  page.submit()
  await settle()
  assert.equal(calls.filter(c => c.path === 'FnbCatalog/SaveMaterial').length, 0)
  assert.equal(receipts().length, 0)
})

test('分类页：有可用食材的分类不能删；空分类确认后发 DeleteCategory，一级分类连同二级一起删', async () => {
  installFakes(MANAGER)
  const modals = []
  const confirm = wx.showModal
  wx.showModal = o => { modals.push(o); confirm(o) }
  const page = loadPage('cats')
  page.onLoad({})
  await settle()
  page.editL2({ currentTarget: { dataset: { id: 2 } } })
  page.onDeleteL2()
  page.onDeleteL1({ currentTarget: { dataset: { id: 1 } } })
  await settle()
  assert.equal(calls.filter(c => c.path === 'FnbCatalog/DeleteCategory').length, 0)
  assert.match(modals[0].content, /「蔬菜类」下还有 3 种可用食材/)
  assert.match(modals[1].content, /「生鲜」下还有 3 种可用食材/)

  page.editL2({ currentTarget: { dataset: { id: 3 } } })
  page.onDeleteL2()
  await settle()
  assert.equal(page.data.editShow, false)
  page.onDeleteL1({ currentTarget: { dataset: { id: 4 } } })
  await settle()
  assert.match(modals[3].content, /1 个二级分类会一并删除/)
  assert.deepEqual(calls.filter(c => c.path === 'FnbCatalog/DeleteCategory').map(c => c.data), [{ shopId: 12, id: 3 }, { shopId: 12, id: 4 }])
})

test('分类页：普通员工不能删分类', async () => {
  installFakes({ id: 3, title_level: 100, base_shop_id: 12 })
  const page = loadPage('cats')
  page.onLoad({})
  await settle()
  page.onDeleteL1({ currentTarget: { dataset: { id: 4 } } })
  await settle()
  assert.equal(calls.filter(c => c.path === 'FnbCatalog/DeleteCategory').length, 0)
})

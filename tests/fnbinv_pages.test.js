// 页面级冒烟：假后端 + 假 wx，逐页 onLoad，并走通入库加单、建厨房单、开始盘点、开封这几条关键交互
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const api = require('../pages/fnbinv/common/api.js')

const TODAY_BATCH = { id: 100, name: '大白菜', batch_no: 'B1', expire_date: '2099-09-30T00:00:00', warn_days: 1, create_date: '2026-09-23T10:00:00', image_ids: '5' }
const RESPONSES = {
  'FnbCatalog/ListCategories': [
    { id: 1, level: 1, parent_id: null, name: '生鲜', valid: true, sort: 1 },
    { id: 2, level: 2, parent_id: 1, name: '蔬菜类', default_storage: 'chilled', default_unit_code: 'kg', warn_days: 1, default_open_storage: 'chilled', default_open_days: 2, valid: true, sort: 1 }],
  'FnbCatalog/ListMaterials': { total: 3, rows: [
    { id: 10, code: 'VEG1', name: '大白菜', category_id: 2, item_type: 'raw', base_unit_code: 'g', default_input_unit_code: 'kg', valid: true },
    { id: 11, code: 'DGH1', name: '面团', category_id: 2, item_type: 'prepared', base_unit_code: 'piece', default_input_unit_code: 'piece', valid: true },
    { id: 12, code: 'SAU1', name: '番茄酱', category_id: 2, item_type: 'raw', base_unit_code: 'ml', default_input_unit_code: 'ml', valid: true }] },
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
    lines: [{ id: '1', item_name: '酸菜白肉锅', quantity: 2, remark: null }], served: false },
  'FnbKitchen/CreateManualOrder': { orderId: '6', displayNo: 'M1', reviewStatus: 'verified', lineCount: 1, replayed: false },
  'FnbStocktake/CreateSnapshot': { documentId: '77' },
  'FnbStocktake/GetSnapshot': { documentId: '77', status: 'draft', rows: [{ item_id: 10, system_qty: 5000, counted_qty: null, rowVersion: 'v1' }] },
  'FnbInventory/PostOpen': { documentId: '8', batchId: 102, quantity: 1000, amount: null, replayed: false },
  'FnbInventory/PostWaste': { documentId: '9', batchId: 100, quantity: 5000, amount: 20, replayed: false },
  'FnbInventory/PostPreparation': { documentId: '10', batchId: 103, quantity: 20, amount: null, replayed: false },
  'FnbRecipe/SaveRecipeDraft': { id: '21', version_no: 2, rowVersion: 'RV21' },
  'FnbRecipe/PublishRecipe': { id: '21', version_no: 2 },
  'FnbCatalog/SaveCategory': { id: 2 },
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
    showToast() {}, setNavigationBarTitle() {}, stopPullDownRefresh() {}, redirectTo() {}, navigateTo() {}, previewImage() {},
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
const MANAGER = { id: 1, title_level: 200, base_shop_id: 12 }

for (const name of ['stock', 'expiry', 'destroy', 'batch', 'inbound', 'cats', 'prep', 'recipe', 'serve', 'count', 'dash']) {
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

test('入库页：选食材、拍照、填到期日后加入入库单，批次号避让', async () => {
  installFakes(MANAGER)
  const page = loadPage('inbound')
  page.onLoad({})
  await settle()
  page.onHint({ currentTarget: { dataset: { id: 10 } } })
  page.onPhotos({ detail: { photos: [{ id: 5, url: 'u', status: 'done' }], uploading: 0 } })
  page.onExpireDate({ detail: { date: '2099-10-01' } })
  page.onQty({ detail: { value: 3 } })
  page.addDraft()
  await settle()
  assert.equal(page.data.drafts.length, 1)
  const body = page.data.drafts[0].body
  assert.deepEqual({ itemId: body.itemId, quantity: body.quantity, inputUnitCode: body.inputUnitCode, expirySource: body.expirySource, imageIds: body.imageIds },
    { itemId: 10, quantity: 3, inputUnitCode: 'kg', expirySource: 'package', imageIds: [5] })
  assert.equal(page.data.batchNo, 'B260923-02')
})

test('出餐页：选菜建厨房单发 CreateManualOrder', async () => {
  installFakes(MANAGER)
  const page = loadPage('serve')
  page.onLoad({})
  await settle()
  assert.equal(page.data.orders[0].status.text, '待出餐')
  assert.equal(page.data.orders[0].time, '11:42')
  page.openNew()
  page.onDishQty({ currentTarget: { dataset: { id: 7 } }, detail: { value: 2 } })
  page.onTable({ detail: { value: 'A3' } })
  page.createOrder()
  await settle()
  const created = calls.find(c => c.path === 'FnbKitchen/CreateManualOrder')
  assert.deepEqual(created.data.lines, [{ productId: 7, quantity: 2, remark: null }])
  assert.equal(created.data.tableNo, 'A3')
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

test('制作页：原料不足不能制作；1 批面团按配方产出量过账，带照片和到期日', async () => {
  installFakes(MANAGER)
  const page = loadPage('prep')
  page.onLoad({})
  await settle()
  page.onToggle({ currentTarget: { dataset: { id: 11 } } })
  await settle()
  page.onN({ detail: { value: 6 } })
  page.onExpire({ detail: { date: '2099-01-01' } })
  page.onPhotos({ detail: { photos: [{ id: 5 }], uploading: 0 } })
  assert.equal(page.data.canMake, false)
  page.onN({ detail: { value: 1 } })
  assert.equal(page.data.canMake, true)
  page.onMake()
  await settle()
  const made = calls.find(c => c.path === 'FnbInventory/PostPreparation')
  assert.deepEqual({ recipeId: made.data.recipeId, outputQuantity: made.data.outputQuantity, imageIds: made.data.imageIds, expireDate: made.data.expireDate },
    { recipeId: '20', outputQuantity: 10, imageIds: [5], expireDate: '2099-01-01' })
})

test('配方页：编辑已发布配方 → 存新草稿 → 用返回的 rowVersion 发布', async () => {
  installFakes(MANAGER)
  const page = loadPage('recipe')
  page.onLoad({})
  await settle()
  page.editRecipe({ currentTarget: { dataset: { key: 'd7' } } })
  await settle()
  assert.equal(page.data.editor.lines[0].qty, '1')
  page.setLineQty({ currentTarget: { dataset: { index: 0 } }, detail: { value: '0.4' } })
  page.onPublish()
  await settle()
  const draft = calls.find(c => c.path === 'FnbRecipe/SaveRecipeDraft')
  assert.deepEqual({ id: draft.data.id, dishSpecId: draft.data.dishSpecId, lines: draft.data.lines }, { id: 0, dishSpecId: 3, lines: [{ itemId: 10, quantity: 400, sort: 1, remark: null }] })
  const publish = calls.find(c => c.path === 'FnbRecipe/PublishRecipe')
  assert.deepEqual({ recipeId: publish.data.recipeId, rowVersion: publish.data.rowVersion }, { recipeId: '21', rowVersion: 'RV21' })
})

test('分类页：编辑二级分类的冷藏规则只写有变化的月份', async () => {
  installFakes(MANAGER)
  const page = loadPage('cats')
  page.onLoad({})
  await settle()
  page.editL2({ currentTarget: { dataset: { id: 2 } } })
  page.pickEdit({ currentTarget: { dataset: { field: 'rules.chilled.mode', value: 'all' } } })
  page.setEdit({ currentTarget: { dataset: { field: 'rules.chilled.all' } }, detail: { value: '7' } })
  page.saveEditor()
  await settle()
  const rules = calls.filter(c => c.path === 'FnbCatalog/SaveShelfLifeRule')
  assert.equal(rules.length, 12)
  assert.deepEqual(rules.map(r => r.data.shelfLifeValue), new Array(12).fill(7))
  assert.equal(calls.find(c => c.path === 'FnbCatalog/SaveCategory').data.warnDays, 1)
})

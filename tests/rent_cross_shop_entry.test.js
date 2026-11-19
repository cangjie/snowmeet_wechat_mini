// 租赁开单：异店租赁的租赁物只需要选分类，不用填具体的编码或名称就能下单结算；
// 但租赁模式必须选择，而且异店租赁的租赁物不录入编码（带码的）/名称（无码的）不允许发放（2026-11-19 用户明确）。
//   1) 开单表单：异店的租赁物「分类 + 领取门店」齐了就算录入完整，「去结算」可点；分类、领取门店、租赁模式仍然必须选；
//   2) 订单详情页：没录入编码/名称的异店租赁物，「发放」按钮换成突出的「录入装备」，点发放也不会弹确认（后端同样拒绝，见后端 CrossShopRentalTests）。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage } = require('./reception_harness.js')

const ROOT = path.join(__dirname, '..')

// ---------- 开单表单 ----------

function loadForm() {
  const dataPath = require.resolve('../utils/data.js')
  const file = require.resolve('../components/reception/rent_recept_form/rent_recept_form.js')
  const originalData = require.cache[dataPath]
  require.cache[dataPath] = { id: dataPath, filename: dataPath, loaded: true,
    exports: { getShopByNamePromise: async () => ({ id: 10 }), getRentPriceListPromise: async () => [] } }
  delete require.cache[file]
  let def = null
  global.Component = v => { def = v }
  global.wx = { showToast() {}, showLoading() {}, hideLoading() {}, showModal() {} }
  require(file)
  delete global.Component
  delete require.cache[file]
  const setByPath = (obj, key, value) => {
    const keys = key.replace(/\[(\d+)\]/g, '.$1').split('.')
    let cur = obj
    keys.slice(0, -1).forEach(k => { cur = cur[k] })
    cur[keys[keys.length - 1]] = value
  }
  const inst = {
    data: { displayRentals: [], expandedItem: {}, expandedPkg: {} },
    properties: { shop: '崇礼旗舰店' },
    setData(v, cb) { Object.keys(v).forEach(k => setByPath(this.data, k, v[k])); if (cb) cb() },
    triggerEvent() {},
  }
  Object.keys(def.methods).forEach(n => { inst[n] = def.methods[n].bind(inst) })
  inst._updateRentalChip = () => {}
  return { inst, restore() { delete global.wx; if (originalData) require.cache[dataPath] = originalData; else delete require.cache[dataPath] } }
}

const today = () => new Date().toISOString().slice(0, 10)
const rental = (items, extra) => Object.assign({ id: 7, name: '套餐', package_id: 41, category_id: 3, start_date: today() + 'T09:00:00', pricePresets: [], rentItems: items }, extra || {})
const crossItem = extra => Object.assign({ id: 1, name: '', code: '', noCode: false, category_id: 5, pick_type: '异店租赁', pickup_shop: '万龙体验中心', atOnce: false }, extra || {})

function evaluate(r) {
  const { inst, restore } = loadForm()
  try {
    inst._refreshRentals([r])
    const d = inst.data.displayRentals[0]
    return { rentalOk: d._rentalEntered, rentalLabel: d._rentalStatusLabel, items: d.rentItems.map(i => ({ ok: i._entered, label: i._statusLabel })), canCheckout: inst.data.summary && inst.data.summary.canCheckout }
  } finally { restore() }
}

test('异店租赁的租赁物：只选了分类和领取门店（带码、无码都一样），不用填编码或名称就能下单结算', () => {
  for (const noCode of [false, true]) {
    const r = evaluate(rental([crossItem({ noCode })], { pick_type: '异店租赁' }))
    assert.deepEqual(r.items, [{ ok: true, label: '异店待领取' }], `noCode=${noCode}`)
    assert.equal(r.rentalOk, true)
    assert.equal(r.canCheckout, true, '去结算可点')
  }
})

test('套餐里全是异店的租赁物：商品没单独选过模式，也按装备的异店租赁算，不报「模式未选」', () => {
  const r = evaluate(rental([crossItem({ id: 1 }), crossItem({ id: 2, category_id: 6 })], { pick_type: null }))
  assert.equal(r.rentalOk, true)
  assert.equal(r.canCheckout, true)
})

test('分类、领取门店、租赁模式仍然必须选：缺哪个都不能结算', () => {
  const noCategory = evaluate(rental([crossItem({ category_id: null })], { pick_type: '异店租赁' }))
  assert.deepEqual(noCategory.items, [{ ok: false, label: '分类未选' }])
  assert.equal(noCategory.canCheckout, false)

  const noShop = evaluate(rental([crossItem({ pickup_shop: null })], { pick_type: '异店租赁' }))
  assert.deepEqual(noShop.items, [{ ok: false, label: '领取门店未选' }])
  assert.equal(noShop.canCheckout, false)

  // 租赁物没选租赁模式（只有领取门店）：不算录入完整
  const noMode = evaluate(rental([crossItem({ pick_type: null })], { pick_type: '异店租赁' }))
  assert.equal(noMode.items[0].ok, false)
  assert.equal(noMode.canCheckout, false)

  // 商品和装备都没有任何模式：「模式未选」
  const nothing = evaluate(rental([{ id: 9, name: '', code: 'A1', noCode: false, category_id: 5, pick_type: null }], { pick_type: null }))
  assert.equal(nothing.rentalOk, false)
  assert.equal(nothing.rentalLabel, '模式未选')
})

test('异店的租赁物不影响同一个商品里本店租赁物的录入要求', () => {
  const r = evaluate(rental([crossItem(), { id: 2, name: '', code: '', noCode: false, category_id: 6, pick_type: '立即租赁', atOnce: true }], { pick_type: '立即租赁' }))
  assert.deepEqual(r.items, [{ ok: true, label: '异店待领取' }, { ok: false, label: '编码未填' }])
  assert.equal(r.rentalOk, false)
  assert.equal(r.rentalLabel, '1 件未录入')
})

// ---------- 订单详情页 ----------

const FILE = 'pages/admin/rent/rent_order_detail/rent_order_detail.js'
const WXML = fs.readFileSync(path.join(ROOT, 'pages/admin/rent/rent_order_detail/rent_order_detail.wxml'), 'utf8')

function render(items) {
  global.getApp = () => ({ globalData: { sessionKey: 'sk%20x', staff: { id: 28, title_level: 300 }, uiProfile: {} }, loginPromiseNew: Promise.resolve() })
  global.wx = { showModal() {}, showToast() {}, showLoading() {}, hideLoading() {} }
  try {
    const page = loadPage(FILE, {})
    const order = { id: 100, valid: 1, closed: 0, paidAmount: 0, totalGuarantyAmount: 0, availablePayments: [], retails: [],
      rentals: [{ id: 5, name: '套餐', entertain: false, rentItems: items, details: [], pricePresets: [], guaranty: 0 }] }
    return { page, rendered: page.renderOrder(order).rentals[0].rentItems }
  } finally { delete global.getApp; delete global.wx }
}
const item = extra => Object.assign({ id: 1, status: '未发放', noNeed: false, noCode: false, code: '', name: '', pickup_shop: '万龙体验中心', pick_type: '异店租赁' }, extra || {})

test('订单详情页：没录入编码/名称的异店租赁物标记为需要录入（带码看编码、无码看名称）', () => {
  const { rendered } = render([
    item({ id: 1 }),                                                    // 带码，没编码
    item({ id: 2, noCode: true }),                                      // 无码，没名称
    item({ id: 3, code: 'A310' }),                                      // 带码，已录入
    item({ id: 4, noCode: true, name: '雪鞋 红色' }),                    // 无码，已录入
    item({ id: 5, pickup_shop: null, pick_type: '立即租赁' }),            // 本店的租赁物不受影响
    item({ id: 6, status: '已发放' }),                                   // 已经发放的不再提示
    item({ id: 7, noNeed: true }),                                      // 不需要的不提示
    item({ id: 8, pickup_shop: null, pick_type: '异店租赁' }),            // 只有模式是异店也按异店算（后端同样）
  ])
  assert.deepEqual(rendered.map(i => i._needAssign), [true, true, false, false, false, false, false, true])
})

test('订单详情页：需要录入的异店租赁物不显示「发放」，「录入装备」突出显示', () => {
  const issue = WXML.slice(WXML.indexOf('bindtap="onItemPick"') - 260, WXML.indexOf('bindtap="onItemPick"') + 140)
  assert.match(issue, /!rentItem\._needAssign/, '发放按钮要排除需要录入的')
  assert.match(issue, /data-ridx="\{\{ridx\}\}" data-iidx="\{\{iidx\}\}"/, '发放要带位置，点击时才能再核对')
  const assign = WXML.slice(WXML.indexOf('bindtap="onCrossItemAssign"') - 200, WXML.indexOf('bindtap="onCrossItemAssign"') + 20)
  assert.match(assign, /rentItem\._needAssign \? 'rid-act--primary' : ''/)
})

test('点「发放」时再核对一遍：需要录入的不弹确认、只提示先录入', () => {
  const { page, rendered } = render([item({ id: 1 })])
  const calls = { modals: 0, toasts: [], picks: 0 }
  global.wx = { showModal() { calls.modals++ }, showToast(o) { calls.toasts.push(o.title) }, showLoading() {}, hideLoading() {} }
  try {
    page.setData({ order: { id: 100, rentals: [{ id: 5, rentItems: rendered }] } })
    page.onItemPick({ currentTarget: { dataset: { id: 1, ridx: 0, iidx: 0 } } })
  } finally { delete global.wx }
  assert.equal(calls.modals, 0, '不弹发放确认')
  assert.deepEqual(calls.toasts, ['请先录入装备（编码或名称）再发放'])
})

test('已经录入的异店租赁物仍然可以发放：弹发放确认', () => {
  const { page, rendered } = render([item({ id: 1, code: 'A310' })])
  const calls = { modals: [] }
  global.wx = { showModal(o) { calls.modals.push(o.title) }, showToast() {}, showLoading() {}, hideLoading() {} }
  try {
    page.setData({ order: { id: 100, rentals: [{ id: 5, rentItems: rendered }] } })
    page.onItemPick({ currentTarget: { dataset: { id: 1, ridx: 0, iidx: 0 } } })
  } finally { delete global.wx }
  assert.deepEqual(calls.modals, ['确认发放'])
})

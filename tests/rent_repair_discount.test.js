// 租赁订单详细页：赔偿除了金额，还要能设「赔偿减免」，并显示 赔偿金额 / 赔偿减免 / 实际赔偿（2026-11-14 用户要求）。
// 赔偿减免由后端挂在「赔偿金」明细上（已含在 rental.totalDiscountAmount 里），页面负责：
//   1) 赔偿弹窗多一个「赔偿减免」输入框，实时显示实际赔偿，提交时带 discount 参数；
//   2) 租赁物卡片、租赁商品的费用格、退款摘要都拆开显示三个金额（只在有赔偿时多出两格）；
//   3) 租赁商品的「减免」格只算租金这类减免，不重复算赔偿减免，各格相加才对得上。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const util = require('../utils/util.js')
const { loadPage, settle } = require('./reception_harness.js')

const FILE = 'pages/admin/rent/rent_order_detail/rent_order_detail.js'
const WXML = fs.readFileSync(path.join(__dirname, '../pages/admin/rent/rent_order_detail/rent_order_detail.wxml'), 'utf8')

function setup() {
  const calls = { toasts: [], requests: [] }
  const oldRequest = util.performWebRequest
  global.getApp = () => ({ globalData: { sessionKey: 'sk%20x', requestPrefix: 'https://t/api/', staff: { id: 28, title_level: 300 }, uiProfile: {} }, loginPromiseNew: Promise.resolve() })
  global.wx = { showToast(o) { calls.toasts.push(o.title) }, showModal() {}, showLoading() {}, hideLoading() {} }
  util.performWebRequest = (url) => { calls.requests.push(url); return Promise.resolve({ id: 1, rentItems: [] }) }
  const page = loadPage(FILE, {})
  const cleanup = () => { delete global.getApp; delete global.wx; util.performWebRequest = oldRequest }
  return { page, calls, cleanup }
}

const NOW = new Date().toISOString()
const itemOf = over => Object.assign({ id: 11, status: '已归还', noNeed: false, valid: 1, totalRepairationAmount: 0, totalRepairationDiscountAmount: 0 }, over)
const rentalOf = (over = {}) => Object.assign({
  id: 1, name: '【FIS】双板', guaranty: 3000, settled: 0, valid: 1, entertain: false, experience: false,
  rentItems: [itemOf()], details: [], pricePresets: [{ id: 1, rent_date: NOW, rent_type: '日场', price: 150, discount: 0 }],
  totalSummary: 0, totalDiscountAmount: 0, totalRepairationAmount: 0, totalRepairationDiscountAmount: 0, totalOvertimeAmount: 0, totalRentalAmount: 0
}, over)
const orderOf = (rentals, over = {}) => Object.assign({
  id: 100, valid: 1, closed: 0, paidAmount: 0, totalGuarantyAmount: 6000, rentals, availablePayments: [], retails: []
}, over)

// ---------- 显示：赔偿金额 / 赔偿减免 / 实际赔偿 ----------

test('租赁物：有赔偿时显示赔偿减免和实际赔偿（实际 = 赔偿 - 减免）', t => {
  const { page, cleanup } = setup(); t.after(cleanup)
  const o = page.renderOrder(orderOf([rentalOf({ rentItems: [
    itemOf({ id: 11, totalRepairationAmount: 100, totalRepairationDiscountAmount: 30 }),
    itemOf({ id: 12 })] })]))
  const [withRepair, without] = o.rentals[0].rentItems
  assert.equal(withRepair.totalRepairationAmountStr, '¥100.00')
  assert.equal(withRepair.totalRepairationDiscountAmountStr, '¥30.00')
  assert.equal(withRepair.actualRepairationAmountStr, '¥70.00')
  assert.equal(withRepair._hasRepair, true)
  assert.equal(without._hasRepair, false, '没有赔偿的租赁物不多出两行')
  assert.equal(without.actualRepairationAmountStr, '¥0.00')
})

test('租赁商品：赔偿减免单独一格，「减免」格不再重复算它', t => {
  const { page, cleanup } = setup(); t.after(cleanup)
  // 后端 totalDiscountAmount 含所有减免：租金减免 20 + 赔偿减免 30
  const o = page.renderOrder(orderOf([rentalOf({
    totalRepairationAmount: 100, totalRepairationDiscountAmount: 30, totalDiscountAmount: 50 })]))
  const r = o.rentals[0]
  assert.equal(r.totalDiscountAmountStr, '¥20.00')
  assert.equal(r.totalRepairationAmountStr, '¥100.00')
  assert.equal(r.totalRepairationDiscountAmountStr, '¥30.00')
  assert.equal(r.actualRepairationAmountStr, '¥70.00')
  assert.equal(r._hasRepair, true)
})

test('退款摘要：多个租赁的赔偿、赔偿减免、实际赔偿分别汇总；没有赔偿时不显示这两格', t => {
  const { page, cleanup } = setup(); t.after(cleanup)
  const o = page.renderOrder(orderOf([
    rentalOf({ id: 1, totalRepairationAmount: 100, totalRepairationDiscountAmount: 30, totalDiscountAmount: 30 }),
    rentalOf({ id: 2, totalRepairationAmount: 50, totalDiscountAmount: 0 })]))
  assert.equal(o.totalRentRepairationAmountStr, '¥150.00')
  assert.equal(o.totalRentRepairationDiscountAmountStr, '¥30.00')
  assert.equal(o.totalRentActualRepairationAmountStr, '¥120.00')
  assert.equal(o._hasRepair, true)

  const none = page.renderOrder(orderOf([rentalOf()]))
  assert.equal(none._hasRepair, false)
})

test('老后端没有赔偿减免字段：按 0 算，实际赔偿等于赔偿金额', t => {
  const { page, cleanup } = setup(); t.after(cleanup)
  const rental = rentalOf({ rentItems: [itemOf({ totalRepairationAmount: 80 })], totalRepairationAmount: 80 })
  delete rental.totalRepairationDiscountAmount
  delete rental.rentItems[0].totalRepairationDiscountAmount
  const o = page.renderOrder(orderOf([rental]))
  assert.equal(o.rentals[0].rentItems[0].totalRepairationDiscountAmountStr, '¥0.00')
  assert.equal(o.rentals[0].rentItems[0].actualRepairationAmountStr, '¥80.00')
  assert.equal(o.rentals[0].actualRepairationAmountStr, '¥80.00')
  assert.equal(o.totalRentActualRepairationAmountStr, '¥80.00')
})

test('模板：三处都有赔偿减免 / 实际赔偿，且只在有赔偿时显示', () => {
  for (const flag of ['rentItem._hasRepair', 'item._hasRepair', 'order._hasRepair']) {
    assert.ok(WXML.includes(`wx:if="{{${flag}}}"`) || WXML.includes(`rentItem.noNeed && ${flag}}}`), flag)
  }
  for (const field of ['rentItem.totalRepairationDiscountAmountStr', 'rentItem.actualRepairationAmountStr',
    'item.totalRepairationDiscountAmountStr', 'item.actualRepairationAmountStr',
    'order.totalRentRepairationDiscountAmountStr', 'order.totalRentActualRepairationAmountStr']) {
    assert.ok(WXML.includes(`{{${field}}}`), field)
  }
  // 弹窗里有赔偿减免输入框，并实时显示实际赔偿
  assert.ok(WXML.includes('bindinput="onRepairDiscountInput"'))
  assert.ok(WXML.includes('{{_repairActualStr}}'))
})

// ---------- 弹窗 ----------

function pageWithItem(setupResult, item) {
  const o = setupResult.page.renderOrder(orderOf([rentalOf({ rentItems: [item] })]))
  setupResult.page.setData({ order: o })
  return o
}
const tap = { currentTarget: { dataset: { ridx: 0, iidx: 0 } } }

test('点「赔偿」：弹窗带出原赔偿金额和原减免，并显示实际赔偿', t => {
  const s = setup(); t.after(s.cleanup)
  pageWithItem(s, itemOf({ id: 11, totalRepairationAmount: 100, totalRepairationDiscountAmount: 30 }))
  s.page.onItemRepairEdit(tap)
  assert.equal(s.page.data._repairShow, true)
  assert.equal(s.page.data._repairItemId, 11)
  assert.equal(s.page.data._repairAmountOrig, '100')
  assert.equal(s.page.data._repairDiscountOrig, '30')
  assert.equal(s.page.data._repairActualStr, '¥70.00')
})

test('输入赔偿金额或减免：实际赔偿实时更新', t => {
  const s = setup(); t.after(s.cleanup)
  pageWithItem(s, itemOf({ totalRepairationAmount: 100, totalRepairationDiscountAmount: 30 }))
  s.page.onItemRepairEdit(tap)
  s.page.onRepairInput({ detail: { value: '200' } })
  assert.equal(s.page.data._repairActualStr, '¥170.00', '减免留空沿用原来的 30')
  s.page.onRepairDiscountInput({ detail: { value: '50' } })
  assert.equal(s.page.data._repairActualStr, '¥150.00')
})

test('确认：请求带 amount 和 discount；两个输入都留空就沿用原值', async t => {
  const s = setup(); t.after(s.cleanup)
  pageWithItem(s, itemOf({ id: 11, totalRepairationAmount: 100, totalRepairationDiscountAmount: 30 }))
  s.page.refreshStatus = () => {}
  s.page.onItemRepairEdit(tap)
  s.page.onRepairDiscountInput({ detail: { value: '40' } })
  s.page.onRepairInput({ detail: { value: '150' } })
  s.page.onRepairConfirm()
  await settle()
  assert.equal(s.calls.requests.length, 1)
  assert.match(s.calls.requests[0], /Rent\/SetRentItemRepairAmount\/11\?amount=150&discount=40&sessionKey=sk%20x$/)

  s.page.onItemRepairEdit(tap)
  s.page.onRepairConfirm()
  await settle()
  assert.match(s.calls.requests[1], /\?amount=100&discount=30&/)
})

test('赔偿减免大于赔偿金额：提示并且不发请求；等于赔偿金额（全免）可以', async t => {
  const s = setup(); t.after(s.cleanup)
  pageWithItem(s, itemOf({ totalRepairationAmount: 100, totalRepairationDiscountAmount: 0 }))
  s.page.refreshStatus = () => {}
  s.page.onItemRepairEdit(tap)
  s.page.onRepairDiscountInput({ detail: { value: '100.5' } })
  s.page.onRepairConfirm()
  await settle()
  assert.deepEqual(s.calls.toasts, ['赔偿减免不能大于赔偿金额'])
  assert.equal(s.calls.requests.length, 0)

  s.page.onRepairDiscountInput({ detail: { value: '100' } })
  s.page.onRepairConfirm()
  await settle()
  assert.equal(s.calls.requests.length, 1)
  assert.match(s.calls.requests[0], /\?amount=100&discount=100&/)
})

test('只改小赔偿金额、减免留空：原减免超过新金额时按新金额封顶，不拦着店员', async t => {
  const s = setup(); t.after(s.cleanup)
  pageWithItem(s, itemOf({ totalRepairationAmount: 100, totalRepairationDiscountAmount: 30 }))
  s.page.refreshStatus = () => {}
  s.page.onItemRepairEdit(tap)
  s.page.onRepairInput({ detail: { value: '20' } })
  s.page.onRepairConfirm()
  await settle()
  assert.ok(!s.calls.toasts.includes('赔偿减免不能大于赔偿金额'), '没有校验提示（只有保存成功的提示）')
  assert.match(s.calls.requests[0], /\?amount=20&discount=20&/)
})

test('赔偿金额改成 0（取消赔偿）：减免一并是 0', async t => {
  const s = setup(); t.after(s.cleanup)
  pageWithItem(s, itemOf({ totalRepairationAmount: 100, totalRepairationDiscountAmount: 30 }))
  s.page.refreshStatus = () => {}
  s.page.onItemRepairEdit(tap)
  s.page.onRepairInput({ detail: { value: '0' } })
  s.page.onRepairConfirm()
  await settle()
  assert.match(s.calls.requests[0], /\?amount=0&discount=0&/)
})

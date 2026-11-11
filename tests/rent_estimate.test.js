// 租赁订单详情页：还没生成过租金明细（未支付/未取件，尚未开始计费）时，把「预计租金」显示给店员看（2026-11-09 用户要求）。
// 预计租金 = 开单时的价格预设（pricePresets，后端首日也是按这条预设收钱）；只用于展示，
// 不参与结算：totalSummary、应退押金等仍只算真实的租金明细。
// 三处显示：租赁卡片头部、展开后的租金格（含摘要行）、退款区「总计租金」。有预计时标签改成「预计租金」。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage } = require('./reception_harness.js')

const FILE = 'pages/admin/rent/rent_order_detail/rent_order_detail.js'
const WXML = fs.readFileSync(path.join(__dirname, '../pages/admin/rent/rent_order_detail/rent_order_detail.wxml'), 'utf8')

function page() {
  global.getApp = () => ({ globalData: { sessionKey: 'sk', staff: { id: 28, title_level: 300 }, uiProfile: {} }, loginPromiseNew: Promise.resolve() })
  global.wx = { showToast() {}, showModal() {}, showLoading() {}, hideLoading() {} }
  return loadPage(FILE, {})
}
function cleanup() { delete global.getApp; delete global.wx }

const NOW = new Date().toISOString()
const rentalOf = (over = {}) => Object.assign({
  id: 1, name: '【FIS】双板', guaranty: 3000, settled: 0, valid: 1, entertain: false, experience: false,
  rentItems: [], details: [], pricePresets: [{ id: 1, rent_date: NOW, rent_type: '日场', price: 150, discount: 0 }],
  totalSummary: 0, totalDiscountAmount: 0, totalRepairationAmount: 0, totalOvertimeAmount: 0, totalRentalAmount: 0
}, over)
const orderOf = (rentals, over = {}) => Object.assign({
  id: 100, valid: 1, closed: 0, paidAmount: 0, totalGuarantyAmount: 6000, rentals, availablePayments: [], retails: []
}, over)
const rentDetail = over => Object.assign({ id: 9, charge_type: '租金', valid: 1, amount: 150, rental_date: NOW, discounts: [] }, over)

test('未支付、还没有租金明细：租金显示预设价，并标记为预计', t => {
  t.after(cleanup)
  const o = page().renderOrder(orderOf([rentalOf()]))
  const r = o.rentals[0]
  assert.equal(r._rentIsEstimate, true)
  assert.equal(r._rentDisplayStr, '¥150.00')
})

test('预计租金只用于展示：真实的租金合计、应退押金不受影响', t => {
  t.after(cleanup)
  const o = page().renderOrder(orderOf([rentalOf()]))
  assert.equal(o.totalRentSummaryAmount, 0)
  assert.equal(o.totalRentSummaryAmountStr, '¥0.00')
  assert.equal(o.totalRentNeedToRefundAmount, 0)
  assert.equal(o.rentals[0].totalSummaryStr, '¥0.00')
})

test('退款区「总计租金」也显示预计，并标记为预计', t => {
  t.after(cleanup)
  const o = page().renderOrder(orderOf([rentalOf()]))
  assert.equal(o.totalRentDisplayStr, '¥150.00')
  assert.equal(o._totalRentIsEstimate, true)
})

test('已经有有效的租金明细：按真实明细显示，不标预计', t => {
  t.after(cleanup)
  const o = page().renderOrder(orderOf([rentalOf({ details: [rentDetail()], totalSummary: 150, totalRentalAmount: 150 })], { paidAmount: 6000 }))
  assert.equal(o.rentals[0]._rentIsEstimate, false)
  assert.equal(o.rentals[0]._rentDisplayStr, '¥150.00')
  assert.equal(o._totalRentIsEstimate, false)
  assert.equal(o.totalRentDisplayStr, '¥150.00')
})

test('租金明细被免除（只剩 valid=0）：是有意免除，不显示预计', t => {
  t.after(cleanup)
  const o = page().renderOrder(orderOf([rentalOf({ details: [rentDetail({ valid: 0 })] })]))
  assert.equal(o.rentals[0]._rentIsEstimate, false)
  assert.equal(o.rentals[0]._rentDisplayStr, '¥0.00')
})

test('订单已关闭、已作废，或租赁已结算：不显示预计', t => {
  t.after(cleanup)
  for (const [order, rental] of [[{ closed: 1 }, {}], [{ valid: 0 }, {}], [{}, { settled: 1 }]]) {
    const o = page().renderOrder(orderOf([rentalOf(rental)], order))
    assert.equal(o.rentals[0]._rentIsEstimate, false, JSON.stringify([order, rental]))
    assert.equal(o.rentals[0]._rentDisplayStr, '¥0.00')
  }
})

test('体验租赁、没有价格预设：不显示预计', t => {
  t.after(cleanup)
  const a = page().renderOrder(orderOf([rentalOf({ experience: true })]))
  assert.equal(a.rentals[0]._rentIsEstimate, false)
  const b = page().renderOrder(orderOf([rentalOf({ pricePresets: [] })]))
  assert.equal(b.rentals[0]._rentIsEstimate, false)
  assert.equal(b.rentals[0]._rentDisplayStr, '¥0.00')
})

test('订单里一件已计费、一件未开始：总计租金 = 真实租金 + 另一件的预计', t => {
  t.after(cleanup)
  const billed = rentalOf({ id: 1, details: [rentDetail()], totalSummary: 150, totalRentalAmount: 150 })
  const waiting = rentalOf({ id: 2, name: '头盔', pricePresets: [{ id: 2, rent_date: NOW, rent_type: '日场', price: 40, discount: 0 }] })
  const o = page().renderOrder(orderOf([billed, waiting], { paidAmount: 6000 }))
  assert.equal(o.totalRentSummaryAmount, 150)                 // 真实的只算已计费那件
  assert.equal(o.totalRentDisplayStr, '¥190.00')
  assert.equal(o._totalRentIsEstimate, true)
})

test('招待的租赁没有明细时仍显示预设价（原有行为不变），实付仍为 0', t => {
  t.after(cleanup)
  const o = page().renderOrder(orderOf([rentalOf({ entertain: true })]))
  assert.equal(o.rentals[0]._rentDisplayStr, '¥150.00')
  assert.equal(o.rentals[0]._rentPayableStr, '¥0.00')
  // 招待不计入总计租金，预计也不计
  assert.equal(o.totalRentDisplayStr, '¥0.00')
})

test('模板：三处租金标签随是否预计切换成「预计租金」，退款区总计租金用展示值', () => {
  const labelSwitch = /_rentIsEstimate \? '预计租金' : '租金'/g
  assert.ok((WXML.match(labelSwitch) || []).length >= 3, '头部、摘要行、租金格三处都要切换标签')
  assert.match(WXML, /_totalRentIsEstimate \? '预计租金' : '总计租金'/)
  assert.match(WXML, /\{\{order\.totalRentDisplayStr\}\}/)
})

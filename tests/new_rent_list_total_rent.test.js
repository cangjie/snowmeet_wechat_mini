// 租赁订单列表「总计租金」（2026-11-22 用户反馈：QJ_ZL_260108_00001 状态是「全部归还」，已经有 171 条租金记录，列表里总计租金却是 --）：
// 以前只有「了结关闭」的订单才汇总总计租金；现在装备都已归还、租金已经定下来、只是订单还没关闭的订单
// （全部归还 / 部分退押金 / 全额退押金）也显示，并标「未了结」。页上的租金合计仍只算已了结的订单；
// 还在租、部分归还、未开始的租金还在变，仍显示 --。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const DIR = path.join(__dirname, '../pages/admin/rent')
const WXML = fs.readFileSync(path.join(DIR, 'new_rent_list.wxml'), 'utf8')
const WXSS = fs.readFileSync(path.join(DIR, 'new_rent_list.wxss'), 'utf8')

function loadPage() {
  const pagePath = require.resolve('../pages/admin/rent/new_rent_list.js')
  delete require.cache[pagePath]
  let definition
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: {} })
  global.Page = value => { definition = value }
  require(pagePath)
  delete global.Page
  const instance = { data: JSON.parse(JSON.stringify(definition.data)), setData(values) { Object.assign(this.data, values) } }
  Object.keys(definition).forEach(name => { if (typeof definition[name] === 'function') instance[name] = definition[name].bind(instance) })
  return { instance, restore() { delete require.cache[pagePath]; delete global.getApp } }
}

// 一张租赁订单：租金 rent、减免 discount；rentStatus 决定列表里的状态
function order(id, rentStatus, rent, discount = 0, extra = {}) {
  return Object.assign({
    id, biz_date: '2026-01-08T12:47:38', totalCharge: 500, paidAmount: 500, refundAmount: 0, valid: 1,
    availablePayments: [{ status: '支付成功', pay_method: '微信支付', amount: 500 }],
    rentProperties: { rentStatus },
    rentals: [{ id: id * 10, entertain: false, totalRentalAmount: rent, totalDiscountAmount: discount, details: [], rentItems: [] }]
  }, extra)
}

function render(orders) {
  const { instance, restore } = loadPage()
  try {
    instance.renderOrders(orders, orders.length, 1, 50)
    return instance.data
  } finally { restore() }
}

test('全部归还但还没关闭的订单：显示总计租金，标未了结（QJ_ZL_260108_00001 那种）', () => {
  const data = render([order(1, '全部归还', 34230)])
  assert.equal(data.orders[0].displayedRental, 34230)
  assert.ok(data.orders[0].displayedRentalStr && data.orders[0].displayedRentalStr.includes('34230'))
  assert.equal(data.orders[0].displayedRentalPending, true)
})

test('部分退押金、全额退押金（还没关闭）也显示租金，标未了结', () => {
  const data = render([order(1, '部分退押金', 300), order(2, '全额退押金', 70, 10)])
  assert.deepEqual(data.orders.map(o => o.displayedRental), [300, 60])
  assert.deepEqual(data.orders.map(o => o.displayedRentalPending), [true, true])
})

test('还在租、部分归还、未开始、未支付：租金还在变，仍不显示', () => {
  const data = render(['租赁中', '部分归还', '未开始', '未支付'].map((s, i) => order(i + 1, s, 500)))
  data.orders.forEach(o => {
    assert.equal(o.displayedRental, 0, o.rentProperties.rentStatus)
    assert.ok(!o.displayedRentalStr, o.rentProperties.rentStatus)
    assert.equal(o.displayedRentalPending, false)
  })
})

test('了结关闭的订单：和以前一样显示，不标未了结，并计入页上的租金合计', () => {
  const data = render([order(1, '了结关闭', 430, 30)])
  assert.equal(data.orders[0].displayedRental, 400)
  assert.equal(data.orders[0].displayedRentalPending, false)
  assert.ok(data.totalRentalAmountStr.includes('400'))
})

test('页上的租金合计只算已了结的订单，未了结的不算进去', () => {
  const closedOnly = render([order(1, '了结关闭', 400)])
  const mixed = render([order(1, '了结关闭', 400), order(2, '全部归还', 34230)])
  assert.equal(mixed.totalRentalAmountStr, closedOnly.totalRentalAmountStr)
})

test('招待租赁：仍按租金明细显示毛租金，不标未了结', () => {
  const o = order(1, '全部归还', 0, 0, {
    rentals: [{ id: 10, entertain: true, totalRentalAmount: 0, totalDiscountAmount: 0, rentItems: [],
      details: [{ charge_type: '租金', valid: 1, amount: 180 }, { charge_type: '租金', valid: 0, amount: 999 }] }]
  })
  const data = render([o])
  assert.equal(data.orders[0].displayedRental, 180)
  assert.equal(data.orders[0].displayedRentalPending, false)
})

test('页面：总计租金后面有「（未了结）」，只在标了未了结且有金额时显示', () => {
  assert.match(WXML, /\{\{item\.displayedRentalStr \|\| '--'\}\}<text class="row-pending" wx:if="\{\{item\.displayedRentalPending && item\.displayedRentalStr\}\}">（未了结）<\/text>/)
  assert.match(WXSS, /\.row-pending\s*\{/)
})

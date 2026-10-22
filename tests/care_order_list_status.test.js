// 养护订单列表（pages/admin/care/care_order_list）的状态：与旧系统一样显示后端订单状态，没付成功的整张置灰
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage } = require('./reception_harness.js')

function order(id, extra) {
  return Object.assign({
    id, code: 'WF_YH_261022_0000' + id, biz_date: '2026-10-22T22:46:11',
    careProperties: { orderStatus: '正常订单', services: ' 打蜡 刮蜡' },
    cares: [{ id: id * 10 }], availablePayments: [], paidAmount: 0, refundAmount: 0, totalEarnAmount: 0
  }, extra)
}

function render(orders) {
  global.getApp = () => ({ globalData: {} })
  global.wx = {}
  const page = loadPage('pages/admin/care/care_order_list.js', { IMAGE_HOST: 'https://img.example' })
  page.renderOrders(orders, orders.length, 1, 50)
  delete global.getApp
  delete global.wx
  return page.data.orders
}

test('没付成功的单显示待支付并置灰，不再显示正常订单', () => {
  const [unpaid] = render([order(6, { orderStatus: '待支付' })])
  assert.equal(unpaid.statusLabel, '待支付')
  assert.equal(unpaid.statusClass, 'unpaid')
  assert.equal(unpaid.unpaid, true)
})

test('已付款、0 元已下单、部分支付、退款按订单状态显示，不置灰', () => {
  const list = render([
    order(5, { orderStatus: '支付成功', paidAmount: 0.01 }),
    order(4, { orderStatus: '已下单' }),
    order(3, { orderStatus: '部分支付', paidAmount: 50 }),
    order(2, { orderStatus: '全额退款', paidAmount: 10, refundAmount: 10 })
  ])
  assert.deepEqual(list.map(o => [o.statusLabel, o.statusClass, o.unpaid]), [
    ['支付成功', 'paid', false],
    ['已下单', 'paid', false],
    ['部分支付', 'partial', false],
    ['全额退款', 'refund', false]
  ])
})

test('待生成和订单关闭也算没付成功', () => {
  const list = render([order(7, { orderStatus: '待生成' }), order(8, { orderStatus: '订单关闭' })])
  assert.deepEqual(list.map(o => o.unpaid), [true, true])
})

test('没有装备的仍是临时订单（同旧版），不置灰', () => {
  const [temp] = render([order(9, { orderStatus: '待生成', careProperties: { orderStatus: '临时订单', services: '' }, cares: [] })])
  assert.equal(temp.statusLabel, '临时订单')
  assert.equal(temp.statusClass, 'temp')
  assert.equal(temp.unpaid, false)
})

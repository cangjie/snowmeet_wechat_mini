// 养护订单列表：去掉「会 / 散」标识，新增「新」标识（该顾客第一次下有效养护订单；后端 isNewCareCustomer 判定，页面只负责显示）
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage } = require('./reception_harness.js')

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
const wxml = read('pages/admin/care/care_order_list.wxml')
const wxss = read('pages/admin/care/care_order_list.wxss')
const js = read('pages/admin/care/care_order_list.js')
const tagCol = wxml.slice(wxml.indexOf('<view class="tag-col">'), wxml.indexOf('<view class="order-rows">'))

function loadList() {
  global.getApp = () => ({ globalData: {} })
  global.wx = {}
  const page = loadPage('pages/admin/care/care_order_list.js', { IMAGE_HOST: 'https://img.example' })
  delete global.getApp
  delete global.wx
  return page
}

function order(id, extra) {
  return Object.assign({
    id, code: 'WF_YH_26111' + id, biz_date: '2026-11-10T14:32:00', shop: '万龙服务中心',
    orderStatus: '支付成功', careProperties: { orderStatus: '正常订单', services: ' 热蜡' },
    cares: [{ id: id * 10, equipment: '双板', brand: 'ATOMIC', scale: '170', careImages: [], tasks: [] }],
    availablePayments: [], paidAmount: 300, refundAmount: 0, totalEarnAmount: 300
  }, extra)
}

test('标签列：不再有「会 / 散」，改成「新」，且只在后端标了 isNewCareCustomer 时显示', () => {
  assert.ok(!tagCol.includes('memberShip'), '标签列里不应再引用 memberShip')
  assert.ok(!tagCol.includes('tag--member'), '标签列里不应再有会员标签样式')
  const m = tagCol.match(/<text[^>]*wx:if="\{\{item\.isNewCareCustomer\}\}"[^>]*class="tag tag--new"[^>]*>新<\/text>/)
  assert.ok(m, '应有 <text wx:if="{{item.isNewCareCustomer}}" class="tag tag--new">新</text>')
})

test('标签列：原有的其它标签都还在（测 招 单 挂 减 质 非 卡 券）', () => {
  for (const t of ['tag--test', 'tag--entertain', 'tag--single', 'tag--credit', 'tag--discount', 'tag--warranty', 'tag--summer', 'tag--card', 'tag--ticket']) {
    assert.ok(tagCol.includes(t), '标签列缺少 ' + t)
  }
})

test('页面不再计算 memberShip（会/散），也不再有这个字段', () => {
  assert.ok(!/memberShip/.test(js), '页面 JS 里不应再有 memberShip')
  const page = loadList()
  page.renderOrders([order(1, { member: { real_name: '张三', following_wechat: 1 } }), order(2)], 2, 1, 50)
  assert.equal(page.data.orders[0].memberShip, undefined)
  assert.equal(page.data.orders[1].memberShip, undefined)
})

test('渲染不改动后端给的 isNewCareCustomer；称呼显示照旧', () => {
  const page = loadList()
  page.renderOrders([order(1, { isNewCareCustomer: true, member: { real_name: '张三', gender: '男', following_wechat: 1 } }), order(2, { isNewCareCustomer: false })], 2, 1, 50)
  assert.equal(page.data.orders[0].isNewCareCustomer, true)
  assert.equal(page.data.orders[1].isNewCareCustomer, false)
  assert.equal(page.data.orders[0].calledName, '张三 先生')
})

test('样式：有 .tag--new，且不再保留没人用的 .tag--member', () => {
  assert.match(wxss, /\.tag--new\s*\{[^}]*background[^}]*color[^}]*\}/)
  assert.ok(!wxss.includes('.tag--member'))
})

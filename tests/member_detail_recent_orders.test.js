// 会员详情页「最近订单」（2026-11-14 用户要求）：
//   每条前面留出图标位，先放订单类型图标（租赁=租、养护=养、零售=售、雪票=票）；
//   第一行：订单号 + 订单金额、减免金额、实际支付金额；
//   第二行：日期 + 用了优惠券显示券名，用了卡显示卡名（次卡再写「记几次，余几次」）。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const view = require('../utils/member_recent_orders.js')
const { loadPage, settle, tap } = require('./reception_harness.js')

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
const WXML = read('pages/admin/member/member_detail.wxml')
const WXSS = read('pages/admin/member/member_detail.wxss')

const RAW = [
  { id: 5, code: 'WF_YH_261114_00001', type: '养护', bizDate: '2026-11-14T10:00:00', totalAmount: 230, discountAmount: 30, paidAmount: 200,
    tickets: [{ name: '老顾客优惠券', count: 2 }], cards: [{ name: '张教练的学员卡', kind: 'coach', used: 1, remaining: null }] },
  { id: 4, code: 'WT_ZL_251227_00020', type: '租赁', bizDate: '2025-12-27T08:00:00', totalAmount: 0, discountAmount: 0, paidAmount: 5000,
    tickets: [], cards: [{ name: '租赁10次卡', kind: 'punch', used: 1, remaining: 9 }] },
  { id: 3, code: 'WT_LS_251225_00001', type: '零售', bizDate: '2025-12-25T08:00:00', totalAmount: 99, discountAmount: 0, paidAmount: 99, tickets: [], cards: [] },
  { id: 2, code: 'QJ_XP_251224_00001', type: '雪票', bizDate: '2025-12-24T08:00:00', totalAmount: 309, discountAmount: 0, paidAmount: 309,
    tickets: [{ name: '免费打蜡券', count: 1 }], cards: [{ name: '机打蜡季卡', kind: 'season', used: 3, remaining: null }] },
  { id: 1, code: 'XX_1', type: '聚合', bizDate: '2025-12-20T08:00:00', totalAmount: 1, discountAmount: 0, paidAmount: 1 }
]

test('订单类型图标：租赁=租、养护=养、零售=售、雪票=票，其它类型取第一个字', () => {
  const icon = type => view.recentOrderView({ id: 1, code: 'x', type, bizDate: '2026-11-14T10:00:00' }).icon
  assert.deepEqual(icon('租赁'), { char: '租', cls: 'rent' })
  assert.deepEqual(icon('养护'), { char: '养', cls: 'care' })
  assert.deepEqual(icon('零售'), { char: '售', cls: 'retail' })
  assert.deepEqual(icon('雪票'), { char: '票', cls: 'ski' })
  assert.deepEqual(icon('聚合'), { char: '聚', cls: 'other' })
  assert.deepEqual(icon(''), { char: '单', cls: 'other' })
  assert.deepEqual(icon(null), { char: '单', cls: 'other' })
})

test('第一行金额：订单金额、减免、实付各自格式化；旧后端没有这些字段时整段不显示', () => {
  const care = view.recentOrderView(RAW[0])
  assert.equal(care.hasAmounts, true)
  assert.deepEqual([care.totalStr, care.discountStr, care.paidStr], ['¥230.00', '¥30.00', '¥200.00'])
  assert.equal(care.hasDiscount, true)
  const rent = view.recentOrderView(RAW[1])
  assert.deepEqual([rent.totalStr, rent.discountStr, rent.paidStr], ['¥0.00', '¥0.00', '¥5000.00'])
  assert.equal(rent.hasDiscount, false)
  const old = view.recentOrderView({ id: 9, code: 'OLD', type: '租赁', bizDate: '2025-01-01T08:00:00' })
  assert.equal(old.hasAmounts, false)
  assert.deepEqual(old.uses, [])
})

test('第二行：用了券显示券名（多张同名带数量），用了卡显示卡名；次卡写记几次、余几次，季卡只写记几次，学员卡只有名称', () => {
  assert.deepEqual(view.recentOrderView(RAW[0]).uses, [
    { kind: 'ticket', text: '老顾客优惠券 ×2' }, { kind: 'card', text: '张教练的学员卡' }])
  assert.deepEqual(view.recentOrderView(RAW[1]).uses, [{ kind: 'card', text: '租赁10次卡 记1次，余9次' }])
  assert.deepEqual(view.recentOrderView(RAW[3]).uses, [
    { kind: 'ticket', text: '免费打蜡券' }, { kind: 'card', text: '机打蜡季卡 记3次' }])
  assert.deepEqual(view.recentOrderView(RAW[2]).uses, [])     // 没用券和卡：第二行只有日期
  assert.equal(view.recentOrderView(RAW[2]).dateStr, '2025-12-25')
})

function setup(t, member) {
  global.getApp = () => ({ globalData: { sessionKey: 'sk', staff: { id: 1, title_level: 300 } }, loginPromiseNew: Promise.resolve() })
  global.wx = { showToast() {}, navigateTo(o) { global.wx.nav = o.url } }
  t.after(() => { delete global.getApp; delete global.wx })
  const fake = {
    getMemberDetailByStaffPromise: () => Promise.resolve(member),
    getTagLibraryPromise: () => Promise.resolve({ tags: [] })
  }
  const page = loadPage('pages/admin/member/member_detail.js', fake)
  page.setData({ memberId: 30588 })
  return page
}

test('页面：最近订单按新的视图数据显示，分类 tab 和点击进详情不变', async t => {
  const page = setup(t, { id: 30588, name: '王', custom: [], recentOrders: RAW, punchCards: [] })
  page.getData(); await settle()
  const rows = page.data.filteredOrders
  assert.equal(rows.length, 5)
  assert.deepEqual(rows[0].icon, { char: '养', cls: 'care' })
  assert.equal(rows[1].uses[0].text, '租赁10次卡 记1次，余9次')
  assert.deepEqual(page.data.orderTabs, ['全部', '养护', '租赁', '零售', '雪票', '聚合'])
  page.onOrderTab(tap({ t: '租赁' }))
  assert.deepEqual(page.data.filteredOrders.map(o => o.id), [4])
  page.gotoOrder(tap({ id: 4, type: '租赁' }))
  assert.match(global.wx.nav, /rent_order_detail\?id=4/)
})

test('模板：每条订单前面是图标位（类型图标），第一行订单号 + 三个金额，第二行日期 + 券 / 卡', () => {
  const block = WXML.slice(WXML.indexOf('wx:for="{{filteredOrders}}"'), WXML.indexOf('order-empty'))
  const iconAt = block.indexOf('order-icons'), codeAt = block.indexOf('order-code')
  assert.ok(iconAt >= 0 && iconAt < codeAt, '图标位在订单号前面')
  assert.match(block, /class="type-ico type-ico--\{\{item\.icon\.cls\}\}">\{\{item\.icon\.char\}\}</)
  const line1 = block.slice(block.indexOf('order-line1'), block.indexOf('order-line2'))
  assert.ok(line1.includes('{{item.code}}'))
  for (const f of ['item.totalStr', 'item.discountStr', 'item.paidStr']) assert.ok(line1.includes(f), f)
  assert.match(line1, /wx:if="\{\{item\.hasAmounts\}\}"/)
  const line2 = block.slice(block.indexOf('order-line2'))
  assert.ok(line2.includes('{{item.dateStr}}') && line2.includes('item.uses') && line2.includes('{{u.text}}'))
  assert.equal(block.includes('{{item.type}} · {{item.dateStr}}'), false, '旧的「类型 · 日期」那行已经换掉')
})

test('样式：图标位、四种类型图标、两行、金额和券卡文字的样式都有定义', () => {
  for (const cls of ['.order-icons', '.type-ico', '.type-ico--rent', '.type-ico--care', '.type-ico--retail', '.type-ico--ski', '.type-ico--other',
    '.order-line1', '.order-line2', '.order-amt', '.order-use']) {
    assert.ok(WXSS.includes(cls), '缺少 ' + cls)
  }
})

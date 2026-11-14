// 会员详情页「最近订单」（2026-11-14 用户要求）：
//   每条前面留出图标位，先放订单类型图标（租赁=租、养护=养、零售=售、雪票=票）；
//   第一行：订单号 + 订单金额、减免金额、实际支付金额；
//   第二行：日期 + 用了优惠券显示券名，用了卡显示卡名（次卡再写「记几次，余几次」）。
// 同一天追加（2026-11-14 用户看了真机截图后）：图标位里类型图标后面，用了卡的加「卡」图标、用了券的加「券」图标、有减免的加「减」图标；
//   并且要把列出来的订单（随分类 tab 切换）的订单金额、减免、实付各合计一下，显示在列表上方。
// 再追加（2026-11-14 用户：租赁订单押金不能算实付）：支付里含租赁押金，所以每条改成「支付 · 退款 · 实付」，
//   实付 = 支付 − 退款（后端 recentOrders.refundAmount）；合计行同步；旧后端没有退款字段时只显示支付、不显示退款和实付。
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
  { id: 5, code: 'WF_YH_261114_00001', type: '养护', bizDate: '2026-11-14T10:00:00', totalAmount: 230, discountAmount: 30, paidAmount: 200, refundAmount: 20,
    tickets: [{ name: '老顾客优惠券', count: 2 }], cards: [{ name: '张教练的学员卡', kind: 'coach', used: 1, remaining: null }] },
  { id: 4, code: 'WT_ZL_251227_00020', type: '租赁', bizDate: '2025-12-27T08:00:00', totalAmount: 0, discountAmount: 0, paidAmount: 5000, refundAmount: 5000,
    tickets: [], cards: [{ name: '租赁10次卡', kind: 'punch', used: 1, remaining: 9 }] },
  { id: 3, code: 'WT_LS_251225_00001', type: '零售', bizDate: '2025-12-25T08:00:00', totalAmount: 99, discountAmount: 0, paidAmount: 99, refundAmount: 0, tickets: [], cards: [] },
  { id: 2, code: 'QJ_XP_251224_00001', type: '雪票', bizDate: '2025-12-24T08:00:00', totalAmount: 309, discountAmount: 0, paidAmount: 309, refundAmount: 0,
    tickets: [{ name: '免费打蜡券', count: 1 }], cards: [{ name: '机打蜡季卡', kind: 'season', used: 3, remaining: null }] },
  { id: 1, code: 'XX_1', type: '聚合', bizDate: '2025-12-20T08:00:00', totalAmount: 1, discountAmount: 0, paidAmount: 1, refundAmount: 0 }
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
  assert.deepEqual([care.hasNet, care.refundStr, care.netStr], [true, '¥20.00', '¥180.00'])      // 实付 = 支付 − 退款
  assert.equal(care.hasDiscount, true)
  const rent = view.recentOrderView(RAW[1])
  assert.deepEqual([rent.totalStr, rent.discountStr, rent.paidStr], ['¥0.00', '¥0.00', '¥5000.00'])
  assert.deepEqual([rent.hasNet, rent.refundStr, rent.netStr], [true, '¥5000.00', '¥0.00'])      // 押金全退：实付 0
  assert.equal(rent.hasDiscount, false)
  const old = view.recentOrderView({ id: 9, code: 'OLD', type: '租赁', bizDate: '2025-01-01T08:00:00' })
  assert.equal(old.hasAmounts, false)
  assert.deepEqual(old.uses, [])
  // 后端有金额但还没有退款字段：只显示支付，不显示退款和实付（不能把押金当实付）
  const noRefund = view.recentOrderView({ id: 9, code: 'X', type: '租赁', bizDate: '2025-01-01T08:00:00', totalAmount: 0, discountAmount: 0, paidAmount: 5000 })
  assert.deepEqual([noRefund.hasAmounts, noRefund.paidStr, noRefund.hasNet, noRefund.netStr], [true, '¥5000.00', false, ''])
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

test('图标位：类型图标后面，用了卡加「卡」、用了券加「券」、有减免加「减」，顺序固定为 卡 券 减', () => {
  const badges = o => view.recentOrderView(o).badges
  assert.deepEqual(badges(RAW[0]), [{ char: '卡', cls: 'card' }, { char: '券', cls: 'ticket' }, { char: '减', cls: 'discount' }])   // 学员卡 + 券 + 减免 30
  assert.deepEqual(badges(RAW[1]), [{ char: '卡', cls: 'card' }])                    // 次卡，没有券、没有减免
  assert.deepEqual(badges(RAW[2]), [])                                              // 什么都没用
  assert.deepEqual(badges(RAW[3]), [{ char: '卡', cls: 'card' }, { char: '券', cls: 'ticket' }])   // 季卡 + 券，减免 0
  assert.deepEqual(badges({ id: 9, code: 'OLD', type: '租赁' }), [])                  // 旧后端没有这些字段：不报错、没有图标
  // 只有减免、没有券和卡
  assert.deepEqual(badges({ id: 8, code: 'D', type: '零售', totalAmount: 100, discountAmount: 5, paidAmount: 95 }), [{ char: '减', cls: 'discount' }])
})

test('合计：列出的订单的订单金额、减免、实付各加起来，按分四舍五入；没有金额字段的订单不参与', () => {
  const views = RAW.map(view.recentOrderView)
  const all = view.summarize(views)
  assert.deepEqual(all, { show: true, count: 5, totalStr: '¥639.00', discountStr: '¥30.00', paidStr: '¥5609.00', hasNet: true, refundStr: '¥5020.00', netStr: '¥589.00' })
  const rentOnly = view.summarize(views.filter(v => v.type === '租赁'))
  assert.deepEqual(rentOnly, { show: true, count: 1, totalStr: '¥0.00', discountStr: '¥0.00', paidStr: '¥5000.00', hasNet: true, refundStr: '¥5000.00', netStr: '¥0.00' })
  // 浮点误差：0.1 + 0.2 之类要按分取整
  const floats = view.summarize([0.1, 0.2].map((n, i) => view.recentOrderView({ id: i, code: 'F' + i, type: '零售', totalAmount: n, discountAmount: n, paidAmount: n })))
  assert.deepEqual([floats.totalStr, floats.discountStr, floats.paidStr], ['¥0.30', '¥0.30', '¥0.30'])
  // 只要有一条订单没有退款字段，合计就不显示退款和实付（算不出净额）
  const mixed = view.summarize([view.recentOrderView(RAW[2]), view.recentOrderView({ id: 7, code: 'M', type: '租赁', totalAmount: 0, discountAmount: 0, paidAmount: 5000 })])
  assert.deepEqual([mixed.show, mixed.count, mixed.paidStr, mixed.hasNet], [true, 2, '¥5099.00', false])
  // 没有订单 / 旧后端（没有金额字段）：不显示合计
  assert.equal(view.summarize([]).show, false)
  assert.equal(view.summarize([view.recentOrderView({ id: 1, code: 'OLD', type: '租赁' })]).show, false)
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
  assert.equal(page.data.orderSummary.count, 5)
  assert.equal(page.data.orderSummary.paidStr, '¥5609.00')
  page.onOrderTab(tap({ t: '租赁' }))
  assert.deepEqual(page.data.filteredOrders.map(o => o.id), [4])
  assert.deepEqual(page.data.orderSummary, { show: true, count: 1, totalStr: '¥0.00', discountStr: '¥0.00', paidStr: '¥5000.00', hasNet: true, refundStr: '¥5000.00', netStr: '¥0.00' })   // 合计随分类切换重算
  page.onOrderTab(tap({ t: '全部' }))
  assert.equal(page.data.orderSummary.count, 5)
  page.onOrderTab(tap({ t: '租赁' }))
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
  for (const f of ['item.totalStr', 'item.discountStr', 'item.paidStr', 'item.refundStr', 'item.netStr']) assert.ok(line1.includes(f), f)
  assert.match(line1, /wx:if="\{\{item\.hasNet\}\}"/)
  assert.ok(line1.indexOf('item.paidStr') < line1.indexOf('item.refundStr') && line1.indexOf('item.refundStr') < line1.indexOf('item.netStr'), '顺序：支付 → 退款 → 实付')
  assert.equal(/实付\{\{item\.paidStr\}\}/.test(line1), false, '支付金额不能再叫实付')
  assert.match(line1, /wx:if="\{\{item\.hasAmounts\}\}"/)
  const line2 = block.slice(block.indexOf('order-line2'))
  assert.ok(line2.includes('{{item.dateStr}}') && line2.includes('item.uses') && line2.includes('{{u.text}}'))
  assert.equal(block.includes('{{item.type}} · {{item.dateStr}}'), false, '旧的「类型 · 日期」那行已经换掉')
})

test('模板：图标位里类型图标后面循环显示 卡 / 券 / 减 图标；列表上方有合计行（订单数、订单金额、减免、实付）', () => {
  const block = WXML.slice(WXML.indexOf('order-icons'), WXML.indexOf('order-line1'))
  assert.match(block, /wx:for="\{\{item\.badges\}\}"/)
  assert.match(block, /class="type-ico type-ico--\{\{b\.cls\}\}">\{\{b\.char\}\}</)
  assert.ok(block.indexOf('item.icon.char') < block.indexOf('b.char'), '类型图标在前')
  const card = WXML.slice(WXML.indexOf('最近订单'), WXML.indexOf('名下优惠券'))
  const sumAt = card.indexOf('order-sum'), listAt = card.indexOf('wx:for="{{filteredOrders}}"')
  assert.ok(sumAt >= 0 && sumAt < listAt, '合计行在订单列表上方')
  const sum = card.slice(sumAt, listAt)
  for (const f of ['orderSummary.count', 'orderSummary.totalStr', 'orderSummary.discountStr', 'orderSummary.paidStr', 'orderSummary.refundStr', 'orderSummary.netStr']) assert.ok(sum.includes(f), f)
  assert.match(sum, /wx:if="\{\{orderSummary\.hasNet\}\}"/)
  assert.match(sum, /wx:if="\{\{orderSummary\.show\}\}"/)
})

test('样式：图标位里的图标竖着排（一列，不换行），类型图标在最上面', () => {
  const rule = WXSS.match(/\.order-row \.order-icons\s*\{[^}]*\}/)
  assert.ok(rule, '找到图标位样式')
  assert.match(rule[0], /flex-direction:\s*column/)
  assert.equal(/flex-wrap:\s*wrap/.test(rule[0]), false, '不能再两列换行')
})

test('样式：图标位、四种类型图标、两行、金额和券卡文字的样式都有定义', () => {
  for (const cls of ['.order-icons', '.type-ico', '.type-ico--rent', '.type-ico--care', '.type-ico--retail', '.type-ico--ski', '.type-ico--other',
    '.order-line1', '.order-line2', '.order-amt', '.order-use', '.type-ico--card', '.type-ico--ticket', '.type-ico--discount', '.order-sum', '.order-amt--refund', '.order-amt--net']) {
    assert.ok(WXSS.includes(cls), '缺少 ' + cls)
  }
})

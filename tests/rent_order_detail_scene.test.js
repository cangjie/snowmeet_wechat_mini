// 租赁订单详情页显示租金是「门市价」还是「预约价」（2026-11-15 用户要求）。
// 来源：每天租金明细 rental_detail.scene（后端按开单时选的价目生成；连租按预约价封顶的那天也记预约）；
// 历史明细没有 scene 时看价格预设，再没有就按门市价；一单里两种都有就写「门市价、预约价」。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage } = require('./reception_harness.js')

const DIR = path.join(__dirname, '../pages/admin/rent/rent_order_detail')
const WXML = fs.readFileSync(path.join(DIR, 'rent_order_detail.wxml'), 'utf8')
const WXSS = fs.readFileSync(path.join(DIR, 'rent_order_detail.wxss'), 'utf8')
const FILE = 'pages/admin/rent/rent_order_detail/rent_order_detail.js'

function render(rental) {
  global.getApp = () => ({ globalData: { sessionKey: 'sk%20x', staff: { id: 28, title_level: 300 }, uiProfile: {} }, loginPromiseNew: Promise.resolve() })
  global.wx = { showModal() {}, showToast() {}, showLoading() {}, hideLoading() {} }
  try {
    const page = loadPage(FILE, {})
    const order = { id: 100, valid: 1, closed: 0, paidAmount: 0, totalGuarantyAmount: 0, availablePayments: [], retails: [],
      rentals: [Object.assign({ id: 5, name: '套餐', entertain: false, rentItems: [], details: [], pricePresets: [], guaranty: 0 }, rental)] }
    return page.renderOrder(order).rentals[0]
  } finally { delete global.getApp; delete global.wx }
}
const rent = (date, amount, scene, extra) => Object.assign({
  id: Math.floor(Math.random() * 1e6), charge_type: '租金', valid: 1, rental_date: date + 'T00:00:00', amount, scene,
}, extra || {})

test('每天的租金记录带 scene：整单显示预约价，每天各带一个标签', () => {
  const r = render({ details: [rent('2026-11-15', 190, '预约'), rent('2026-11-16', 190, '预约')] })
  assert.equal(r._priceScene, '预约')
  assert.equal(r._priceSceneStr, '预约价')
  assert.equal(r._priceSceneClass, 'reserve')
  assert.deepEqual(r.feeRows.map(x => [x.dateStr, x.sceneStr]), [['2026-11-15', '预约价'], ['2026-11-16', '预约价']])
})

test('门市价的租赁：显示门市价', () => {
  const r = render({ details: [rent('2026-11-15', 260, '门市')] })
  assert.equal(r._priceSceneStr, '门市价')
  assert.equal(r._priceSceneClass, 'shop')
  assert.equal(r.feeRows[0].sceneStr, '门市价')
})

test('第一天门市、连租后封顶按预约：整单写「门市价、预约价」，逐天各自的标签', () => {
  const r = render({ details: [rent('2026-11-15', 260, '门市'), rent('2026-11-16', 190, '预约')] })
  assert.equal(r._priceSceneStr, '门市价、预约价')
  assert.equal(r._priceSceneClass, 'reserve', '带预约的用预约色提醒')
  assert.deepEqual(r.feeRows.map(x => x.sceneStr), ['门市价', '预约价'])
})

test('历史订单（明细没有 scene）：整单按价格预设，没有预设就是门市价；逐天不显示标签', () => {
  const old = render({ details: [rent('2026-11-01', 260, null), rent('2026-11-02', 260, undefined)] })
  assert.equal(old._priceSceneStr, '门市价')
  assert.deepEqual(old.feeRows.map(x => x.sceneStr), ['', ''])

  const preset = render({
    details: [rent('2026-11-01', 190, null)],
    pricePresets: [{ id: 1, scene: '预约', price: 190, rent_date: '2026-11-01' }],
  })
  assert.equal(preset._priceSceneStr, '预约价')
  assert.equal(preset.feeRows[0].sceneStr, '')
})

test('只看有效的租金明细：免除（valid=0）的和超时费不影响价目场景', () => {
  const r = render({
    details: [
      rent('2026-11-15', 260, '门市'),
      rent('2026-11-16', 190, '预约', { valid: 0 }),
      { id: 3, charge_type: '超时费', valid: 1, rental_date: '2026-11-15T00:00:00', amount: 30, scene: '预约' },
    ],
  })
  assert.equal(r._priceSceneStr, '门市价')
})

test('会员价（以后有的话）显示会员价', () => {
  const r = render({ details: [rent('2026-11-15', 180, '会员')] })
  assert.equal(r._priceSceneStr, '会员价')
  assert.equal(r._priceSceneClass, 'member')
})

test('页面里三处显示：折叠头、展开后的租金汇总、租金明细每天一行', () => {
  const head = WXML.slice(WXML.indexOf('rental-head-meta'), WXML.indexOf('rental-head-meta') + 400)
  assert.match(head, /scene-tag scene-tag--\{\{item\._priceSceneClass\}\}/)
  assert.match(head, /\{\{item\._priceSceneStr\}\}/)

  const summaryStart = WXML.indexOf('rental-showcase-summary')
  const summary = WXML.slice(summaryStart, summaryStart + 900)
  assert.match(summary, /scene-tag scene-tag--\{\{item\._priceSceneClass\}\}/)

  const rowStart = WXML.indexOf('wx:for="{{item.feeRows}}"')
  const row = WXML.slice(rowStart, rowStart + 900)
  assert.match(row, /scene-tag scene-tag--\{\{row\.sceneClass\}\}" wx:if="\{\{row\.sceneStr\}\}"/)
})

test('标签样式：门市灰、预约蓝、会员金，日期列竖排放得下', () => {
  assert.match(WXSS, /\.scene-tag--shop\s*\{[^}]*background/)
  assert.match(WXSS, /\.scene-tag--reserve\s*\{[^}]*background/)
  assert.match(WXSS, /\.scene-tag--member\s*\{[^}]*background/)
  assert.match(WXSS, /\.detail-col-date\s*\{[^}]*flex-direction: column/)
})

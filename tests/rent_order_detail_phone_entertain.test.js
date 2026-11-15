// 租赁订单明细页两处改动（2026-11-15 用户截图反馈）：
//   1) 手机号显示不全（被截成「155075…」）：手机号 + 复制按钮按内容撑开、完整显示，门店放不下时折到下一行；
//   2) 招待：原来整格可点、容易误触，改成复选框——只有那个小方框响应点击，点了仍先弹窗二次确认，确认后才保存。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, settle } = require('./reception_harness.js')

const DIR = path.join(__dirname, '../pages/admin/rent/rent_order_detail')
const WXML = fs.readFileSync(path.join(DIR, 'rent_order_detail.wxml'), 'utf8')
const WXSS = fs.readFileSync(path.join(DIR, 'rent_order_detail.wxss'), 'utf8')
const FILE = 'pages/admin/rent/rent_order_detail/rent_order_detail.js'

// 取出 wxss 里某个选择器的声明块
function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(escaped + '\\s*\\{([^}]*)\\}').exec(WXSS)
  assert.ok(m, `wxss 里没有 ${selector}`)
  return m[1].replace(/\s+/g, ' ').trim()
}

// ---------- 手机号 ----------

test('手机号一行：手机号不再被截断，复制按钮仍紧跟在号码后面', () => {
  const start = WXML.indexOf('kv-row--phone')
  assert.ok(start > 0, '手机号这一行要带 kv-row--phone')
  const block = WXML.slice(start, WXML.indexOf('开单店员', start))
  assert.match(block, /kv-cell kv-cell--phone/)
  assert.match(block, /<phone-copy phone="\{\{order\.customerCell\}\}" \/>/)
  assert.ok(block.indexOf('order.customerCell || ') < block.indexOf('<phone-copy'), '复制按钮在号码后面')
  assert.ok(block.indexOf('kv-cell--shop') > block.indexOf('<phone-copy'), '门店在手机号这一格后面')

  const valueRule = rule('.kv-row--phone .kv-cell--phone .kv-value')
  assert.match(valueRule, /overflow: visible/)
  assert.match(valueRule, /text-overflow: clip/, '不再用省略号截断')
  assert.match(valueRule, /white-space: nowrap/)
  assert.match(valueRule, /flex: 0 0 auto/, '按内容撑开，不再和门店平分宽度')
  assert.match(rule('.kv-row--phone .kv-cell--phone'), /flex: 0 0 auto/)
  assert.match(rule('.kv-row--phone'), /flex-wrap: wrap/, '放不下时门店折到下一行，不挤手机号')
  assert.match(rule('.kv-row--phone .kv-cell--shop'), /min-width: \d+rpx/)
})

test('其它双列行不受影响：通用的 kv-row--dual / kv-cell 规则没有被改成不截断', () => {
  assert.match(rule('.kv-cell'), /overflow: hidden/)
  assert.doesNotMatch(rule('.kv-row--dual'), /flex-wrap/)
  assert.match(rule('.kv-value--nowrap'), /text-overflow: ellipsis/)
})

// ---------- 招待复选框 ----------

test('招待：不再是整格可点的「是/否」，改成复选框，只有方框响应点击', () => {
  // 整个页面里只有一个地方绑定 onToggleEntertain，且是复选框方框
  const bindings = WXML.match(/bindtap="onToggleEntertain"/g) || []
  assert.equal(bindings.length, 1)
  const at = WXML.indexOf('bindtap="onToggleEntertain"')
  const tag = WXML.slice(WXML.lastIndexOf('<view', at), WXML.indexOf('>', at) + 1)
  assert.match(tag, /class="entertain-check \{\{item\.entertain \? 'entertain-check--on' : ''\}\}"/)
  assert.match(tag, /data-ridx="\{\{ridx\}\}"/)
  // 勾选时显示对勾
  assert.match(WXML.slice(at, at + 260), /<van-icon wx:if="\{\{item\.entertain\}\}" name="success"/)
  // 招待所在的格子本身不再有点击和编辑图标
  const cellStart = WXML.lastIndexOf('<view class="rental-showcase-fee-cell', WXML.lastIndexOf('招待</text>', at))
  const cell = WXML.slice(cellStart, at)
  assert.doesNotMatch(cell, /bindtap|--tappable|name="edit"/)
  assert.doesNotMatch(WXML, /item\.entertain \? '是' : '否'/)
})

test('复选框样式：方框，勾选后橙色填充', () => {
  assert.match(rule('.entertain-check'), /width: 44rpx/)
  assert.match(rule('.entertain-check'), /border-radius: \d+rpx/)
  assert.match(rule('.entertain-check--on'), /background: #d97706/)
})

function setup({ confirm = true } = {}) {
  const calls = { modals: [], entertain: [], toasts: [] }
  global.getApp = () => ({ globalData: { sessionKey: 'sk%20x', staff: { id: 28, title_level: 300 }, uiProfile: {} }, loginPromiseNew: Promise.resolve() })
  global.wx = {
    showModal(o) { calls.modals.push(o); o.success({ confirm }) },
    showToast(o) { calls.toasts.push(o.title) }, showLoading() {}, hideLoading() {},
  }
  const fakeData = {
    setRentalEntertainPromise(rentalId, entertain, scene, sessionKey) {
      calls.entertain.push([rentalId, entertain, scene, sessionKey])
      return Promise.resolve({ id: rentalId, entertain, rentItems: [], details: [], pricePresets: [], guaranty: 0 })
    },
  }
  const page = loadPage(FILE, fakeData)
  const order = { id: 100, valid: 1, closed: 0, paidAmount: 0, totalGuarantyAmount: 0, availablePayments: [], retails: [],
    rentals: [{ id: 5, name: '套餐', entertain: false, rentItems: [], details: [], pricePresets: [], guaranty: 0 }] }
  page.setData({ order: page.renderOrder(order) })
  return { page, calls, cleanup: () => { delete global.getApp; delete global.wx } }
}
const tap = { currentTarget: { dataset: { ridx: 0 } } }

test('点复选框：先弹窗确认；确认后才保存并刷新', async t => {
  const { page, calls, cleanup } = setup(); t.after(cleanup)
  page.onToggleEntertain(tap)
  await settle()
  assert.equal(calls.modals.length, 1)
  assert.equal(calls.modals[0].title, '设为招待')
  assert.deepEqual(calls.entertain, [[5, true, '租赁订单详细页设置招待', 'sk%20x']])
  assert.equal(page.data.order.rentals[0].entertain, true)
  assert.deepEqual(calls.toasts, ['已设为招待'])
})

test('弹窗里点取消：什么都不保存，招待保持原样（误触也不会改）', async t => {
  const { page, calls, cleanup } = setup({ confirm: false }); t.after(cleanup)
  page.onToggleEntertain(tap)
  await settle()
  assert.equal(calls.modals.length, 1)
  assert.deepEqual(calls.entertain, [])
  assert.equal(page.data.order.rentals[0].entertain, false)
})

test('已是招待时再点：弹的是「取消招待」，确认后撤销', async t => {
  const { page, calls, cleanup } = setup(); t.after(cleanup)
  page.data.order.rentals[0].entertain = true
  page.onToggleEntertain(tap)
  await settle()
  assert.equal(calls.modals[0].title, '取消招待')
  assert.deepEqual(calls.entertain.map(c => c[1]), [false])
})

// 租赁订单重开（2026-11-22 用户要求）：已关闭的订单可以重开，沿用后端老接口 Order/SetOrderCloseStatus；
// 每次关闭、重开的时间和操作的员工在订单详情页显示，列表可折叠（默认折叠）。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, settle } = require('./reception_harness.js')

const FILE = 'pages/admin/rent/rent_order_detail/rent_order_detail.js'
const DIR = path.join(__dirname, '../pages/admin/rent/rent_order_detail')
const WXML = fs.readFileSync(path.join(DIR, 'rent_order_detail.wxml'), 'utf8')
const WXSS = fs.readFileSync(path.join(DIR, 'rent_order_detail.wxss'), 'utf8')

const HISTORY = [
  { action: '关闭', time: '2026-11-20T12:37:36', staffId: null, staffName: '系统自动', auto: true, memo: '系统自动关单（重开前补记）' },
  { action: '重开', time: '2026-11-22T14:40:05', staffId: 28, staffName: '张三', auto: false, memo: '订单详情页重开订单' },
  { action: '关闭', time: '2026-11-22T15:01:09', staffId: 29, staffName: '李四', auto: false, memo: null },
]

function setup(options = {}) {
  const calls = { reopen: [], history: [], modals: [], toasts: [], getData: 0 }
  const staff = options.staff === undefined ? { id: 28, title_level: 300 } : options.staff
  global.getApp = () => ({ globalData: { sessionKey: 'sk%20x', staff, uiProfile: {} }, loginPromiseNew: Promise.resolve() })
  global.wx = {
    showModal(o) { calls.modals.push(o); if (o.success) o.success({ confirm: options.confirm !== false }) },
    showToast(o) { calls.toasts.push(o.title) },
    showLoading() {}, hideLoading() {}
  }
  const fakeData = {
    reopenOrderByStaffPromise(id, key) {
      calls.reopen.push([id, key])
      if (options.reopenPromise) return options.reopenPromise
      return options.reopenFails ? Promise.reject('订单没有关闭，不用重开') : Promise.resolve({ id })
    },
    getOrderCloseHistoryPromise(id, key) {
      calls.history.push([id, key])
      return options.historyFails ? Promise.reject('没有权限') : Promise.resolve(options.history || HISTORY)
    },
    getOrderByStaffPromise() {
      return Promise.resolve({ id: 5, valid: 1, closed: 1, paidAmount: 0, totalGuarantyAmount: 0,
        availablePayments: [], retails: [], rentals: [], close_date: '2026-11-20T12:37:36' })
    }
  }
  const page = loadPage(FILE, fakeData)
  // 公共装载器的 setData 不执行回调，这里按小程序语义补上（getData 加载完订单后在回调里拉记录）
  const baseSetData = page.setData
  page.setData = function (patch, cb) { baseSetData.call(this, patch); if (typeof cb === 'function') cb() }
  page.setData({ id: 5, _canCloseOrder: !!(staff && staff.title_level >= 100) })
  return { page, calls }
}

function cleanup() {
  delete global.getApp
  delete global.wx
}

// ---------------- 重开按钮 ----------------

test('点「订单重开」：先弹窗说明；取消就不请求、不重新加载', async t => {
  t.after(cleanup)
  const { page, calls } = setup({ confirm: false })
  let reloaded = 0
  page.getData = () => { reloaded++ }
  page.onReopenOrder()
  await settle()
  assert.equal(calls.modals.length, 1)
  assert.match(calls.modals[0].content, /夜间不会自动再关闭/)
  assert.match(calls.modals[0].content, /订单关闭/)
  assert.deepEqual(calls.reopen, [])
  assert.equal(reloaded, 0)
})

test('确认重开：调一次重开接口（订单号、会话），成功提示后重新加载订单', async t => {
  t.after(cleanup)
  const { page, calls } = setup()
  let reloaded = 0
  page.getData = () => { reloaded++ }
  page.onReopenOrder()
  await settle()
  assert.deepEqual(calls.reopen, [[5, 'sk%20x']])
  assert.deepEqual(calls.toasts, ['订单已重开'])
  assert.equal(reloaded, 1)
})

test('后端拒绝重开：不提示成功、不重新加载，还能再点', async t => {
  t.after(cleanup)
  const { page, calls } = setup({ reopenFails: true })
  let reloaded = 0
  page.getData = () => { reloaded++ }
  page.onReopenOrder()
  await settle()
  assert.deepEqual(calls.toasts, [])
  assert.equal(reloaded, 0)
  page.onReopenOrder()
  await settle()
  assert.equal(calls.reopen.length, 2)
})

test('重开请求还没回来时再点：不重复请求', async t => {
  t.after(cleanup)
  let finish
  const { page, calls } = setup({ reopenPromise: new Promise(resolve => { finish = resolve }) })
  let reloaded = 0
  page.getData = () => { reloaded++ }
  page.onReopenOrder()
  page.onReopenOrder()
  await settle()
  assert.equal(calls.modals.length, 1)
  assert.equal(calls.reopen.length, 1)
  finish({ id: 5 })
  await settle()
  assert.equal(reloaded, 1)
})

// ---------------- 关闭 / 重开记录 ----------------

test('加载订单后拉记录：每行带动作、时间、操作人，系统自动关单显示「系统自动」', async t => {
  t.after(cleanup)
  const { page, calls } = setup()
  page.getData()
  await settle()
  assert.deepEqual(calls.history, [[5, 'sk%20x']])
  const rows = page.data._closeHistory
  assert.deepEqual(rows.map(r => [r.kind, r.action, r.staffName]),
    [['close', '关闭', '系统自动'], ['reopen', '重开', '张三'], ['close', '关闭', '李四']])
  assert.equal(rows[0].timeStr, '2026-11-20 12:37:36')
  assert.equal(rows[1].timeStr, '2026-11-22 14:40:05')
})

test('员工职级低于 100：不拉记录，列表为空', async t => {
  t.after(cleanup)
  const { page, calls } = setup({ staff: { id: 1, title_level: 50 } })
  page.loadCloseHistory()
  await settle()
  assert.deepEqual(calls.history, [])
  assert.deepEqual(page.data._closeHistory, [])
})

test('记录拉取失败：不影响订单页，列表保持为空', async t => {
  t.after(cleanup)
  const { page } = setup({ historyFails: true })
  page.loadCloseHistory()
  await settle()
  assert.deepEqual(page.data._closeHistory, [])
})

test('记录默认折叠，点标题展开、再点收起', async t => {
  t.after(cleanup)
  const { page } = setup()
  assert.equal(page.data._closeHistoryExpanded, false)
  page.onToggleCloseHistory()
  assert.equal(page.data._closeHistoryExpanded, true)
  page.onToggleCloseHistory()
  assert.equal(page.data._closeHistoryExpanded, false)
})

// ---------------- 页面结构 ----------------

test('「订单重开」卡片：订单已关闭、有关闭时间、员工有权限才显示', () => {
  assert.match(WXML, /wx:if="\{\{order\.closed == 1 && order\.close_date && _canCloseOrder\}\}"/)
  assert.match(WXML, /bind:click="onReopenOrder"/)
})

test('记录卡片：有权限且有记录才显示；行只在展开后渲染（可折叠）', () => {
  assert.match(WXML, /wx:if="\{\{_canCloseOrder && _closeHistory\.length > 0\}\}"/)
  assert.match(WXML, /bindtap="onToggleCloseHistory"/)
  const toggle = WXML.indexOf('onToggleCloseHistory')
  const expandedBlock = WXML.indexOf('<block wx:if="{{_closeHistoryExpanded}}">', toggle)
  const rows = WXML.indexOf('wx:for="{{_closeHistory}}"', toggle)
  assert.ok(expandedBlock > toggle && rows > expandedBlock, '行在展开的 block 里面')
  assert.ok(WXML.includes('{{item.timeStr}}') && WXML.includes('{{item.staffName}}') && WXML.includes('{{item.action}}'))
})

test('页面最下方依次是：订单关闭、订单重开、关闭/重开记录', () => {
  const close = WXML.indexOf('bind:click="onCloseOrder"')
  const reopen = WXML.indexOf('bind:click="onReopenOrder"')
  const history = WXML.indexOf('onToggleCloseHistory')
  const loading = WXML.indexOf('<view wx:else class="page-loading">')
  assert.ok(close > 0 && reopen > close && history > reopen && loading > history)
})

test('记录样式：关闭和重开的标签颜色不同', () => {
  assert.match(WXSS, /\.close-log-action--close\s*\{/)
  assert.match(WXSS, /\.close-log-action--reopen\s*\{/)
})

// ---------------- data.js ----------------

test('data.js：重开是 GET Order/SetOrderCloseStatus/{订单号}?closed=false，记录是 GET Order/GetOrderCloseHistory/{订单号}', async t => {
  const requests = []
  global.getApp = () => ({ globalData: { requestPrefix: 'https://api.test/api/', domainName: 'api.test', sessionKey: 'sk' } })
  global.wx = {
    request(o) { requests.push(o); o.success({ statusCode: 200, data: { code: 0, message: '', data: [] } }) },
    showToast() {}
  }
  t.after(() => { cleanup(); delete require.cache[require.resolve('../utils/data.js')] })
  delete require.cache[require.resolve('../utils/data.js')]
  const data = require('../utils/data.js')
  await data.reopenOrderByStaffPromise(5, 'sk%20x')
  await data.getOrderCloseHistoryPromise(5, 'sk%20x')
  assert.equal(requests.length, 2)
  assert.equal(requests[0].method, 'GET')
  assert.equal(requests[0].url, 'https://api.test/api/Order/SetOrderCloseStatus/5?closed=false&sessionKey=sk%20x')
  assert.equal(requests[1].method, 'GET')
  assert.equal(requests[1].url, 'https://api.test/api/Order/GetOrderCloseHistory/5?sessionKey=sk%20x')
})

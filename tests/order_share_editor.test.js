// 订单详情里的「介绍人分账」卡片：店长以上（≥200）才显示；只显示这一单的分账列表（未提交的可删），
// 「添加分账记录」是一个按钮，点了去新页面（pages/introducer/share/add）；回到订单页时列表自动刷新。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const api = require('../utils/introducer_api.js')
const { loadComponent, tap } = require('./reception_harness.js')

const PREFIX = 'https://x/api/'
const OK = data => ({ code: 0, message: '', data })
const ERR = (code, message) => ({ code, message, data: null })
const SHARE = over => Object.assign({ orderShareId: 31, introducerId: 7, name: '示例·李教练', type: '教练', amount: 86, state: '待自动分账', memo: null, planDate: null }, over)

function setup(t, { handler, staff, modalConfirm }) {
  const previous = { wx: global.wx, getApp: global.getApp }
  const calls = [], toasts = [], modals = [], navigations = []
  api.setTransport(options => {
    const [pathPart, query] = options.url.replace(PREFIX, '').split('?')
    const [controller, action] = pathPart.split('/')
    const params = {}
    ;(query || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); params[k] = decodeURIComponent(v) })
    calls.push({ controller, action, method: options.method, params, body: options.data })
    const data = handler(controller, action, params, options.data)
    // handler 返回 { __status: 404 } 模拟接口不存在（新版小程序先于后端上线）
    setImmediate(() => options.success(data && data.__status ? { statusCode: data.__status, data: {} } : { statusCode: 200, data }))
  })
  global.wx = {
    showToast(o) { toasts.push(o.title) },
    showModal(o) { modals.push(o.title); setImmediate(() => o.success && o.success({ confirm: modalConfirm !== false })) },
    navigateTo(o) { navigations.push(o.url) }
  }
  global.getApp = () => ({ globalData: { staff, sessionKey: 'sk%2B1', requestPrefix: PREFIX } })
  t.after(() => {
    global.wx = previous.wx
    global.getApp = previous.getApp
    api.setTransport(function (options) { wx.request(options) })
  })
  return { calls, toasts, modals, navigations }
}

const MANAGER = { valid: 1, title_level: 200 }
const FILE = 'components/share/order_share_editor/order_share_editor.js'
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')

test('店员（职级 100）看不到，也不发请求', async t => {
  const env = setup(t, { staff: { valid: 1, title_level: 100 }, handler: () => OK({}) })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.hidden, true)
  assert.equal(env.calls.length, 0)
})

test('已离职或失效的店长账号也看不到', async t => {
  const env = setup(t, { staff: { valid: 0, title_level: 300 }, handler: () => OK({}) })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.hidden, true)
  assert.equal(env.calls.length, 0)
})

test('后端还没上线新接口（404）时：卡片静默隐藏，不弹提示', async t => {
  const env = setup(t, { staff: MANAGER, handler: () => ({ __status: 404 }) })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.hidden, true)
  assert.equal(comp.data.loading, false)
  assert.deepEqual(env.toasts, [])
  assert.deepEqual(env.modals, [])
})

test('服务端明确拒绝（业务错误）时仍然提示原因', async t => {
  const env = setup(t, { staff: MANAGER, handler: () => ERR(3, '只有店长以上可以设置介绍人分账') })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.deepEqual(env.toasts, ['只有店长以上可以设置介绍人分账'])
})

test('不能设置时只显示原因，只请求这一单的分账列表', async t => {
  const env = setup(t, { staff: MANAGER, handler: () => OK({ canEdit: false, reason: '该订单还没有关单', suggested: 0, shares: [] }) })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.hidden, false)
  assert.equal(comp.data.canEdit, false)
  assert.equal(comp.data.reason, '该订单还没有关单')
  assert.deepEqual(env.calls.map(c => c.action), ['GetOrderShares'])
  assert.equal(env.calls[0].params.orderId, '123')
})

test('能设置时：卡片只请求分账列表（不请求介绍人名单），默认折叠，摘要是条数和合计', async t => {
  const shares = [SHARE({ orderShareId: 31, amount: 60 }), SHARE({ orderShareId: 32, introducerId: 8, name: '示例·小王', type: 'KOL', amount: 46.5, state: '手动处理' })]
  const env = setup(t, { staff: MANAGER, handler: () => OK({ canEdit: true, reason: null, suggested: 86, shares }) })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.deepEqual(env.calls.map(c => c.action), ['GetOrderShares'])
  assert.equal(comp.data.canEdit, true)
  assert.equal(comp.data.expanded, false)
  assert.equal(comp.data.summary, '已设 2 条，合计 ¥106.5')
  assert.deepEqual(comp.data.shares.map(s => s.stateClass), ['blue', 'warn'])
  comp.onToggle()
  assert.equal(comp.data.expanded, true)
  comp.onToggle()
  assert.equal(comp.data.expanded, false)
})

test('还没有分账时，摘要是「未设置」', async t => {
  setup(t, { staff: MANAGER, handler: () => OK({ canEdit: true, reason: null, suggested: 0, shares: [] }) })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.summary, '未设置')
})

test('「添加分账记录」去新页面，带上订单号；列表页自己不再有表单', async t => {
  setup(t, { staff: MANAGER, handler: () => OK({ canEdit: true, reason: null, suggested: 86, shares: [] }) })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  const env = setup(t, { staff: MANAGER, handler: () => OK({}) })
  comp.onAdd()
  assert.deepEqual(env.navigations, ['/pages/introducer/share/add/add?orderId=123'])
  for (const gone of ['onSave', 'onPick', 'onAmount', 'onPlanDate', 'onAutoShare', 'onMemo']) assert.equal(comp[gone], undefined, gone)
})

test('从「添加分账记录」页回到订单页时重新读取分账列表；没去过那一页的显示事件不重复请求', async t => {
  let shares = []
  const env = setup(t, { staff: MANAGER, handler: () => OK({ canEdit: true, reason: null, suggested: 86, shares }) })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  comp.onPageShow()
  assert.equal(env.calls.length, 1, '第一次显示时 attached 已经读过了')

  shares = [SHARE()]
  comp.onAdd()
  await comp.onPageShow()
  assert.equal(env.calls.length, 2)
  assert.equal(comp.data.summary, '已设 1 条，合计 ¥86')
  assert.match(read(FILE), /pageLifetimes:\s*\{\s*show\(\)\s*\{\s*this\.onPageShow\(\)/)
})

test('删除先确认；已分账、被拒绝的不能删；删除后摘要跟着变', async t => {
  let shares = [SHARE({ orderShareId: 31 }), SHARE({ orderShareId: 32, state: '已分账' }), SHARE({ orderShareId: 33, state: '被拒绝' })]
  const env = setup(t, {
    staff: MANAGER,
    handler: (c, a) => {
      if (a === 'GetOrderShares') return OK({ canEdit: true, reason: null, suggested: 0, shares })
      shares = shares.filter(s => s.orderShareId !== 31)
      return OK({ shares })
    }
  })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.deepEqual(comp.data.shares.map(s => s.removable), [true, false, false])
  assert.deepEqual(comp.data.shares.map(s => s.stateClass), ['blue', 'ok', 'danger'])

  await comp.onRemove(tap({ id: 31 }))
  assert.deepEqual(env.modals, ['删除介绍人分账'])
  assert.deepEqual(env.calls.find(c => c.action === 'RemoveShare').body, { orderShareId: 31 })
  assert.equal(comp.data.shares.length, 2)
  assert.equal(comp.data.summary, '已设 2 条，合计 ¥172')
})

test('界面结构：标题可点折叠；展开后是列表、每条显示预计分账日期；有「添加分账记录」按钮，没有表单', () => {
  const wxml = read('components/share/order_share_editor/order_share_editor.wxml')
  assert.match(wxml, /class="ose-head"[^>]*bindtap="onToggle"/)
  assert.match(wxml, /wx:if="\{\{expanded\}\}"/)
  assert.match(wxml, /wx:if="\{\{item\.planDate\}\}"[^>]*>预计分账：\{\{item\.planDate\}\}/)
  assert.match(wxml, /bindtap="onAdd"[^>]*>添加分账记录/)
  assert.doesNotMatch(wxml, /<input|<picker|<switch|<date-range-picker|onSave/)
})

test('租赁订单详情页挂了组件；新页面在介绍人分包里注册', () => {
  assert.match(read('pages/admin/rent/rent_order_detail/rent_order_detail.json'), /"order-share-editor": "\/components\/share\/order_share_editor\/order_share_editor"/)
  assert.match(read('pages/admin/rent/rent_order_detail/rent_order_detail.wxml'), /<order-share-editor wx:if="\{\{order\.id\}\}" order-id="\{\{order\.id\}\}"\/>/)
  const app = JSON.parse(read('app.json'))
  const sub = app.subPackages.find(s => s.root === 'pages/introducer')
  assert.ok(sub.pages.includes('share/add/add'))
})

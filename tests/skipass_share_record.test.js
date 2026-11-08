// 「大好河山雪票」页每张票下面的「雪票分账记录」：只读，显示系统给推荐员工的分账（每张票 1 元）
// 分给谁、成没成、计划什么时候分、什么时候成功。店长以上（≥200）才显示。
// 2026-11-08 暂时替换了这一页原来的「分销商分账」卡片（介绍人分账的卡片在租赁/养护/零售订单详情里照旧）。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const api = require('../utils/introducer_api.js')
const { loadComponent } = require('./reception_harness.js')

const PREFIX = 'https://x/api/'
const OK = data => ({ code: 0, message: '', data })
const ERR = (code, message) => ({ code, message, data: null })
const REC = over => Object.assign({ orderShareId: 2022, receiver: '张小飞', amount: 1, state: '已分账', plan: '取票后自动分账',
  submitTime: '2026-11-07 17:41:55', successTime: '2026-11-07 17:41:56', memo: null }, over)
const RESULT = (records, over) => Object.assign({ ticketCount: 2, pickedUpCount: 2, records, emptyReason: null }, over)

function setup(t, { handler, staff }) {
  const previous = { wx: global.wx, getApp: global.getApp }
  const calls = [], toasts = [], modals = []
  api.setTransport(options => {
    const [pathPart, query] = options.url.replace(PREFIX, '').split('?')
    const [controller, action] = pathPart.split('/')
    const params = {}
    ;(query || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); params[k] = decodeURIComponent(v) })
    calls.push({ controller, action, method: options.method, params })
    const data = handler(controller, action, params)
    setImmediate(() => options.success(data && data.__status ? { statusCode: data.__status, data: {} } : { statusCode: 200, data }))
  })
  global.wx = {
    showToast(o) { toasts.push(o.title) },
    showModal(o) { modals.push(o.title) }
  }
  global.getApp = () => ({ globalData: { staff, sessionKey: 'sk%2B1', requestPrefix: PREFIX } })
  t.after(() => {
    global.wx = previous.wx
    global.getApp = previous.getApp
    api.setTransport(function (options) { wx.request(options) })
  })
  return { calls, toasts, modals }
}

const MANAGER = { valid: 1, title_level: 200 }
const FILE = 'components/share/skipass_share_record/skipass_share_record.js'
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')

test('店员（职级 100）和失效的店长账号看不到，也不发请求', async t => {
  for (const staff of [{ valid: 1, title_level: 100 }, { valid: 0, title_level: 300 }, null]) {
    const env = setup(t, { staff, handler: () => OK(RESULT([])) })
    const comp = loadComponent(FILE, {}, { orderId: 123 })
    await comp.load()
    assert.equal(comp.data.hidden, true)
    assert.equal(env.calls.length, 0)
  }
})

test('接口：GET SkipassShareRecord/GetByOrder，带订单号', async t => {
  const env = setup(t, { staff: MANAGER, handler: () => OK(RESULT([REC()])) })
  const comp = loadComponent(FILE, {}, { orderId: 72473 })
  await comp.load()
  assert.equal(env.calls.length, 1)
  assert.deepEqual([env.calls[0].controller, env.calls[0].action, env.calls[0].method], ['SkipassShareRecord', 'GetByOrder', 'GET'])
  assert.equal(env.calls[0].params.orderId, '72473')
})

test('有记录：默认展开；逐条显示分给谁、状态、计划、提交和成功时间；摘要是条数、合计和已分账条数', async t => {
  const records = [REC(), REC({ orderShareId: 2038, state: '待分账', submitTime: null, successTime: null })]
  setup(t, { staff: MANAGER, handler: () => OK(RESULT(records)) })
  const comp = loadComponent(FILE, {}, { orderId: 72473 })
  await comp.load()
  assert.equal(comp.data.hidden, false)
  assert.equal(comp.data.expanded, true)
  assert.equal(comp.data.summary, '共 2 条 ¥2，已分账 1 条')
  assert.equal(comp.data.ticketText, '已取票 2/2 张')
  assert.deepEqual(comp.data.records.map(r => [r.receiver, r.state, r.stateClass, r.plan, r.submitTime, r.successTime]), [
    ['张小飞', '已分账', 'ok', '取票后自动分账', '2026-11-07 17:41:55', '2026-11-07 17:41:56'],
    ['张小飞', '待分账', 'warn', '取票后自动分账', null, null]
  ])
})

test('各种状态的颜色：被拒绝红、处理中蓝、不能自动分/部分分账黄', async t => {
  const records = ['已分账', '处理中', '被拒绝', '不能自动分', '部分分账', '待分账'].map((state, i) => REC({ orderShareId: i + 1, state }))
  setup(t, { staff: MANAGER, handler: () => OK(RESULT(records)) })
  const comp = loadComponent(FILE, {}, { orderId: 1 })
  await comp.load()
  assert.deepEqual(comp.data.records.map(r => r.stateClass), ['ok', 'blue', 'danger', 'warn', 'warn', 'warn'])
})

test('没有分账记录：摘要直接写服务端给的原因，并显示已取票张数', async t => {
  setup(t, { staff: MANAGER, handler: () => OK(RESULT([], { ticketCount: 1, pickedUpCount: 0, emptyReason: '这单没有记录推荐员工，不产生分账' })) })
  const comp = loadComponent(FILE, {}, { orderId: 5 })
  await comp.load()
  assert.equal(comp.data.summary, '这单没有记录推荐员工，不产生分账')
  assert.equal(comp.data.ticketText, '已取票 0/1 张')
  assert.deepEqual(comp.data.records, [])
})

test('点标题可以收起和再展开', async t => {
  setup(t, { staff: MANAGER, handler: () => OK(RESULT([REC()])) })
  const comp = loadComponent(FILE, {}, { orderId: 1 })
  await comp.load()
  comp.onToggle()
  assert.equal(comp.data.expanded, false)
  comp.onToggle()
  assert.equal(comp.data.expanded, true)
})

test('后端还没上线新接口（404）：静默隐藏，不弹提示；业务错误（无权限）仍提示原因', async t => {
  let env = setup(t, { staff: MANAGER, handler: () => ({ __status: 404 }) })
  let comp = loadComponent(FILE, {}, { orderId: 1 })
  await comp.load()
  assert.equal(comp.data.hidden, true)
  assert.deepEqual(env.toasts, [])
  assert.deepEqual(env.modals, [])

  env = setup(t, { staff: MANAGER, handler: () => ERR(3, '只有店长以上可以查看雪票分账记录') })
  comp = loadComponent(FILE, {}, { orderId: 1 })
  await comp.load()
  assert.deepEqual(env.toasts, ['只有店长以上可以查看雪票分账记录'])
})

test('订单号变了会重新读取', async t => {
  const env = setup(t, { staff: MANAGER, handler: () => OK(RESULT([])) })
  const comp = loadComponent(FILE, {}, { orderId: 1 })
  await comp.invokeLifecycle('attached')
  comp.setProperty('orderId', 2)
  await new Promise(r => setImmediate(r))
  assert.deepEqual(env.calls.map(c => c.params.orderId), ['1', '2'])
})

test('「大好河山雪票」页：每张票下面用雪票分账记录，不再是分销商分账卡片；页面 json 注册了组件', () => {
  const wxml = read('pages/admin/ski_pass/dhhs_skipass_order.wxml')
  assert.match(wxml, /<skipass-share-record wx:if="\{\{item\.order_id\}\}" order-id="\{\{item\.order_id\}\}"/)
  assert.doesNotMatch(wxml, /order-share-editor/)
  const json = JSON.parse(read('pages/admin/ski_pass/dhhs_skipass_order.json'))
  assert.equal(json.usingComponents['skipass-share-record'], '/components/share/skipass_share_record/skipass_share_record')
  assert.equal(json.usingComponents['order-share-editor'], undefined)
})

test('卡片上写出：分给、状态、计划、提交、成功', () => {
  const wxml = read('components/share/skipass_share_record/skipass_share_record.wxml')
  for (const text of ['雪票分账记录', '分给', '{{item.receiver}}', '{{item.state}}', '计划', '{{item.plan}}', '提交', '{{item.submitTime}}', '成功', '{{item.successTime}}'])
    assert.ok(wxml.includes(text), text)
})

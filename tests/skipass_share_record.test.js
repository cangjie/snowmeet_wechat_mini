// 「大好河山雪票」页每张票下面的「雪票分账记录」：只读，显示这张票那 1 元的系统分账（分账对应的是雪票不是订单，一张票最多一笔）
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
const RESULT = (record, over) => Object.assign({ skipassId: 8369, pickedUp: true, record, emptyReason: null }, over)

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
    const env = setup(t, { staff, handler: () => OK(RESULT(null)) })
    const comp = loadComponent(FILE, {}, { skipassId: 8369 })
    await comp.load()
    assert.equal(comp.data.hidden, true)
    assert.equal(env.calls.length, 0)
  }
})

test('接口：GET SkipassShareRecord/GetBySkipass，带雪票 id（不是订单号）', async t => {
  const env = setup(t, { staff: MANAGER, handler: () => OK(RESULT(REC())) })
  const comp = loadComponent(FILE, {}, { skipassId: 8370 })
  await comp.load()
  assert.equal(env.calls.length, 1)
  assert.deepEqual([env.calls[0].controller, env.calls[0].action, env.calls[0].method], ['SkipassShareRecord', 'GetBySkipass', 'GET'])
  assert.equal(env.calls[0].params.skipassId, '8370')
  assert.equal(env.calls[0].params.orderId, undefined)
})

test('有分账：默认展开；显示分给谁、状态、计划、提交和成功时间；摘要是金额和状态；已取票', async t => {
  setup(t, { staff: MANAGER, handler: () => OK(RESULT(REC())) })
  const comp = loadComponent(FILE, {}, { skipassId: 8369 })
  await comp.load()
  assert.equal(comp.data.hidden, false)
  assert.equal(comp.data.expanded, true)
  assert.equal(comp.data.summary, '¥1 已分账')
  assert.equal(comp.data.ticketText, '这张票已取票')
  assert.deepEqual([comp.data.record.receiver, comp.data.record.state, comp.data.record.stateClass, comp.data.record.plan,
    comp.data.record.submitTime, comp.data.record.successTime],
    ['张小飞', '已分账', 'ok', '取票后自动分账', '2026-11-07 17:41:55', '2026-11-07 17:41:56'])
  assert.equal(comp.data.emptyReason, '')
})

test('还没取票、待分账：未取票、待分账、没有提交和成功时间', async t => {
  setup(t, { staff: MANAGER, handler: () => OK(RESULT(REC({ state: '待分账', submitTime: null, successTime: null }), { pickedUp: false })) })
  const comp = loadComponent(FILE, {}, { skipassId: 8370 })
  await comp.load()
  assert.equal(comp.data.summary, '¥1 待分账')
  assert.equal(comp.data.ticketText, '这张票还没取票')
  assert.equal(comp.data.record.stateClass, 'warn')
  assert.equal(comp.data.record.submitTime, null)
  assert.equal(comp.data.record.successTime, null)
})

test('各种状态的颜色：被拒绝红、处理中蓝、不能自动分/部分分账/待分账黄、已分账绿', async t => {
  const got = {}
  for (const state of ['已分账', '处理中', '被拒绝', '不能自动分', '部分分账', '待分账']) {
    setup(t, { staff: MANAGER, handler: () => OK(RESULT(REC({ state }))) })
    const comp = loadComponent(FILE, {}, { skipassId: 1 })
    await comp.load()
    got[state] = comp.data.record.stateClass
  }
  assert.deepEqual(got, { '已分账': 'ok', '处理中': 'blue', '被拒绝': 'danger', '不能自动分': 'warn', '部分分账': 'warn', '待分账': 'warn' })
})

test('这张票没有分账：摘要和说明直接写服务端给的原因，没有记录行', async t => {
  setup(t, { staff: MANAGER, handler: () => OK(RESULT(null, { pickedUp: false, emptyReason: '这张票没有分账' })) })
  const comp = loadComponent(FILE, {}, { skipassId: 5 })
  await comp.load()
  assert.equal(comp.data.summary, '没有分账')
  assert.equal(comp.data.emptyReason, '这张票没有分账')
  assert.equal(comp.data.ticketText, '这张票还没取票')
  assert.equal(comp.data.record, null)
})

test('点标题可以收起和再展开', async t => {
  setup(t, { staff: MANAGER, handler: () => OK(RESULT(REC())) })
  const comp = loadComponent(FILE, {}, { skipassId: 1 })
  await comp.load()
  comp.onToggle()
  assert.equal(comp.data.expanded, false)
  comp.onToggle()
  assert.equal(comp.data.expanded, true)
})

test('后端还没上线新接口（404）：静默隐藏，不弹提示；业务错误（无权限）仍提示原因', async t => {
  let env = setup(t, { staff: MANAGER, handler: () => ({ __status: 404 }) })
  let comp = loadComponent(FILE, {}, { skipassId: 1 })
  await comp.load()
  assert.equal(comp.data.hidden, true)
  assert.deepEqual(env.toasts, [])
  assert.deepEqual(env.modals, [])

  env = setup(t, { staff: MANAGER, handler: () => ERR(3, '只有店长以上可以查看雪票分账记录') })
  comp = loadComponent(FILE, {}, { skipassId: 1 })
  await comp.load()
  assert.deepEqual(env.toasts, ['只有店长以上可以查看雪票分账记录'])
})

test('雪票 id 变了会重新读取', async t => {
  const env = setup(t, { staff: MANAGER, handler: () => OK(RESULT(null)) })
  const comp = loadComponent(FILE, {}, { skipassId: 1 })
  await comp.invokeLifecycle('attached')
  comp.setProperty('skipassId', 2)
  await new Promise(r => setImmediate(r))
  assert.deepEqual(env.calls.map(c => c.params.skipassId), ['1', '2'])
})

test('「大好河山雪票」页：每张票下面用它自己的雪票分账记录（传票的 id，不是订单号），不再是分销商分账卡片；页面 json 注册了组件', () => {
  const wxml = read('pages/admin/ski_pass/dhhs_skipass_order.wxml')
  assert.match(wxml, /<skipass-share-record wx:if="\{\{item\.id\}\}" skipass-id="\{\{item\.id\}\}"/)
  assert.doesNotMatch(wxml, /order-id="\{\{item\.order_id\}\}"/)
  assert.doesNotMatch(wxml, /order-share-editor/)
  const json = JSON.parse(read('pages/admin/ski_pass/dhhs_skipass_order.json'))
  assert.equal(json.usingComponents['skipass-share-record'], '/components/share/skipass_share_record/skipass_share_record')
  assert.equal(json.usingComponents['order-share-editor'], undefined)
})

test('卡片上写出：分给、状态、计划、提交、成功、是否取票；没有分账时写原因；一张票只有一笔，不循环', () => {
  const wxml = read('components/share/skipass_share_record/skipass_share_record.wxml')
  for (const text of ['雪票分账记录', '分给', '{{record.receiver}}', '{{record.state}}', '计划', '{{record.plan}}', '提交', '{{record.submitTime}}', '成功', '{{record.successTime}}', '{{ticketText}}', '{{emptyReason}}'])
    assert.ok(wxml.includes(text), text)
  assert.doesNotMatch(wxml, /wx:for/)
})

// ---------- 2026-11-18 用户：票取消了，分账也应该是取消状态 ----------

test('票已取消：显示「已取消」（灰色）、摘要「¥1 已取消」、票状态写「这张票已取消」', async t => {
  setup(t, { staff: MANAGER, handler: () => OK(RESULT(REC({ state: '已取消', plan: '票已取消，不再分账', submitTime: null, successTime: null }),
    { pickedUp: false, cancelled: true })) })
  const comp = loadComponent(FILE, {}, { skipassId: 8393 })
  await comp.load()
  assert.equal(comp.data.summary, '¥1 已取消')
  assert.equal(comp.data.record.state, '已取消')
  assert.equal(comp.data.record.stateClass, 'muted')
  assert.equal(comp.data.ticketText, '这张票已取消')
  assert.equal(comp.data.voided, true)
})

test('票已取消、没有分账记录：也写「这张票已取消」，原因照后端给的显示', async t => {
  setup(t, { staff: MANAGER, handler: () => OK(RESULT(null, { pickedUp: false, cancelled: true, emptyReason: '这张票已取消，没有分账' })) })
  const comp = loadComponent(FILE, {}, { skipassId: 8393 })
  await comp.load()
  assert.equal(comp.data.ticketText, '这张票已取消')
  assert.equal(comp.data.emptyReason, '这张票已取消，没有分账')
})

test('没取消的票不受影响（旧后端没有 cancelled 字段也一样）', async t => {
  setup(t, { staff: MANAGER, handler: () => OK(RESULT(REC({ state: '待分账', submitTime: null, successTime: null }), { pickedUp: false })) })
  const comp = loadComponent(FILE, {}, { skipassId: 8370 })
  await comp.load()
  assert.equal(comp.data.voided, false)
  assert.equal(comp.data.ticketText, '这张票还没取票')
})

test('模板：票已取消时不再写「取票后自动分给推荐员工」，其余照旧', () => {
  const wxml = read('components/share/skipass_share_record/skipass_share_record.wxml')
  assert.match(wxml, /\{\{ticketText\}\}\{\{voided \? '' : '；这张票分 ¥1，取票后自动分给推荐员工'\}\}/)
})

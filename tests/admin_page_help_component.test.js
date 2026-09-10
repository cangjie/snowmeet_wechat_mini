const test = require('node:test')
const assert = require('node:assert/strict')

const assistant = require('../utils/adminAssistant.js')

const aprilState = {
  start_date: '2026-04-01', end_date: '2026-04-30', shop: '万龙服务中心',
  rent_status: '未支付', is_test: false, is_entertain: true,
  have_discount: false, use_card: true, has_retail: true,
  cell_suffix: '7788', keyword: '雪板'
}

function response(reply, actions, context) {
  return { version: '1', trace_id: 'trace-1', reply: { text: reply, citations: [] }, actions: actions || [], context: context || { rental_order_query: null } }
}

function loadComponentWithData(fakeData) {
  const dataPath = require.resolve('../utils/data.js')
  const componentPath = require.resolve('../components/admin-page-help/index.js')
  const originalData = require.cache[dataPath]
  delete require.cache[componentPath]
  require.cache[dataPath] = { id: dataPath, filename: dataPath, loaded: true, exports: fakeData }
  let definition = null
  global.Component = value => { definition = value }
  require(componentPath)
  delete global.Component
  const instance = { data: JSON.parse(JSON.stringify(definition.data)), setData(values) { Object.assign(this.data, values) } }
  Object.keys(definition.methods).forEach(name => { instance[name] = definition.methods[name].bind(instance) })
  return { instance, restore() { delete require.cache[componentPath]; if (originalData) require.cache[dataPath] = originalData; else delete require.cache[dataPath] } }
}

function installAppAndWx() {
  const navigations = []
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'session-1', staff: { id: 7, title_level: 200 } } })
  global.wx = { navigateTo(options) { navigations.push(options.url) } }
  return navigations
}

function cleanGlobals() { delete global.getApp; delete global.wx; assistant.clearContext() }

test('四月租赁查询显示服务端文字，保存上下文并跳转到固定筛选列表', async () => {
  assistant.clearContext()
  let unifiedCalls = 0
  const loaded = loadComponentWithData({ askAdminAssistantPromise: async request => {
    unifiedCalls++
    assert.equal(request.question, '请查询一下今年4月份的租赁订单')
    return response('共查询到 12 单。', [{ type: 'rental_order.show_results', status: 'completed', state: aprilState }], { rental_order_query: aprilState })
  } })
  const navigations = installAppAndWx()
  try {
    loaded.instance.data.input = '请查询一下今年4月份的租赁订单'
    await loaded.instance.sendQuestion()
    assert.equal(unifiedCalls, 1)
    assert.equal(loaded.instance.data.messages.at(-1).content, '共查询到 12 单。')
    assert.deepEqual(assistant.currentContext({ id: 7 }), { rental_order_query: aprilState })
    assert.equal(navigations.length, 1)
    assert.match(navigations[0], /^\/pages\/admin\/rent\/new_rent_list\?aiIntent=/)
  } finally { loaded.restore(); cleanGlobals() }
})

test('普通帮助和条件回顾均走统一接口，并携带上一轮完整上下文', async () => {
  assistant.clearContext()
  const requests = []
  const loaded = loadComponentWithData({ askAdminAssistantPromise: async request => {
    requests.push(request)
    if (request.question === '这个页面怎么操作') return response('这里是操作说明。', [], { rental_order_query: aprilState })
    return response('日期为 4 月，状态为未支付，其余条件见当前筛选。')
  } })
  installAppAndWx()
  try {
    loaded.instance.data.input = '这个页面怎么操作'; await loaded.instance.sendQuestion()
    loaded.instance.data.input = '当前查询条件是什么'; await loaded.instance.sendQuestion()
    assert.equal(requests.length, 2)
    assert.equal(requests[1].question, '当前查询条件是什么')
    assert.deepEqual(requests[1].context.rental_order_query, aprilState)
    assert.deepEqual(requests[1].conversation, [{ role: 'user', content: '这个页面怎么操作' }, { role: 'assistant', content: '这里是操作说明。', citations: [] }])
    assert.equal(loaded.instance.data.messages.at(-1).content, '日期为 4 月，状态为未支付，其余条件见当前筛选。')
  } finally { loaded.restore(); cleanGlobals() }
})

test('初始页面说明和错误回复均使用统一响应', async () => {
  assistant.clearContext()
  let initialRequest
  const loaded = loadComponentWithData({ askAdminAssistantPromise: async request => { initialRequest = request; return response('请先选择筛选条件。') } })
  installAppAndWx()
  try {
    loaded.instance.data.pageKey = 'pages/admin/rent/new_rent_list'
    await loaded.instance.loadPageHelp()
    assert.equal(initialRequest.question, '请说明当前页面的用途、标准操作步骤、关键限制和常见错误。')
    assert.deepEqual(initialRequest.conversation, [])
    assert.equal(loaded.instance.data.pageHelp.text, '请先选择筛选条件。')
    const failed = loadComponentWithData({ askAdminAssistantPromise: async () => { throw new Error('network') } })
    try { failed.instance.data.input = '这个页面怎么操作'; await failed.instance.sendQuestion(); assert.equal(failed.instance.data.error, '暂时无法获得回答') } finally { failed.restore() }
  } finally { loaded.restore(); cleanGlobals() }
})

test('未知客户端 action 保留服务端文字且不跳转', async () => {
  assistant.clearContext()
  const loaded = loadComponentWithData({ askAdminAssistantPromise: async () => response('服务器已处理说明。', [{ type: 'refund.execute', status: 'completed' }]) })
  const navigations = installAppAndWx()
  try {
    loaded.instance.data.input = '执行一个不支持的操作'; await loaded.instance.sendQuestion()
    assert.equal(loaded.instance.data.messages.at(-1).content, '服务器已处理说明。')
    assert.equal(loaded.instance.data.error, '当前版本暂不支持此操作，请升级后重试')
    assert.deepEqual(navigations, [])
  } finally { loaded.restore(); cleanGlobals() }
})

test('跳转失败时保留服务端文字并显示安全反馈', async () => {
  assistant.clearContext()
  const loaded = loadComponentWithData({ askAdminAssistantPromise: async () => response('共查询到 12 单。', [{ type: 'rental_order.show_results', status: 'completed', state: aprilState }]) })
  installAppAndWx()
  let navigationFailure
  global.wx.navigateTo = options => { navigationFailure = options.fail }
  try {
    loaded.instance.data.input = '查询四月租赁订单'; await loaded.instance.sendQuestion()
    assert.equal(typeof navigationFailure, 'function')
    navigationFailure(new Error('route missing'))
    assert.equal(loaded.instance.data.messages.at(-1).content, '共查询到 12 单。')
    assert.equal(loaded.instance.data.error, '当前版本暂不支持此操作，请升级后重试')
  } finally { loaded.restore(); cleanGlobals() }
})

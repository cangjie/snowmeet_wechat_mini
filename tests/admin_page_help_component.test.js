const test = require('node:test')
const assert = require('node:assert/strict')

const assistant = require('../utils/adminAssistant.js')
const adminAiQuery = require('../utils/adminAiQuery.js')

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

function appFor(staffId, sessionKey) {
  return { loginPromiseNew: Promise.resolve(), globalData: { sessionKey, staff: { id: staffId, title_level: 200 } } }
}

function loadActualDataWithWxResponse(response) {
  const dataPath = require.resolve('../utils/data.js')
  const originalData = require.cache[dataPath]
  delete require.cache[dataPath]
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { requestPrefix: 'https://api.example/api/', sessionKey: 'session-1', staff: { id: 7, title_level: 200 } } })
  const navigations = []
  global.wx = {
    request(options) { options.success(response) },
    navigateTo(options) { navigations.push(options.url) }
  }
  const data = require('../utils/data.js')
  return {
    data,
    navigations,
    restore() {
      delete require.cache[dataPath]
      if (originalData) require.cache[dataPath] = originalData
      else delete require.cache[dataPath]
    }
  }
}

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
    assert.deepEqual(requests[1].conversation, [{ role: 'user', content: '这个页面怎么操作' }, { role: 'assistant', content: '这里是操作说明。' }])
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
    assert.deepEqual(loaded.instance.data.messages, [])
    const failed = loadComponentWithData({ askAdminAssistantPromise: async () => { throw new Error('network') } })
    try { failed.instance.data.input = '这个页面怎么操作'; await failed.instance.sendQuestion(); assert.equal(failed.instance.data.error, '暂时无法获得回答') } finally { failed.restore() }
  } finally { loaded.restore(); cleanGlobals() }
})

test('初始页面说明保留单独展示，后续回答只加入聊天记录', async () => {
  assistant.clearContext()
  let calls = 0
  const loaded = loadComponentWithData({ askAdminAssistantPromise: async () => {
    calls++
    return response(calls === 1 ? '这是初始页面说明。' : '这是后续回答。')
  } })
  installAppAndWx()
  try {
    loaded.instance.data.pageKey = 'pages/admin/rent/new_rent_list'
    await loaded.instance.loadPageHelp()
    loaded.instance.data.input = '这个筛选怎么用'
    await loaded.instance.sendQuestion()
    assert.equal(loaded.instance.data.pageHelp.text, '这是初始页面说明。')
    assert.deepEqual(loaded.instance.data.messages, [
      { role: 'user', content: '这个筛选怎么用' },
      { role: 'assistant', content: '这是后续回答。', citations: [] }
    ])
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
    assert.equal(loaded.instance.data.retryable, false)
    assert.deepEqual(navigations, [])
  } finally { loaded.restore(); cleanGlobals() }
})

test('网络错误保留原问题供重试，成功重试只追加一次问答', async () => {
  assistant.clearContext()
  let calls = 0
  const loaded = loadComponentWithData({ askAdminAssistantPromise: async () => {
    calls++
    if (calls === 1) throw new Error('network')
    return response('重试后的回答。')
  } })
  installAppAndWx()
  try {
    loaded.instance.data.input = '这个页面怎么操作'
    await loaded.instance.sendQuestion()
    assert.equal(loaded.instance.data.input, '')
    assert.equal(loaded.instance.data.retryable, true)
    assert.equal(loaded.instance.data.lastQuestion, '这个页面怎么操作')
    await loaded.instance.onRetry()
    assert.equal(calls, 2)
    assert.equal(loaded.instance.data.error, '')
    assert.equal(loaded.instance.data.retryable, false)
    assert.deepEqual(loaded.instance.data.messages, [
      { role: 'user', content: '这个页面怎么操作' },
      { role: 'assistant', content: '重试后的回答。', citations: [] }
    ])
  } finally { loaded.restore(); cleanGlobals() }
})

test('超过 API 2000 字符上限的问题显示安全反馈且不调用统一接口', async () => {
  assistant.clearContext()
  let calls = 0
  const loaded = loadComponentWithData({ askAdminAssistantPromise: async () => { calls++ } })
  installAppAndWx()
  try {
    loaded.instance.data.input = '问'.repeat(2001)
    await loaded.instance.sendQuestion()
    assert.equal(calls, 0)
    assert.equal(loaded.instance.data.error, '问题不能超过 2000 个字符')
    assert.equal(loaded.instance.data.retryable, false)
    assert.equal(loaded.instance.data.loading, false)
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

test('超长 CJK 关键词或编码后超限的完整 action 均保留文字且不跳转', async () => {
  assistant.clearContext()
  const oversizedStates = [
    { ...aprilState, keyword: '雪'.repeat(1000) },
    { ...aprilState, shop: '万'.repeat(64), rent_status: '未'.repeat(64), keyword: '雪'.repeat(100) }
  ]
  assert.equal(assistant.isValidQueryState(oversizedStates[1]), true)
  assert.ok(adminAiQuery.buildRentOrderListUrl(oversizedStates[1]).length > 1800)
  let index = 0
  const loaded = loadComponentWithData({ askAdminAssistantPromise: async () => response('共查询到 12 单。', [{ type: 'rental_order.show_results', status: 'completed', state: oversizedStates[index++] }]) })
  const navigations = installAppAndWx()
  try {
    loaded.instance.data.input = '第一条超长查询'; await loaded.instance.sendQuestion()
    loaded.instance.data.input = '第二条超长查询'; await loaded.instance.sendQuestion()
    assert.equal(loaded.instance.data.messages.at(-1).content, '共查询到 12 单。')
    assert.equal(loaded.instance.data.error, '当前版本暂不支持此操作，请升级后重试')
    assert.equal(loaded.instance.data.retryable, false)
    assert.deepEqual(navigations, [])
  } finally { loaded.restore(); cleanGlobals() }
})

test('502 的有效 v1 失败 envelope 显示服务端安全答复与 trace，不执行 action 且允许重试', async () => {
  assistant.clearContext()
  assistant.acceptContext({ id: 7 }, { rental_order_query: aprilState })
  const rawMessage = 'upstream database password=secret'
  const actual = loadActualDataWithWxResponse({
    statusCode: 502,
    data: { code: 1, message: rawMessage, data: response('管理员助手服务暂不可用，请稍后重试。', [{ type: 'rental_order.show_results', status: 'completed', state: aprilState }]) }
  })
  const loaded = loadComponentWithData(actual.data)
  try {
    loaded.instance.data.input = '查询四月租赁订单'
    await loaded.instance.sendQuestion()
    assert.equal(loaded.instance.data.messages.at(-1).content, '管理员助手服务暂不可用，请稍后重试。')
    assert.equal(loaded.instance.data.traceId, 'trace-1')
    assert.equal(loaded.instance.data.failureType, 'service_unavailable')
    assert.equal(loaded.instance.data.retryable, true)
    assert.deepEqual(actual.navigations, [])
    assert.equal(assistant.currentContext({ id: 7 }).rental_order_query, null)
    assert.doesNotMatch(JSON.stringify(loaded.instance.data), /password|secret/i)
  } finally { loaded.restore(); actual.restore(); cleanGlobals() }
})

test('400 的有效 v1 失败 envelope 显示服务端安全答复与 trace，不执行 action 且不重试', async () => {
  assistant.clearContext()
  const actual = loadActualDataWithWxResponse({
    statusCode: 400,
    data: { code: 1, message: 'raw validation detail: sessionKey=secret', data: response('请求条件不合法，请调整后重试。', [{ type: 'rental_order.show_results', status: 'completed', state: aprilState }]) }
  })
  const loaded = loadComponentWithData(actual.data)
  try {
    loaded.instance.data.input = '查询'
    await loaded.instance.sendQuestion()
    assert.equal(loaded.instance.data.messages.at(-1).content, '请求条件不合法，请调整后重试。')
    assert.equal(loaded.instance.data.traceId, 'trace-1')
    assert.equal(loaded.instance.data.failureType, 'invalid_request')
    assert.equal(loaded.instance.data.retryable, false)
    assert.deepEqual(actual.navigations, [])
    assert.doesNotMatch(JSON.stringify(loaded.instance.data), /sessionKey|secret/i)
  } finally { loaded.restore(); actual.restore(); cleanGlobals() }
})

test('403 的有效 v1 失败 envelope 保留安全答复和 trace，不执行 action 且不可重试', async () => {
  assistant.clearContext()
  const actual = loadActualDataWithWxResponse({
    statusCode: 403,
    data: { code: 1, message: 'raw authorization header=secret', data: response('没有权限访问此查询。', [{ type: 'rental_order.show_results', status: 'completed', state: aprilState }]) }
  })
  const loaded = loadComponentWithData(actual.data)
  try {
    loaded.instance.data.input = '查询'
    await loaded.instance.sendQuestion()
    assert.equal(loaded.instance.data.messages.at(-1).content, '没有权限访问此查询。')
    assert.equal(loaded.instance.data.traceId, 'trace-1')
    assert.equal(loaded.instance.data.failureType, 'permission_denied')
    assert.equal(loaded.instance.data.retryable, false)
    assert.deepEqual(actual.navigations, [])
    assert.doesNotMatch(JSON.stringify(loaded.instance.data), /authorization|secret/i)
  } finally { loaded.restore(); actual.restore(); cleanGlobals() }
})

test('员工切换后清空旧会话界面，B 的初始帮助和提问不发送 A 的历史', async () => {
  assistant.clearContext()
  const requests = []
  let activeApp = appFor(7, 'session-a')
  const loaded = loadComponentWithData({ askAdminAssistantPromise: async request => {
    requests.push(request)
    return response(request.question.indexOf('请说明当前页面') === 0 ? 'B 的页面说明。' : '当前员工的回答。')
  } })
  const navigations = installAppAndWx()
  global.getApp = () => activeApp
  try {
    loaded.instance.data.input = 'A 的历史问题'
    await loaded.instance.sendQuestion()
    assert.equal(loaded.instance.data.messages.at(-1).content, '当前员工的回答。')

    activeApp = appFor(8, 'session-b')
    loaded.instance.data.pageKey = 'pages/admin/rent/new_rent_list'
    await loaded.instance.loadPageHelp()
    loaded.instance.data.input = 'B 的新问题'
    await loaded.instance.sendQuestion()

    assert.equal(requests.length, 3)
    assert.deepEqual(requests[1].conversation, [])
    assert.deepEqual(requests[2].conversation, [])
    assert.equal(requests[2].question, 'B 的新问题')
    assert.equal(loaded.instance.data.pageHelp.text, 'B 的页面说明。')
    assert.deepEqual(loaded.instance.data.messages, [
      { role: 'user', content: 'B 的新问题' },
      { role: 'assistant', content: '当前员工的回答。', citations: [] }
    ])
    assert.deepEqual(navigations, [])
  } finally { loaded.restore(); cleanGlobals() }
})

test('A 的 stale_session 延迟结果在切换到 B 后静默丢弃，不改变 B 的界面、上下文或跳转', async () => {
  assistant.clearContext()
  let rejectA
  let activeApp = appFor(7, 'session-a')
  const loaded = loadComponentWithData({
    askAdminAssistantPromise: async () => new Promise((resolve, reject) => { rejectA = reject }),
    isAdminAssistantStaleSessionError: error => error && error.code === 'stale_session'
  })
  const navigations = installAppAndWx()
  global.getApp = () => activeApp
  try {
    loaded.instance.data.pageKey = 'pages/admin/rent/new_rent_list'
    loaded.instance.data.input = 'A 的待处理问题'
    const pending = loaded.instance.sendQuestion()
    await new Promise(resolve => setImmediate(resolve))
    activeApp = appFor(8, 'session-b')
    const error = new Error('登录状态已变化，请重新提问。')
    error.code = 'stale_session'
    rejectA(error)
    await pending

    assert.deepEqual(loaded.instance.data.messages, [])
    assert.equal(loaded.instance.data.pageHelp, null)
    assert.equal(loaded.instance.data.error, '')
    assert.equal(loaded.instance.data.loading, false)
    assert.equal(loaded.instance.data.retryable, false)
    assert.deepEqual(assistant.currentContext({ id: 8 }), { rental_order_query: null })
    assert.deepEqual(navigations, [])
  } finally { loaded.restore(); cleanGlobals() }
})

test('同一员工的 sessionKey 变化也会在下一次帮助请求前清空旧对话', async () => {
  assistant.clearContext()
  const requests = []
  let activeApp = appFor(7, 'session-a')
  const loaded = loadComponentWithData({ askAdminAssistantPromise: async request => {
    requests.push(request)
    return response('当前会话的页面说明。')
  } })
  installAppAndWx()
  global.getApp = () => activeApp
  try {
    loaded.instance.data.input = '旧 session 的问题'
    await loaded.instance.sendQuestion()
    activeApp = appFor(7, 'session-b')
    loaded.instance.data.pageKey = 'pages/admin/rent/new_rent_list'
    await loaded.instance.loadPageHelp()

    assert.deepEqual(requests[1].conversation, [])
    assert.equal(loaded.instance.data.pageHelp.text, '当前会话的页面说明。')
    assert.deepEqual(loaded.instance.data.messages, [])
  } finally { loaded.restore(); cleanGlobals() }
})

test('A 的延迟初始页面说明在切换到 B 后不覆盖 B 的空白界面', async () => {
  assistant.clearContext()
  let resolveA
  let activeApp = appFor(7, 'session-a')
  const loaded = loadComponentWithData({ askAdminAssistantPromise: async () => new Promise(resolve => { resolveA = resolve }) })
  installAppAndWx()
  global.getApp = () => activeApp
  try {
    loaded.instance.data.pageKey = 'pages/admin/rent/new_rent_list'
    const pending = loaded.instance.loadPageHelp()
    await new Promise(resolve => setImmediate(resolve))
    activeApp = appFor(8, 'session-b')
    resolveA(response('A 的页面说明。', [], { rental_order_query: aprilState }))
    await pending

    assert.equal(loaded.instance.data.pageHelp, null)
    assert.deepEqual(loaded.instance.data.messages, [])
    assert.equal(loaded.instance.data.error, '')
    assert.equal(loaded.instance.data.loading, false)
  } finally { loaded.restore(); cleanGlobals() }
})

test('A 的重试请求在切换到 B 后不恢复 A 的对话或错误状态', async () => {
  assistant.clearContext()
  let resolveRetry
  let calls = 0
  let activeApp = appFor(7, 'session-a')
  const loaded = loadComponentWithData({ askAdminAssistantPromise: async () => {
    calls++
    if (calls === 1) throw new Error('network')
    return new Promise(resolve => { resolveRetry = resolve })
  } })
  installAppAndWx()
  global.getApp = () => activeApp
  try {
    loaded.instance.data.input = 'A 的重试问题'
    await loaded.instance.sendQuestion()
    assert.equal(loaded.instance.data.retryable, true)
    const retry = loaded.instance.onRetry()
    await new Promise(resolve => setImmediate(resolve))
    activeApp = appFor(8, 'session-b')
    resolveRetry(response('不应显示的 A 重试答复。'))
    await retry

    assert.equal(loaded.instance.data.error, '')
    assert.equal(loaded.instance.data.retryable, false)
    assert.equal(loaded.instance.data.pageHelp, null)
    assert.deepEqual(loaded.instance.data.messages, [])
  } finally { loaded.restore(); cleanGlobals() }
})

test('同一 owner 的旧 stale 请求不清除新请求 loading，当前 stale 请求会结算 loading', async () => {
  assistant.clearContext()
  const rejecters = []
  const loaded = loadComponentWithData({
    askAdminAssistantPromise: async () => new Promise((resolve, reject) => { rejecters.push(reject) }),
    isAdminAssistantStaleSessionError: error => error && error.code === 'stale_session'
  })
  installAppAndWx()
  try {
    loaded.instance.data.pageKey = 'pages/admin/rent/new_rent_list'
    const older = loaded.instance.loadPageHelp()
    await new Promise(resolve => setImmediate(resolve))
    const current = loaded.instance.loadPageHelp()
    await new Promise(resolve => setImmediate(resolve))
    const stale = new Error('登录状态已变化，请重新提问。')
    stale.code = 'stale_session'
    rejecters[0](stale)
    await older
    assert.equal(loaded.instance.data.loading, true)
    rejecters[1](stale)
    await current
    assert.equal(loaded.instance.data.loading, false)
    assert.equal(loaded.instance.data.error, '')
    assert.equal(loaded.instance.data.retryable, false)
  } finally { loaded.restore(); cleanGlobals() }
})

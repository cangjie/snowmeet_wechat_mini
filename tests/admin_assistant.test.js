const test = require('node:test')
const assert = require('node:assert/strict')

const assistant = require('../utils/adminAssistant.js')
const adminAiDomains = require('../utils/adminAiDomains.js')

/** 空上下文的完整形状：每个业务域一个键，外加当前进行中的域指针。 */
function emptyContextShape(overrides) {
  const shape = { active_query_type: null }
  adminAiDomains.CONTEXT_KEYS.forEach(key => { shape[key] = null })
  return Object.assign(shape, overrides || {})
}

const aprilUnpaid = {
  start_date: '2026-04-01', end_date: '2026-04-30', shop: '万龙服务中心',
  rent_status: '未支付', is_test: false, is_entertain: null,
  have_discount: true, use_card: false, has_retail: true,
  cell_suffix: '7788', keyword: '雪板'
}

test('同一员工的自然语言条件回顾会携带完整查询上下文，且不发送员工身份', () => {
  assistant.clearContext()
  assistant.acceptContext({ id: 7 }, { rental_order_query: aprilUnpaid })

  const request = assistant.buildRequest(
    'pages/admin/member/member_list', '当前查询条件是什么',
    Array.from({ length: 21 }, (_, index) => ({ role: 'user', content: String(index) })),
    { id: 7 }
  )

  assert.deepEqual(request.context.rental_order_query, aprilUnpaid)
  assert.equal(request.conversation.length, 20)
  assert.equal(request.conversation[0].content, '1')
  assert.equal(Object.hasOwn(request, 'staff_id'), false)
  assert.equal(Object.hasOwn(request, 'staff'), false)
})

test('请求对话投影为严格 binder 接受的 role/content JSON，且丢弃无效或超长条目', () => {
  assistant.clearContext()
  const request = assistant.buildRequest('pages/admin/member/member_list', '当前查询条件是什么', [
    { role: 'user', content: '上一轮问题', citations: [{ url: 'secret' }], ignored: true },
    { role: 'system', content: '不能发送' },
    { role: 'assistant', content: '上一轮答复', actions: [{ type: 'refund.execute' }] },
    { role: 'user', content: '过长'.repeat(1001) }
  ], { id: 7 })
  const serialized = JSON.parse(JSON.stringify(request))

  assert.deepEqual(serialized, {
    version: '1', page_key: 'pages/admin/member/member_list', question: '当前查询条件是什么',
    conversation: [
      { role: 'user', content: '上一轮问题' },
      { role: 'assistant', content: '上一轮答复' }
    ],
    context: emptyContextShape()
  })
  assert.ok(serialized.conversation.every(message => Object.keys(message).join(',') === 'role,content'))
})

test('从 API 接受 ISO 日期后，条件回顾和增量查询只发送 yyyy-MM-dd', () => {
  assistant.clearContext()
  assistant.acceptContext({ id: 7 }, {
    rental_order_query: {
      ...aprilUnpaid,
      start_date: '2026-04-01T00:00:00',
      end_date: '2026-04-30T00:00:00Z'
    }
  })

  const recall = assistant.buildRequest('pages/admin/member/member_list', '当前查询条件是什么', [], { id: 7 })
  const patch = assistant.buildRequest('pages/admin/member/member_list', '改成五月份', [], { id: 7 })
  assert.equal(recall.context.rental_order_query.start_date, '2026-04-01')
  assert.equal(recall.context.rental_order_query.end_date, '2026-04-30')
  assert.deepEqual(patch.context, recall.context)
})

test('切换员工或收到无效上下文时清除运行期查询上下文', () => {
  assistant.clearContext()
  assistant.acceptContext({ id: 7 }, { rental_order_query: aprilUnpaid })
  assert.equal(assistant.currentContext({ id: 8 }).rental_order_query, null)

  assistant.acceptContext({ id: 8 }, { rental_order_query: aprilUnpaid })
  assistant.acceptContext({ id: 8 }, { rental_order_query: { start_date: 'not-a-date' } })
  assert.equal(assistant.currentContext({ id: 8 }).rental_order_query, null)
})

test('只执行完成且状态完整的租赁结果 action，并只跳转固定列表路径', () => {
  assistant.clearContext()
  const urls = []
  assistant.executeActions([
    { type: 'rental_order.show_results', status: 'completed', state: aprilUnpaid }
  ], url => urls.push(url))

  assert.equal(urls.length, 1)
  assert.match(urls[0], /^\/pages\/admin\/rent\/new_rent_list\?aiIntent=/)
  assert.throws(
    () => assistant.executeActions([{ type: 'refund.execute', status: 'completed' }], () => {}),
    /暂不支持/
  )
  assert.throws(
    () => assistant.executeActions([{ type: 'rental_order.show_results', status: 'pending', state: aprilUnpaid }], () => {}),
    /暂不支持/
  )
  assert.throws(
    () => assistant.executeActions([{ type: 'rental_order.show_results', status: 'completed', state: { ...aprilUnpaid, unknown: 'value' } }], () => {}),
    /暂不支持/
  )
  assert.throws(
    () => assistant.executeActions([{ type: 'rental_order.show_results', status: 'completed', state: { ...aprilUnpaid, start_date: '2026-05-01', end_date: '2026-04-01' } }], () => {}),
    /暂不支持/
  )
  assert.throws(
    () => assistant.executeActions([
      { type: 'rental_order.show_results', status: 'completed', state: aprilUnpaid },
      { type: 'rental_order.show_results', status: 'completed', state: aprilUnpaid }
    ], () => {}),
    /暂不支持/
  )
})

test('执行器接受 API 序列化的日期时间状态并规范跳转为日期', () => {
  const urls = []
  assistant.executeActions([{
    type: 'rental_order.show_results', status: 'completed',
    state: { ...aprilUnpaid, start_date: '2026-04-01T00:00:00', end_date: '2026-04-30T00:00:00' }
  }], url => urls.push(url))
  assert.deepEqual(JSON.parse(decodeURIComponent(urls[0].split('aiIntent=')[1])).start_date, '2026-04-01T00:00:00')
})

function loadDataWithRequest(request) {
  const dataPath = require.resolve('../utils/data.js')
  const originalData = require.cache[dataPath]
  const originalWx = global.wx
  delete require.cache[dataPath]
  global.wx = {
    request(options) {
      let requestResult
      try {
        requestResult = request(options.url, options.data)
      } catch (error) {
        options.fail(error)
        return
      }
      Promise.resolve(requestResult).then(function (response) {
        options.success({ statusCode: 200, data: { code: 0, data: response } })
      }).catch(function (error) {
        options.fail(error)
      })
    }
  }
  global.getApp = () => ({ globalData: { requestPrefix: 'https://api.example/api/' } })
  const data = require('../utils/data.js')
  return {
    data,
    restore() {
      delete require.cache[dataPath]
      if (originalData) require.cache[dataPath] = originalData
      if (originalWx) global.wx = originalWx
      else delete global.wx
      delete global.getApp
    }
  }
}

test('统一 API 解包后的 v1 响应原样返回，并使用认证 session 而非客户端员工身份', async () => {
  assistant.clearContext()
  const received = {}
  const response = {
    version: '1', trace_id: 'trace-1', reply: { text: '共 12 单。', citations: [] }, actions: [],
    context: { rental_order_query: aprilUnpaid }
  }
  const loaded = loadDataWithRequest((url, body) => {
    received.url = url
    received.body = body
    return Promise.resolve(response)
  })
  try {
    const result = await loaded.data.askAdminAssistantPromise({ version: '1', page_key: 'pages/admin/member/member_list' }, 'session / one')
    assert.equal(result, response)
    assert.match(received.url, /AdminAi\/AskAdminAssistantByStaff\?sessionKey=session%20%2F%20one/)
    assert.match(received.url, /sessionType=wechat_mini_openid/)
    assert.equal(Object.hasOwn(received.body, 'staff_id'), false)
  } finally {
    loaded.restore()
  }
})

test('统一 API 错误或无效响应会清空当前员工的查询上下文', async () => {
  assistant.clearContext()
  assistant.acceptContext({ id: 7 }, { rental_order_query: aprilUnpaid })
  const failed = loadDataWithRequest(() => Promise.reject(new Error('network')))
  try {
    await assert.rejects(() => failed.data.askAdminAssistantPromise({ version: '1' }, 'session-1'), /暂不可用/)
    assert.equal(assistant.currentContext({ id: 7 }).rental_order_query, null)
  } finally {
    failed.restore()
  }

  assistant.acceptContext({ id: 7 }, { rental_order_query: aprilUnpaid })
  const invalid = loadDataWithRequest(() => Promise.resolve({ version: '2' }))
  try {
    await assert.rejects(() => invalid.data.askAdminAssistantPromise({ version: '1' }, 'session-1'), /暂不可用/)
    assert.equal(assistant.currentContext({ id: 7 }).rental_order_query, null)
  } finally {
    invalid.restore()
  }
})

test('旧员工的统一请求失败不会清除已切换员工的上下文', async () => {
  assistant.clearContext()
  assistant.acceptContext({ id: 7 }, { rental_order_query: aprilUnpaid })
  let rejectRequest
  const loaded = loadDataWithRequest(() => new Promise((resolve, reject) => { rejectRequest = reject }))
  try {
    const failedRequest = loaded.data.askAdminAssistantPromise({ version: '1' }, 'session-a')
    const mayContext = { ...aprilUnpaid, shop: '密苑云顶' }
    assistant.acceptContext({ id: 8 }, { rental_order_query: mayContext })

    rejectRequest(new Error('network'))
    await assert.rejects(() => failedRequest, /暂不可用/)
    assert.deepEqual(assistant.currentContext({ id: 8 }).rental_order_query, mayContext)
  } finally {
    loaded.restore()
  }
})

test('旧员工的统一请求延迟成功时返回安全 stale_session 信号且不改变新员工上下文', async () => {
  assistant.clearContext()
  assistant.acceptContext({ id: 7 }, { rental_order_query: aprilUnpaid })
  let resolveRequest
  const loaded = loadDataWithRequest(() => new Promise(resolve => { resolveRequest = resolve }))
  try {
    const pending = loaded.data.askAdminAssistantPromise({ version: '1' }, 'session-a')
    const mayContext = { ...aprilUnpaid, shop: '密苑云顶' }
    assistant.acceptContext({ id: 8 }, { rental_order_query: mayContext })
    resolveRequest({
      version: '1', trace_id: 'trace-a', reply: { text: '不应显示的旧答复', citations: [] }, actions: [],
      context: { rental_order_query: aprilUnpaid }
    })

    await assert.rejects(() => pending, error => error && error.code === 'stale_session' && /登录状态已变化/.test(error.message))
    assert.deepEqual(assistant.currentContext({ id: 8 }).rental_order_query, mayContext)
  } finally {
    loaded.restore()
  }
})


test('每个业务域的 action 只跳自己的列表页', () => {
  assistant.clearContext()
  const april = { start_date: '2026-04-01', end_date: '2026-04-30' }
  const cases = [
    ['care_order.show_results', Object.assign({}, april, {
      shop: null, is_test: null, is_entertain: null, have_discount: null,
      cell_suffix: null, use_card: null, is_summer_care: true, keyword: null
    }), /^\/pages\/admin\/care\/care_order_list\?aiIntent=/],
    ['retail_order.show_results', Object.assign({}, april, {
      shop: null, is_test: null, is_entertain: null, have_discount: null,
      cell_suffix: null, retail_type: '养护卡类'
    }), /^\/pages\/admin\/retail\/retail_order_list\?aiIntent=/],
    ['ski_pass.show_results', april, /^\/pages\/admin\/ski_pass\/dhhs_skipass_order\?aiIntent=/]
  ]

  cases.forEach(([type, state, expected]) => {
    const urls = []
    assistant.executeActions([{ type, status: 'completed', state }], url => urls.push(url))
    assert.equal(urls.length, 1, type)
    assert.match(urls[0], expected)
  })
})

test('别的域的条件混进来时拒绝执行，不跳转', () => {
  assistant.clearContext()
  const april = { start_date: '2026-04-01', end_date: '2026-04-30' }
  // 养护域没有 rent_status / has_retail，这正是线上那个 bug 的形状
  assert.throws(() => assistant.executeActions([{
    type: 'care_order.show_results', status: 'completed',
    state: Object.assign({}, april, {
      shop: null, is_test: null, is_entertain: null, have_discount: null,
      cell_suffix: null, use_card: null, is_summer_care: null, keyword: null,
      rent_status: '未支付'
    })
  }], () => {}), /暂不支持/)

  // 雪票域只有日期
  assert.throws(() => assistant.executeActions([{
    type: 'ski_pass.show_results', status: 'completed',
    state: Object.assign({}, april, { shop: '万龙服务中心' })
  }], () => {}), /暂不支持/)

  // 压根不存在的业务域
  assert.throws(() => assistant.executeActions([{
    type: 'payroll.show_results', status: 'completed', state: april
  }], () => {}), /暂不支持/)
})

test('多个业务域的上下文各自保留，互不冲掉', () => {
  assistant.clearContext()
  const rental = {
    start_date: '2026-04-01', end_date: '2026-04-30', shop: null, rent_status: '未支付',
    is_test: null, is_entertain: null, have_discount: null, use_card: null,
    has_retail: null, cell_suffix: null, keyword: null
  }
  const care = {
    start_date: '2026-05-01', end_date: '2026-05-31', shop: null, is_test: null,
    is_entertain: null, have_discount: null, cell_suffix: null, use_card: null,
    is_summer_care: true, keyword: null
  }

  assistant.acceptContext({ id: 7 }, {
    active_query_type: 'care_order.query', rental_order_query: rental, care_order_query: care
  })
  const saved = assistant.currentContext({ id: 7 })

  assert.deepEqual(saved.rental_order_query, rental)
  assert.deepEqual(saved.care_order_query, care)
  assert.equal(saved.active_query_type, 'care_order.query')
  assert.equal(saved.retail_order_query, null)
})

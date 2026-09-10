const test = require('node:test')
const assert = require('node:assert/strict')

const assistant = require('../utils/adminAssistant.js')

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
  const utilPath = require.resolve('../utils/util.js')
  const originalData = require.cache[dataPath]
  const originalUtil = require.cache[utilPath]
  delete require.cache[dataPath]
  require.cache[utilPath] = {
    id: utilPath,
    filename: utilPath,
    loaded: true,
    exports: { performWebRequest: request }
  }
  global.getApp = () => ({ globalData: { requestPrefix: 'https://api.example/api/' } })
  const data = require('../utils/data.js')
  return {
    data,
    restore() {
      delete require.cache[dataPath]
      if (originalData) require.cache[dataPath] = originalData
      if (originalUtil) require.cache[utilPath] = originalUtil
      else delete require.cache[utilPath]
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
    await assert.rejects(() => failed.data.askAdminAssistantPromise({ version: '1' }, 'session-1'), /network/)
    assert.equal(assistant.currentContext({ id: 7 }).rental_order_query, null)
  } finally {
    failed.restore()
  }

  assistant.acceptContext({ id: 7 }, { rental_order_query: aprilUnpaid })
  const invalid = loadDataWithRequest(() => Promise.resolve({ version: '2' }))
  try {
    await assert.rejects(() => invalid.data.askAdminAssistantPromise({ version: '1' }, 'session-1'), /响应格式/)
    assert.equal(assistant.currentContext({ id: 7 }).rental_order_query, null)
  } finally {
    invalid.restore()
  }
})

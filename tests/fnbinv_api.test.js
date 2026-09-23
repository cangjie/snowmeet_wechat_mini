const test = require('node:test')
const assert = require('node:assert/strict')
const api = require('../pages/fnbinv/common/api.js')
const session = require('../pages/fnbinv/common/session.js')
const requestId = require('../pages/fnbinv/common/request-id.js')

const ctx = { prefix: 'https://x/api/', sessionKey: 'a%2Bb', shopId: 12 }

function fakeTransport(reply) {
  const calls = []
  api.setTransport(function (options) {
    calls.push(options)
    const r = typeof reply === 'function' ? reply(options, calls.length) : reply
    if (r.fail) options.fail({}); else options.success(r)
  })
  return calls
}

test('GET 把 sessionKey 原样拼在查询串，shopId 自动带上，空参数不拼', async () => {
  const calls = fakeTransport({ statusCode: 200, data: { code: 0, message: '', data: [1] } })
  const result = await api.get(ctx, 'FnbInventory/GetStock', { itemId: 5, keyword: '番茄 酱', empty: null })
  assert.deepEqual(result, [1])
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].url, 'https://x/api/FnbInventory/GetStock?sessionKey=a%2Bb&shopId=12&itemId=5&keyword=%E7%95%AA%E8%8C%84%20%E9%85%B1')
})

test('POST 的 sessionKey 在查询串，shopId 进 JSON 请求体', async () => {
  const calls = fakeTransport({ statusCode: 200, data: { code: 0, data: { documentId: '8' } } })
  await api.post(ctx, 'FnbInventory/PostOpen', { parentBatchId: 3, packCount: 1 })
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].url, 'https://x/api/FnbInventory/PostOpen?sessionKey=a%2Bb')
  assert.deepEqual(calls[0].data, { shopId: 12, parentBatchId: 3, packCount: 1 })
})

test('业务错误带回 code，HTTP 错误与断网归为可重试', async () => {
  fakeTransport({ statusCode: 200, data: { code: 3, message: '需要门店管理权限' } })
  await assert.rejects(api.get(ctx, 'A/B'), e => e.code === 3 && e.message === '需要门店管理权限' && !e.retryable)
  fakeTransport({ statusCode: 500, data: '<html>' })
  await assert.rejects(api.post(ctx, 'A/B', {}), e => e.status === 500 && e.retryable)
  fakeTransport({ fail: true })
  await assert.rejects(api.get(ctx, 'A/B'), e => e.retryable && /网络/.test(e.message))
  fakeTransport({ statusCode: 200, data: { code: 4, message: '库存已变化，请刷新后重试' } })
  await assert.rejects(api.get(ctx, 'A/B'), e => e.code === 4 && e.retryable)
})

test('分页接口取全：按 total 连续翻页', async () => {
  const calls = fakeTransport(function (options, n) {
    const rows = n === 1 ? new Array(100).fill(0).map((_, i) => i) : [100, 101]
    return { statusCode: 200, data: { code: 0, data: { total: 102, rows } } }
  })
  const rows = await api.getAll(ctx, 'FnbInventory/ListBatches', {})
  assert.equal(rows.length, 102)
  assert.equal(calls.length, 2)
  assert.match(calls[1].url, /page=2&pageSize=100/)
})

test('会话上下文：没有员工、没有绑定门店分别给出原因', async () => {
  const app = (staff, key) => ({ loginPromiseNew: Promise.resolve(), globalData: { staff, sessionKey: key, requestPrefix: 'https://x/api/' } })
  await assert.rejects(session.loadContext(app(null, 'k')), e => e.reason === 'login')
  await assert.rejects(session.loadContext(app({ id: 1, title_level: 100, base_shop_id: null }, 'k')), e => e.reason === 'noShop' && /门店/.test(e.message))
  const c = await session.loadContext(app({ id: 1, title_level: 200, base_shop_id: 12 }, 'k'))
  assert.deepEqual({ shopId: c.shopId, isManager: c.isManager, sessionKey: c.sessionKey, prefix: c.prefix }, { shopId: 12, isManager: true, sessionKey: 'k', prefix: 'https://x/api/' })
  const cook = await session.loadContext(app({ id: 2, title_level: 100, base_shop_id: 12 }, 'k'))
  assert.equal(cook.isManager, false)
})

test('请求号是 UUID v4，同一动作重试沿用、成功后换新', () => {
  const id = requestId.newRequestId()
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(new Set([...Array(500)].map(requestId.newRequestId)).size, 500)
  const keeper = requestId.createKeeper()
  const first = keeper.get('open:3')
  assert.equal(keeper.get('open:3'), first)
  keeper.done('open:3')
  assert.notEqual(keeper.get('open:3'), first)
})

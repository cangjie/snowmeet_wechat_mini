const test = require('node:test')
const assert = require('node:assert/strict')

function loadComponentWithData(fakeData) {
  const dataPath = require.resolve('../utils/data.js')
  const componentPath = require.resolve('../components/admin-page-help/index.js')
  delete require.cache[componentPath]
  require.cache[dataPath] = { id: dataPath, filename: dataPath, loaded: true, exports: fakeData }

  let definition = null
  global.Component = function (value) { definition = value }
  require(componentPath)
  delete global.Component

  const instance = {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(values) { Object.assign(this.data, values) }
  }
  Object.keys(definition.methods).forEach(function (name) {
    instance[name] = definition.methods[name].bind(instance)
  })
  return instance
}

test('帮助面板中的明确租赁订单查询会返回结果并跳转到筛选后的列表', async () => {
  let queryCalls = 0
  let helpCalls = 0
  let navigatedUrl = null
  const intent = {
    start_date: '2026-04-01', end_date: '2026-04-30', shop: null,
    rent_status: null, is_test: null, is_entertain: null,
    have_discount: null, use_card: null, cell_suffix: null, keyword: null
  }
  const component = loadComponentWithData({
    queryRentOrdersByNaturalLanguagePromise: async function (question, sessionKey) {
      queryCalls++
      assert.equal(question, '请查询一下今年4月份的租赁订单')
      assert.equal(sessionKey, 'session-1')
      return {
        traceId: 'trace-1', auditId: 1, intent,
        summary: {
          total: 12, chargeTotal: 3400, paidTotal: 3200,
          refundTotal: 100, unpaidCount: 2, statusCounts: { 租赁中: 2 },
          note: '统计基于当前筛选结果。'
        }
      }
    },
    askAdminPageHelpPromise: async function () {
      helpCalls++
      throw new Error('不应调用操作帮助')
    }
  })

  global.getApp = function () {
    return { loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'session-1' } }
  }
  global.wx = {
    navigateTo(options) { navigatedUrl = options.url }
  }
  component.data.input = '请查询一下今年4月份的租赁订单'

  await component.sendQuestion()
  await new Promise(function (resolve) { setImmediate(resolve) })

  assert.equal(queryCalls, 1)
  assert.equal(helpCalls, 0)
  assert.match(navigatedUrl, /^\/pages\/admin\/rent\/new_rent_list\?aiIntent=/)
  assert.deepEqual(component.data.messages, [
    { role: 'user', content: '请查询一下今年4月份的租赁订单' },
    { role: 'assistant', content: '已按条件查询 12 单租赁订单。\n应收合计 ¥3400.00；实收 ¥3200.00；退款 ¥100.00。\n其中有 2 单尚未完成支付，建议优先核对。\n统计基于当前筛选结果。' }
  ])

  delete global.getApp
  delete global.wx
})

test('不支持的数据问题不会把后续操作问题锁在查询模式', async () => {
  let queryCalls = 0
  let helpCalls = 0
  const component = loadComponentWithData({
    queryRentOrdersByNaturalLanguagePromise: async function () {
      queryCalls++
      return { status: 'unsupported', clarification: '暂不支持这个查询。' }
    },
    askAdminPageHelpPromise: async function () {
      helpCalls++
      return { result: { answer: '这里是操作说明。', citations: [] } }
    }
  })
  global.getApp = function () {
    return { loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'session-1' } }
  }
  global.wx = { navigateTo() {} }

  component.data.input = '请查询租赁订单的异常趋势'
  await component.sendQuestion()
  assert.equal(component.data.queryMode, false)

  component.data.input = '这个页面怎么操作'
  await component.sendQuestion()
  assert.equal(queryCalls, 1)
  assert.equal(helpCalls, 1)
  assert.equal(component.data.messages.at(-1).content, '这里是操作说明。')

  delete global.getApp
  delete global.wx
})

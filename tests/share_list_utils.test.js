// 分账列表的纯函数（详情页跳转、选中汇总、默认日期范围）和三个接口封装。
const test = require('node:test')
const assert = require('node:assert/strict')
const api = require('../utils/introducer_api.js')
const shareList = require('../utils/share_list.js')

const PREFIX = 'https://x/api/'

test('点条目跳到各类型订单的详情页；雪票用雪票 id，没有就不跳', () => {
  const item = over => Object.assign({ orderId: 55, orderType: '租赁', skipassId: null }, over)
  assert.equal(shareList.detailUrl(item({ orderType: '租赁' })), '/pages/admin/rent/rent_order_detail/rent_order_detail?id=55')
  assert.equal(shareList.detailUrl(item({ orderType: '养护' })), '/pages/admin/care/care_order_detail/care_order_detail?id=55')
  assert.equal(shareList.detailUrl(item({ orderType: '零售' })), '/pages/admin/retail/retail_order_detail?id=55')
  assert.equal(shareList.detailUrl(item({ orderType: '雪票', skipassId: 21 })), '/pages/admin/ski_pass/common_skipass_detail?id=21')
  assert.equal(shareList.detailUrl(item({ orderType: '雪票', skipassId: null })), null)
  assert.equal(shareList.detailUrl(item({ orderType: '餐饮' })), null)
})

test('选中汇总：笔数、合计按两位小数、30 天前的条数（正好 30 天前不算旧，31 天前算）', () => {
  const rows = [
    { amount: 0.1, listDate: '2026-11-03' },
    { amount: 0.2, listDate: '2026-10-04' },   // 正好 30 天前
    { amount: 10, listDate: '2026-10-03' }     // 31 天前
  ]
  assert.deepEqual(shareList.summarize(rows, '2026-11-03'), { count: 3, total: 10.3, oldCount: 1 })
  assert.deepEqual(shareList.summarize([], '2026-11-03'), { count: 0, total: 0, oldCount: 0 })
  assert.deepEqual(shareList.summarize(rows.slice(0, 2), '2026-11-03'), { count: 2, total: 0.3, oldCount: 0 })
  assert.deepEqual(shareList.summarize(rows, '2026-11-03', 10), { count: 3, total: 10.3, oldCount: 2 })
})

test('默认日期范围：今天往前 30 天到今天（本地日期，跨月、跨年都对）', () => {
  assert.deepEqual(shareList.defaultRange('2026-11-03'), { startDate: '2026-10-04', endDate: '2026-11-03' })
  assert.deepEqual(shareList.defaultRange('2026-01-10'), { startDate: '2025-12-11', endDate: '2026-01-10' })
})

function setup(t) {
  const previous = { getApp: global.getApp }
  const calls = []
  api.setTransport(options => {
    calls.push({ url: options.url, method: options.method, body: options.data })
    setImmediate(() => options.success({ statusCode: 200, data: { code: 0, message: '', data: { ok: true } } }))
  })
  global.getApp = () => ({ globalData: { sessionKey: 'sk%2B1', requestPrefix: PREFIX } })
  t.after(() => {
    global.getApp = previous.getApp
    api.setTransport(function (options) { wx.request(options) })
  })
  return calls
}

test('三个接口封装：地址、方法、空值不发、body 原样', async t => {
  const calls = setup(t)
  await api.listShares({ status: '未分', type: '', mode: undefined, keyword: '李', startDate: '2026-10-04', endDate: null, pageIndex: 2, pageSize: 20 })
  await api.nextBatchNo()
  await api.completeManual({ orderShareIds: [11, 13], batchNo: 'MS-1' })

  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].url, PREFIX + 'ShareList/List?sessionKey=sk%2B1&status=' + encodeURIComponent('未分') + '&keyword=' + encodeURIComponent('李') +
    '&startDate=2026-10-04&pageIndex=2&pageSize=20')
  assert.equal(calls[1].method, 'GET')
  assert.equal(calls[1].url, PREFIX + 'ShareList/NextBatchNo?sessionKey=sk%2B1')
  assert.equal(calls[2].method, 'POST')
  assert.equal(calls[2].url, PREFIX + 'ShareList/CompleteManual?sessionKey=sk%2B1')
  assert.deepEqual(calls[2].body, { orderShareIds: [11, 13], batchNo: 'MS-1' })
})

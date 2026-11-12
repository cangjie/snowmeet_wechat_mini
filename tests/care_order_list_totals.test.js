const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle } = require('./reception_harness.js')

test('分页摘要使用服务器返回的全部筛选结果合计，并保留本页收款', async () => {
  global.getApp = () => ({ globalData: { sessionKey: 'test' } })
  global.wx = {}
  const page = loadPage('pages/admin/care/care_order_list.js', {
    IMAGE_HOST: '',
    getRentOrdersByStaffPagedPromise: () => Promise.resolve({
      items: [{ id: 1, biz_date: '2026-11-03', totalEarnAmount: 50, careProperties: {}, availablePayments: [], cares: [] }],
      total: 101, totalEarnAmount: 230.5
    })
  })
  page.getData(2, 50)
  await settle()
  assert.equal(page.data.totalEarnStr, '¥50.00')
  assert.equal(page.data.allEarnStr, '¥230.50')
  assert.equal(page.data.totalPages, 3)
  page.renderOrders([], 0, 1, 50, 0)
  assert.equal(page.data.allEarnStr, '¥0.00')
  page.renderOrders([], 0, 1, 50)
  assert.equal(page.data.allEarnStr, '暂不可用')
  delete global.getApp
  delete global.wx
})

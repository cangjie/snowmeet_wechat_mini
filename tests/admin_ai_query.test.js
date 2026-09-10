const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildRentOrderListUrl,
  readRentOrderIntent,
  buildRentOrderListState
} = require('../utils/adminAiQuery.js')

test('查询意图通过跳转参数完整传给租赁订单列表', () => {
  const intent = {
    start_date: '2026-04-01',
    end_date: '2026-04-30',
    shop: '万龙服务中心',
    rent_status: '未支付',
    is_test: null,
    is_entertain: false,
    have_discount: true,
    use_card: null,
    cell_suffix: '7788',
    keyword: '雪板'
  }

  const url = buildRentOrderListUrl(intent)
  assert.match(url, /^\/pages\/admin\/rent\/new_rent_list\?aiIntent=/)
  assert.deepEqual(readRentOrderIntent({ aiIntent: url.split('aiIntent=')[1] }), intent)
})

test('租赁订单列表使用 AI 条件替换默认筛选并从第一页查询', () => {
  const state = buildRentOrderListState({
    start_date: '2026-04-01T00:00:00',
    end_date: '2026-04-30T00:00:00',
    shop: null,
    rent_status: '全部归还',
    is_test: null,
    is_entertain: true,
    have_discount: false,
    use_card: true,
    has_retail: true,
    cell_suffix: null,
    keyword: null
  })

  assert.deepEqual(state, {
    aiQueryApplied: true,
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    shop: '',
    cell: null,
    keyword: null,
    page: 1,
    queryOptions: [
      { key: 'isTest', value: null },
      { key: 'isEntertain', value: true },
      { key: 'haveDiscount', value: false },
      { key: 'rentCategory', value: null },
      { key: 'rentItemName', value: null },
      { key: 'useCard', value: true },
      { key: 'status', value: '全部归还' },
      { key: 'hasRetail', value: true }
    ]
  })
})

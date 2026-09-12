const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildListUrl,
  readOrderIntent,
  buildListState,
  describeIntent
} = require('../utils/adminAiQuery.js')

const RENTAL = 'rental_order.show_results'
const CARE = 'care_order.show_results'
const RETAIL = 'retail_order.show_results'
const SKI_PASS = 'ski_pass.show_results'

test('查询意图通过跳转参数完整传给租赁订单列表', () => {
  const intent = {
    start_date: '2026-04-01',
    end_date: '2026-04-30',
    shop: '万龙服务中心',
    rent_status: '未支付',
    is_test: null,
    is_entertain: false,
    have_discount: true, has_retail: true,
    use_card: null,
    cell_suffix: '7788',
    keyword: '雪板'
  }

  const url = buildListUrl(RENTAL, intent)
  assert.match(url, /^\/pages\/admin\/rent\/new_rent_list\?aiIntent=/)
  assert.deepEqual(readOrderIntent({ aiIntent: url.split('aiIntent=')[1] }), intent)
})

test('每个业务域跳自己的列表页，未知域不生成 URL', () => {
  const intent = { start_date: '2026-04-01', end_date: '2026-04-30' }
  assert.match(buildListUrl(CARE, intent), /^\/pages\/admin\/care\/care_order_list\?aiIntent=/)
  assert.match(buildListUrl(RETAIL, intent), /^\/pages\/admin\/retail\/retail_order_list\?aiIntent=/)
  assert.match(buildListUrl(SKI_PASS, intent), /^\/pages\/admin\/ski_pass\/dhhs_skipass_order\?aiIntent=/)
  assert.equal(buildListUrl('payroll.show_results', intent), null)
})

test('租赁订单列表使用 AI 条件替换默认筛选并从第一页查询', () => {
  const state = buildListState(RENTAL, {
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
    ],
    shop: '',
    cell: null,
    keyword: null
  })
})

test('养护列表的 queryOptions 形状与养护页一致，且不含租赁专有项', () => {
  const state = buildListState(CARE, {
    start_date: '2026-04-01', end_date: '2026-04-30', shop: '万龙服务中心',
    is_test: false, is_entertain: null, have_discount: null,
    cell_suffix: null, use_card: true, is_summer_care: true, keyword: null
  })

  assert.deepEqual(state.queryOptions, [
    { key: 'isTest', value: false },
    { key: 'isEntertain', value: null },
    { key: 'haveDiscount', value: null },
    { key: 'summer', value: true },
    { key: 'useCard', value: true }
  ])
  assert.equal(state.shop, '万龙服务中心')
})

test('零售列表映射零售子类型，雪票只有日期没有门店和关键词', () => {
  const retail = buildListState(RETAIL, {
    start_date: '2026-04-01', end_date: '2026-04-30', shop: null,
    is_test: null, is_entertain: null, have_discount: null,
    cell_suffix: null, retail_type: '养护卡类'
  })
  assert.deepEqual(retail.queryOptions, [
    { key: 'isTest', value: null },
    { key: 'isEntertain', value: null },
    { key: 'retailType', value: '养护卡类' }
  ])
  assert.equal(Object.prototype.hasOwnProperty.call(retail, 'keyword'), false)

  const skiPass = buildListState(SKI_PASS, { start_date: '2026-04-01', end_date: '2026-04-30' })
  assert.deepEqual(skiPass.queryOptions, [])
  assert.equal(Object.prototype.hasOwnProperty.call(skiPass, 'shop'), false)
  assert.equal(skiPass.startDate, '2026-04-01')
})

test('条件摘要先说清是哪个业务域，再逐项列出本域条件', () => {
  const summary = describeIntent(CARE, {
    start_date: '2026-04-01', end_date: '2026-04-30', shop: '万龙服务中心',
    is_test: false, is_entertain: null, have_discount: null,
    cell_suffix: '7788', use_card: null, is_summer_care: true, keyword: null
  })

  assert.match(summary, /^养护订单；日期：2026-04-01 至 2026-04-30/)
  assert.match(summary, /门店：万龙服务中心/)
  assert.match(summary, /非雪季：包含/)
  assert.match(summary, /手机号后缀：7788/)
  // 养护域没有租赁状态，摘要里也不该出现
  assert.equal(summary.includes('状态'), false)
})

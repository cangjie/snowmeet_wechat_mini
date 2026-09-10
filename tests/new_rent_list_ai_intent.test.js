const test = require('node:test')
const assert = require('node:assert/strict')
const { buildRentOrderListUrl } = require('../utils/adminAiQuery.js')

function loadPage() {
  const pagePath = require.resolve('../pages/admin/rent/new_rent_list.js')
  delete require.cache[pagePath]
  global.getApp = function () {
    return { loginPromiseNew: Promise.resolve(), globalData: {} }
  }
  let definition = null
  global.Page = function (value) { definition = value }
  require(pagePath)
  delete global.Page
  delete global.getApp

  return {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(values) { Object.assign(this.data, values) },
    onLoad: definition.onLoad,
    shopSelected: definition.shopSelected,
    _buildQueryParams: definition._buildQueryParams
  }
}

test('租赁订单列表首次加载时应用帮助系统传入的 AI 查询条件', () => {
  const intent = {
    start_date: '2026-04-01', end_date: '2026-04-30', shop: '万龙服务中心',
    rent_status: '未支付', is_test: null, is_entertain: false,
    have_discount: true, use_card: null, has_retail: null, cell_suffix: null, keyword: '雪板'
  }
  const encoded = buildRentOrderListUrl(intent).split('aiIntent=')[1]
  const page = loadPage()

  page.onLoad.call(page, { aiIntent: encoded })

  assert.equal(page.data.startDate, '2026-04-01')
  assert.equal(page.data.endDate, '2026-04-30')
  assert.equal(page.data.shop, '万龙服务中心')
  assert.equal(page.data.keyword, '雪板')
  assert.deepEqual(page.data.queryOptions.slice(0, 3), [
    { key: 'isTest', value: null },
    { key: 'isEntertain', value: false },
    { key: 'haveDiscount', value: true }
  ])
  assert.deepEqual(page.data.queryOptions[6], { key: 'status', value: '未支付' })

  // 店铺组件初始化时可能按员工基地店发出一次自动选择，不能覆盖 AI 明确指定的店铺。
  page.shopSelected.call(page, { detail: { shop: '万龙体验中心' } })
  assert.equal(page.data.shop, '万龙服务中心')

  // 初始化之后，用户手动选择门店仍应正常生效。
  page.shopSelected.call(page, { detail: { shop: '崇礼旗舰店' } })
  assert.equal(page.data.shop, '崇礼旗舰店')
})

test('AI 复合查询中的手机号不应冲掉日期门店和其它筛选条件', () => {
  const intent = {
    start_date: '2026-04-01T00:00:00', end_date: '2026-04-30T00:00:00',
    shop: '崇礼旗舰店', rent_status: '未支付', is_test: true,
    is_entertain: false, have_discount: true, use_card: false, has_retail: true,
    cell_suffix: '7788', keyword: null
  }
  const encoded = buildRentOrderListUrl(intent).split('aiIntent=')[1]
  const page = loadPage()
  page.onLoad.call(page, { aiIntent: encoded })

  const params = page._buildQueryParams.call(page)

  assert.equal(params.startDate, '2026-04-01')
  assert.equal(params.endDate, '2026-04-30')
  assert.equal(params.shop, '崇礼旗舰店')
  assert.equal(params.cell, '7788')
  assert.equal(params.isTest, true)
  assert.equal(params.isEntertain, false)
  assert.equal(params.haveDiscount, true)
  assert.equal(params.useCard, false)
  assert.equal(params.rentStatus, '未支付')
  assert.equal(params.hasRetail, true)
})

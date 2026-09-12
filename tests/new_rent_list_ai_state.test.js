const test = require('node:test')
const assert = require('node:assert/strict')
const adminAiQuery = require('../utils/adminAiQuery.js')

const fullState = {
  start_date: '2026-04-01', end_date: '2026-04-30', shop: '万龙', rent_status: '未支付',
  is_test: false, is_entertain: true, have_discount: false, use_card: true, has_retail: true,
  cell_suffix: '7788', keyword: '雪板'
}

function loadPage() {
  const pagePath = require.resolve('../pages/admin/rent/new_rent_list.js')
  delete require.cache[pagePath]
  let definition
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: {} })
  global.Page = value => { definition = value }
  require(pagePath)
  delete global.Page
  const instance = { data: JSON.parse(JSON.stringify(definition.data)), setData(values) { Object.assign(this.data, values) } }
  Object.keys(definition).forEach(name => { if (typeof definition[name] === 'function') instance[name] = definition[name].bind(instance) })
  return { instance, restore() { delete require.cache[pagePath]; delete global.getApp } }
}

test('AI 租赁列表解码完整条件，显示条件摘要并原样生成分页查询参数', () => {
  const state = adminAiQuery.buildListState('rental_order.show_results', fullState)
  assert.equal(state.queryOptions.find(option => option.key === 'hasRetail').value, true)
  assert.equal(state.cell, '7788')
  assert.equal(state.keyword, '雪板')
  const loaded = loadPage()
  try {
    loaded.instance.onLoad({ aiIntent: encodeURIComponent(JSON.stringify(fullState)) })
    assert.equal(loaded.instance.data.aiQueryApplied, true)
    assert.equal(loaded.instance.data.startDate, '2026-04-01')
    assert.equal(loaded.instance.data.endDate, '2026-04-30')
    assert.equal(loaded.instance.data.shop, '万龙')
    assert.match(loaded.instance.data.aiQueryConditions, /门店：万龙/)
    assert.match(loaded.instance.data.aiQueryConditions, /零售子单：包含/)
    assert.match(loaded.instance.data.aiQueryConditions, /手机号后缀：7788/)
    assert.match(loaded.instance.data.aiQueryConditions, /关键词：雪板/)
    assert.deepEqual(loaded.instance._buildQueryParams(), { shop: '万龙', startDate: '2026-04-01', endDate: '2026-04-30', cell: '7788', keyword: '雪板', isTest: false, isEntertain: true, haveDiscount: false, rentCategoryId: null, rentItemName: null, useCard: true, rentStatus: '未支付', hasRetail: true })
  } finally { loaded.restore() }
})

test('缺失或非法 AI 查询参数安全回退到默认日期筛选', () => {
  const loaded = loadPage()
  try {
    loaded.instance.onLoad({ aiIntent: encodeURIComponent(JSON.stringify({ start_date: '2026-04-01' })) })
    assert.notEqual(loaded.instance.data.aiQueryApplied, true)
    assert.match(loaded.instance.data.startDate, /^\d{4}-\d{2}-\d{2}$/)
    assert.match(loaded.instance.data.endDate, /^\d{4}-\d{2}-\d{2}$/)
  } finally { loaded.restore() }
})

/**
 * 管理员助手的业务域表，与 SnowmeetApi 的 AdminAssistantDomains 和
 * reqai 的 admin_assistant_capabilities 一一对应。
 *
 * 字段校验、跳转路径白名单、页面状态映射和条件摘要全部从这里派生。
 * 加一个业务域：在这里加一条，并让对应列表页在 onLoad 里承接 aiIntent。
 */

// queryOptions 是各列表页自己的数组形状，顺序必须和页面 wxml 里的索引一致。
const DOMAINS = {
  'rental_order.show_results': {
    queryType: 'rental_order.query',
    domain: 'rental',
    label: '租赁订单',
    unit: '单',
    contextKey: 'rental_order_query',
    path: '/pages/admin/rent/new_rent_list',
    fields: ['start_date', 'end_date', 'shop', 'is_test', 'is_entertain', 'have_discount',
      'cell_suffix', 'rent_status', 'use_card', 'has_retail', 'keyword'],
    booleanFields: ['is_test', 'is_entertain', 'have_discount', 'use_card', 'has_retail'],
    queryOptions: [
      { key: 'isTest', from: 'is_test' },
      { key: 'isEntertain', from: 'is_entertain' },
      { key: 'haveDiscount', from: 'have_discount' },
      { key: 'rentCategory', from: null },
      { key: 'rentItemName', from: null },
      { key: 'useCard', from: 'use_card' },
      { key: 'status', from: 'rent_status' },
      { key: 'hasRetail', from: 'has_retail' }
    ],
    labels: {
      shop: '门店', rent_status: '状态', is_test: '测试', is_entertain: '招待',
      have_discount: '减免', use_card: '次卡', has_retail: '零售子单',
      cell_suffix: '手机号后缀', keyword: '关键词'
    }
  },
  'care_order.show_results': {
    queryType: 'care_order.query',
    domain: 'care',
    label: '养护订单',
    unit: '单',
    contextKey: 'care_order_query',
    path: '/pages/admin/care/care_order_list',
    fields: ['start_date', 'end_date', 'shop', 'is_test', 'is_entertain', 'have_discount',
      'cell_suffix', 'use_card', 'is_summer_care', 'keyword'],
    booleanFields: ['is_test', 'is_entertain', 'have_discount', 'use_card', 'is_summer_care'],
    queryOptions: [
      { key: 'isTest', from: 'is_test' },
      { key: 'isEntertain', from: 'is_entertain' },
      { key: 'haveDiscount', from: 'have_discount' },
      { key: 'summer', from: 'is_summer_care' },
      { key: 'useCard', from: 'use_card' }
    ],
    labels: {
      shop: '门店', is_test: '测试', is_entertain: '招待', have_discount: '减免',
      use_card: '次卡', is_summer_care: '非雪季', cell_suffix: '手机号后缀', keyword: '关键词'
    }
  },
  'retail_order.show_results': {
    queryType: 'retail_order.query',
    domain: 'retail',
    label: '零售订单',
    unit: '单',
    contextKey: 'retail_order_query',
    path: '/pages/admin/retail/retail_order_list',
    fields: ['start_date', 'end_date', 'shop', 'is_test', 'is_entertain', 'have_discount',
      'cell_suffix', 'retail_type'],
    booleanFields: ['is_test', 'is_entertain', 'have_discount'],
    queryOptions: [
      { key: 'isTest', from: 'is_test' },
      { key: 'isEntertain', from: 'is_entertain' },
      { key: 'retailType', from: 'retail_type' }
    ],
    labels: {
      shop: '门店', is_test: '测试', is_entertain: '招待', have_discount: '减免',
      cell_suffix: '手机号后缀', retail_type: '类型'
    }
  },
  'ski_pass.show_results': {
    queryType: 'ski_pass.query',
    domain: 'ski_pass',
    label: '雪票',
    unit: '张',
    contextKey: 'ski_pass_query',
    path: '/pages/admin/ski_pass/dhhs_skipass_order',
    fields: ['start_date', 'end_date'],
    booleanFields: [],
    queryOptions: [],
    labels: {}
  }
}

const CONTEXT_KEYS = Object.keys(DOMAINS).map(function (type) { return DOMAINS[type].contextKey })

function byActionType(type) {
  return Object.prototype.hasOwnProperty.call(DOMAINS, type) ? DOMAINS[type] : null
}

/** 服务端的 active_query_type 用的是规划器侧的 <域>.query，不是下发的 show_results。 */
function byQueryType(queryType) {
  var types = Object.keys(DOMAINS)
  for (var index = 0; index < types.length; index++) {
    if (DOMAINS[types[index]].queryType === queryType) return DOMAINS[types[index]]
  }
  return null
}

function byContextKey(contextKey) {
  var types = Object.keys(DOMAINS)
  for (var index = 0; index < types.length; index++) {
    if (DOMAINS[types[index]].contextKey === contextKey) return DOMAINS[types[index]]
  }
  return null
}

function byPageRoute(route) {
  var normalized = '/' + String(route || '').replace(/^\//, '')
  var types = Object.keys(DOMAINS)
  for (var index = 0; index < types.length; index++) {
    if (DOMAINS[types[index]].path === normalized) return DOMAINS[types[index]]
  }
  return null
}

module.exports = {
  DOMAINS,
  CONTEXT_KEYS,
  byActionType,
  byQueryType,
  byContextKey,
  byPageRoute
}

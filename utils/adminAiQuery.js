function isRentOrderDataQuery(question) {
  var text = (question || '').replace(/\s+/g, '')
  if (!text || !/(租赁|出租)/.test(text) || !/(订单|单据)/.test(text)) return false
  if (/(如何|怎么|怎样|哪里|在哪|操作|步骤|使用|功能|为什么)/.test(text)) return false
  return /(?:请(?:帮我)?(?:查询|查)(?:一下)?|帮我(?:查询|查)|查询|查一下|统计|多少|几单|合计|有哪些|列出|显示)/.test(text)
}

function buildRentOrderListUrl(intent) {
  return '/pages/admin/rent/new_rent_list?aiIntent=' + encodeURIComponent(JSON.stringify(intent || {}))
}

function readRentOrderIntent(options) {
  if (!options || !options.aiIntent) return null
  try {
    return JSON.parse(decodeURIComponent(options.aiIntent))
  } catch (error) {
    return null
  }
}

function _nullable(value) {
  return value == null ? null : value
}

function _dateOnly(value) {
  if (value == null) return null
  return String(value).split('T')[0].split(' ')[0]
}

function buildRentOrderListState(intent) {
  intent = intent || {}
  return {
    aiQueryApplied: true,
    startDate: _dateOnly(intent.start_date),
    endDate: _dateOnly(intent.end_date),
    shop: intent.shop == null ? '' : intent.shop,
    cell: _nullable(intent.cell_suffix),
    keyword: _nullable(intent.keyword),
    page: 1,
    queryOptions: [
      { key: 'isTest', value: _nullable(intent.is_test) },
      { key: 'isEntertain', value: _nullable(intent.is_entertain) },
      { key: 'haveDiscount', value: _nullable(intent.have_discount) },
      { key: 'rentCategory', value: null },
      { key: 'rentItemName', value: null },
      { key: 'useCard', value: _nullable(intent.use_card) },
      { key: 'status', value: _nullable(intent.rent_status) },
      { key: 'hasRetail', value: null }
    ]
  }
}

module.exports = {
  isRentOrderDataQuery,
  buildRentOrderListUrl,
  readRentOrderIntent,
  buildRentOrderListState
}

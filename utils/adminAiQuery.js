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
      { key: 'hasRetail', value: _nullable(intent.has_retail) }
    ]
  }
}

module.exports = {
  buildRentOrderListUrl,
  readRentOrderIntent,
  buildRentOrderListState
}

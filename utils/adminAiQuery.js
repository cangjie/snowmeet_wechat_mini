const adminAiDomains = require('./adminAiDomains.js')

/** 跳转目标页由业务域决定，不再写死租赁列表。 */
function buildListUrl(actionType, intent) {
  var domain = adminAiDomains.byActionType(actionType)
  if (domain == null) return null
  return domain.path + '?aiIntent=' + encodeURIComponent(JSON.stringify(intent || {}))
}

function readOrderIntent(options) {
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

/**
 * intent（蛇形、服务端口径）→ 页面 data（camelCase、各页自己的形状）。
 * queryOptions 的顺序来自业务域表，必须和页面 wxml 的索引一致。
 */
function buildListState(actionType, intent) {
  var domain = adminAiDomains.byActionType(actionType)
  if (domain == null) return null
  intent = intent || {}
  var state = {
    aiQueryApplied: true,
    startDate: _dateOnly(intent.start_date),
    endDate: _dateOnly(intent.end_date),
    page: 1,
    queryOptions: domain.queryOptions.map(function (option) {
      return { key: option.key, value: option.from == null ? null : _nullable(intent[option.from]) }
    })
  }
  if (domain.fields.indexOf('shop') >= 0) state.shop = intent.shop == null ? '' : intent.shop
  if (domain.fields.indexOf('cell_suffix') >= 0) state.cell = _nullable(intent.cell_suffix)
  if (domain.fields.indexOf('keyword') >= 0) state.keyword = _nullable(intent.keyword)
  return state
}

function _booleanLabel(value, whenTrue, whenFalse) {
  if (value == null) return '全部'
  return value ? whenTrue : whenFalse
}

/**
 * 条件摘要：把这次实际生效的条件逐项写出来，让店员一眼能发现答非所问。
 * 这是「答案可证伪」在前端的一半，另一半是服务端拼的口径行。
 */
function describeIntent(actionType, intent) {
  var domain = adminAiDomains.byActionType(actionType)
  if (domain == null || intent == null) return ''
  var parts = [domain.label]
  if (intent.start_date && intent.end_date) {
    parts.push('日期：' + _dateOnly(intent.start_date) + ' 至 ' + _dateOnly(intent.end_date))
  }
  domain.fields.forEach(function (field) {
    if (field === 'start_date' || field === 'end_date') return
    var label = domain.labels[field] || field
    var value = intent[field]
    if (domain.booleanFields.indexOf(field) >= 0) {
      parts.push(label + '：' + _booleanLabel(value, '包含', '不含'))
    } else {
      parts.push(label + '：' + (value == null || value === '' ? '全部' : value))
    }
  })
  return parts.join('；')
}

module.exports = {
  buildListUrl,
  readOrderIntent,
  buildListState,
  describeIntent
}

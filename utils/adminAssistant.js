const adminAiQuery = require('./adminAiQuery.js')

const unsupportedActionMessage = '当前版本暂不支持此操作，请升级后重试'
const queryFields = [
  'start_date', 'end_date', 'shop', 'rent_status', 'is_test', 'is_entertain',
  'have_discount', 'use_card', 'has_retail', 'cell_suffix', 'keyword'
]
const nullableBooleanFields = new Set([
  'is_test', 'is_entertain', 'have_discount', 'use_card', 'has_retail'
])
const maxRentOrderListUrlLength = 1800

let ownerStaffId = null
let ownerSessionKey = null
let contextGeneration = 0
let context = emptyContext()

function emptyContext() {
  return { rental_order_query: null }
}

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

function syncStaff(staff) {
  const nextStaffId = staff && staff.id != null ? String(staff.id) : null
  if (nextStaffId !== ownerStaffId) {
    ownerStaffId = nextStaffId
    ownerSessionKey = null
    contextGeneration++
    context = emptyContext()
  }
}

function captureRequestOwner(sessionKey) {
  const nextSessionKey = sessionKey == null ? null : String(sessionKey)
  if (ownerSessionKey != null && ownerSessionKey !== nextSessionKey) {
    context = emptyContext()
    contextGeneration++
  }
  ownerSessionKey = nextSessionKey
  return { staffId: ownerStaffId, sessionKey: ownerSessionKey, generation: contextGeneration }
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
}

function isDateOnly(value) {
  if (typeof value !== 'string') return false
  const match = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(value)
  if (!match || Number.isNaN(Date.parse(value))) return false
  return new Date(match[1] + 'T00:00:00Z').toISOString().slice(0, 10) === match[1]
}

function isNullableString(value) {
  return value == null || typeof value === 'string'
}

function isBoundedNullableString(value, maxLength) {
  return isNullableString(value) && (value == null || value.length <= maxLength)
}

function isValidQueryState(state) {
  if (!isPlainObject(state)) return false
  if (Object.keys(state).some(key => !queryFields.includes(key))) return false
  if (!queryFields.every(key => Object.hasOwn(state, key))) return false
  if (!isDateOnly(state.start_date) || !isDateOnly(state.end_date)) return false
  const startDate = new Date(state.start_date.slice(0, 10) + 'T00:00:00Z')
  const endDate = new Date(state.end_date.slice(0, 10) + 'T00:00:00Z')
  if (endDate < startDate || endDate - startDate > 365 * 24 * 60 * 60 * 1000) return false
  if (!isBoundedNullableString(state.shop, 64) || !isBoundedNullableString(state.rent_status, 64) ||
      !isBoundedNullableString(state.keyword, 100)) return false
  if (state.cell_suffix != null && (!/^\d{4,15}$/.test(state.cell_suffix))) return false
  return queryFields.every(key =>
    !nullableBooleanFields.has(key) || state[key] == null || typeof state[key] === 'boolean'
  )
}

function isValidContext(nextContext) {
  return isPlainObject(nextContext) &&
    Object.keys(nextContext).length === 1 &&
    Object.hasOwn(nextContext, 'rental_order_query') &&
    (nextContext.rental_order_query === null || isValidQueryState(nextContext.rental_order_query))
}

function isValidResponse(response) {
  return isPlainObject(response) && response.version === '1' &&
    typeof response.trace_id === 'string' && isPlainObject(response.reply) &&
    typeof response.reply.text === 'string' && response.reply.text.length > 0 &&
    Array.isArray(response.actions) && isValidContext(response.context)
}

function buildRequest(pageKey, question, conversation, staff) {
  syncStaff(staff)
  return {
    version: '1',
    page_key: pageKey,
    question,
    conversation: (conversation || []).slice(-20).map(copy),
    context: copy(context)
  }
}

function acceptContext(staff, nextContext) {
  syncStaff(staff)
  context = isValidContext(nextContext) ? copy(nextContext) : emptyContext()
  contextGeneration++
  return currentContext(staff)
}

function currentContext(staff) {
  syncStaff(staff)
  return copy(context)
}

function clearContext() {
  ownerStaffId = null
  ownerSessionKey = null
  contextGeneration++
  context = emptyContext()
}

function clearContextForOwner(owner) {
  if (!owner || owner.staffId !== ownerStaffId || owner.sessionKey !== ownerSessionKey ||
      owner.generation !== contextGeneration) return false
  context = emptyContext()
  contextGeneration++
  return true
}

function executeActions(actions, navigateTo) {
  if (!Array.isArray(actions) || actions.length > 1 || typeof navigateTo !== 'function') {
    throw new Error(unsupportedActionMessage)
  }
  actions.forEach(function (action) {
    if (!isPlainObject(action) || action.type !== 'rental_order.show_results' ||
        action.status !== 'completed' || !isValidQueryState(action.state)) {
      throw new Error(unsupportedActionMessage)
    }
    const url = adminAiQuery.buildRentOrderListUrl(action.state)
    // buildRentOrderListUrl percent-encodes the JSON, so URL length measures the
    // encoded transport payload rather than the source JavaScript string length.
    if (typeof url !== 'string' || url.length > maxRentOrderListUrlLength ||
        !/^\/pages\/admin\/rent\/new_rent_list\?aiIntent=/.test(url)) {
      throw new Error(unsupportedActionMessage)
    }
    navigateTo(url)
  })
}

module.exports = {
  buildRequest,
  acceptContext,
  currentContext,
  clearContext,
  captureRequestOwner,
  clearContextForOwner,
  executeActions,
  isValidQueryState,
  isValidResponse
}

const adminAiQuery = require('./adminAiQuery.js')
const adminAiDomains = require('./adminAiDomains.js')

const unsupportedActionMessage = '当前版本暂不支持此操作，请升级后重试'
const maxListUrlLength = 1800
const maxConversationMessages = 20
const maxConversationMessageLength = 2000
const maxConversationLength = 12000

let ownerStaffId = null
let ownerSessionKey = null
let contextGeneration = 0
let context = emptyContext()

function emptyContext() {
  // 每个业务域各一个键，外加「当前进行中的是哪个域」的指针：
  // 增量修改（「改成五月」）必须落在同一个域上，不能靠猜。
  const empty = { active_query_type: null }
  adminAiDomains.CONTEXT_KEYS.forEach(function (key) { empty[key] = null })
  return empty
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

/** 按业务域校验：本域没有的字段一律不接受，别域的条件混不进来。 */
function isValidQueryState(domain, state) {
  if (domain == null || !isPlainObject(state)) return false
  const fields = domain.fields
  if (Object.keys(state).some(key => !fields.includes(key))) return false
  if (!fields.every(key => Object.hasOwn(state, key))) return false
  if (!isDateOnly(state.start_date) || !isDateOnly(state.end_date)) return false
  const startDate = new Date(state.start_date.slice(0, 10) + 'T00:00:00Z')
  const endDate = new Date(state.end_date.slice(0, 10) + 'T00:00:00Z')
  if (endDate < startDate || endDate - startDate > 365 * 24 * 60 * 60 * 1000) return false
  if (!isBoundedNullableString(state.shop, 64) || !isBoundedNullableString(state.rent_status, 64) ||
      !isBoundedNullableString(state.retail_type, 64) || !isBoundedNullableString(state.keyword, 40)) return false
  if (state.cell_suffix != null && (!/^\d{4,15}$/.test(state.cell_suffix))) return false
  return fields.every(key =>
    domain.booleanFields.indexOf(key) < 0 || state[key] == null || typeof state[key] === 'boolean'
  )
}

function isValidContext(nextContext) {
  if (!isPlainObject(nextContext)) return false
  const allowed = ['active_query_type'].concat(adminAiDomains.CONTEXT_KEYS)
  if (Object.keys(nextContext).some(key => !allowed.includes(key))) return false
  const activeType = nextContext.active_query_type
  if (activeType != null && adminAiDomains.byQueryType(activeType) == null) return false
  return adminAiDomains.CONTEXT_KEYS.every(function (key) {
    const state = nextContext[key]
    if (state == null) return true
    return isValidQueryState(adminAiDomains.byContextKey(key), state)
  })
}

function normalizeContext(nextContext) {
  if (!isValidContext(nextContext)) return null
  const normalized = Object.assign(emptyContext(), copy(nextContext))
  adminAiDomains.CONTEXT_KEYS.forEach(function (key) {
    const state = normalized[key]
    if (state == null) return
    state.start_date = state.start_date.slice(0, 10)
    state.end_date = state.end_date.slice(0, 10)
  })
  return normalized
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
    conversation: projectConversation(conversation),
    context: copy(context)
  }
}

function projectConversation(conversation) {
  const messages = Array.isArray(conversation) ? conversation : []
  const projected = []
  let totalLength = 0
  for (let index = messages.length - 1; index >= 0 && projected.length < maxConversationMessages; index--) {
    const message = messages[index]
    if (!isPlainObject(message) || (message.role !== 'user' && message.role !== 'assistant') ||
        typeof message.content !== 'string' || message.content.length > maxConversationMessageLength ||
        totalLength + message.content.length > maxConversationLength) continue
    projected.unshift({ role: message.role, content: message.content })
    totalLength += message.content.length
  }
  return projected
}

function acceptContext(staff, nextContext) {
  syncStaff(staff)
  context = normalizeContext(nextContext) || emptyContext()
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

function isCurrentRequestOwner(owner) {
  return !!owner && owner.staffId === ownerStaffId && owner.sessionKey === ownerSessionKey &&
    owner.generation === contextGeneration
}

function staleSessionError() {
  const error = new Error('登录状态已变化，请重新提问。')
  error.code = 'stale_session'
  return error
}

/**
 * 列表页 onLoad 承接 AI 条件：校验 → 映射成页面 data → 附上条件摘要。
 * 返回 null 表示这次不是 AI 跳转，页面按自己的默认值初始化。
 *
 * 四个页面共用同一段逻辑，省得每加一个域就抄一遍、抄漏一处。
 */
function applyPageIntent(actionType, options) {
  const domain = adminAiDomains.byActionType(actionType)
  if (domain == null) return null
  const intent = adminAiQuery.readOrderIntent(options)
  if (!isValidQueryState(domain, intent)) return null
  const state = adminAiQuery.buildListState(actionType, intent)
  if (state == null) return null
  state.aiQueryConditions = adminAiQuery.describeIntent(actionType, intent)
  return state
}

function executeActions(actions, navigateTo) {
  if (!Array.isArray(actions) || actions.length > 1 || typeof navigateTo !== 'function') {
    throw new Error(unsupportedActionMessage)
  }
  actions.forEach(function (action) {
    if (!isPlainObject(action) || action.status !== 'completed') {
      throw new Error(unsupportedActionMessage)
    }
    const domain = adminAiDomains.byActionType(action.type)
    if (domain == null || !isValidQueryState(domain, action.state)) {
      throw new Error(unsupportedActionMessage)
    }
    const url = adminAiQuery.buildListUrl(action.type, action.state)
    // buildListUrl percent-encodes the JSON, so URL length measures the
    // encoded transport payload rather than the source JavaScript string length.
    if (typeof url !== 'string' || url.length > maxListUrlLength ||
        url.indexOf(domain.path + '?aiIntent=') !== 0) {
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
  isCurrentRequestOwner,
  staleSessionError,
  executeActions,
  applyPageIntent,
  isValidQueryState,
  isValidResponse
}

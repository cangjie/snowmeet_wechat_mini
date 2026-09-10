const test = require('node:test')
const assert = require('node:assert/strict')

const assistant = require('../utils/adminAssistant.js')
const { resetAuthenticationState } = require('../utils/authSession.js')

test('认证重置清除管理员助手上下文和已失效的会话身份', () => {
  assistant.clearContext()
  assistant.acceptContext({ id: 7 }, {
    rental_order_query: {
      start_date: '2026-04-01', end_date: '2026-04-30', shop: null,
      rent_status: null, is_test: null, is_entertain: null, have_discount: null,
      use_card: null, has_retail: null, cell_suffix: null, keyword: null
    }
  })
  const app = { globalData: { sessionKey: 'stale-session', member: { id: 1 }, staff: { id: 7 } } }

  resetAuthenticationState(app)

  assert.equal(app.globalData.sessionKey, '')
  assert.equal(app.globalData.member, null)
  assert.equal(app.globalData.staff, null)
  assert.equal(assistant.currentContext(null).rental_order_query, null)
})

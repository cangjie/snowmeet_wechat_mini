const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage } = require('./reception_harness.js')

test('开单页只沿用当前链接中的接待记录，并记住后端返回的会员以便后续保存', async t => {
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 's' } })
  global.wx = { getStorageSync() { return { receptCheckinId: 999 } } }
  t.after(() => { delete global.wx; delete global.getApp })
  const page = loadPage('pages/admin/reception/recept_new.js', {})
  page._restoreCareCardDraft = async () => {}
  await page.onLoad({ bizType: 'maintain', shop: '万龙服务中心', receptCheckinId: '5', isTest: '1' })
  assert.equal(page._receptQuery(), '&isTest=true&receptCheckinId=5')
  page._acceptReceptMember({ member_id: 88 })
  assert.equal(page.data.customer.memberId, 88)
  page._acceptReceptMember({ member_id: 99 })
  assert.equal(page.data.customer.memberId, 88)

  const fresh = loadPage('pages/admin/reception/recept_new.js', {})
  fresh._restoreCareCardDraft = async () => {}
  await fresh.onLoad({ bizType: 'retail', shop: '万龙服务中心' })
  assert.equal(fresh._receptQuery(), '')
})

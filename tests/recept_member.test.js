// 接待·顾客信息页（pages/admin/reception/recept_member）：老顾客直接显示、新顾客授权后弹窗、散客、选店铺和业务进开单
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle, tap } = require('./reception_harness.js')

const PAGE = 'pages/admin/reception/recept_member.js'
const VERIFIED = { code: 0, data: { stage: 'verified', memberId: 42, name: '张三', gender: '男', cell: '13800138000', maskedCell: '138****8000' } }

function setup(pollResult) {
  const calls = { poll: [] }
  const nav = []
  const modals = []
  const toasts = []
  const storage = {}
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk' } })
  global.wx = {
    navigateTo(o) { nav.push(o.url) },
    setStorageSync(k, v) { storage[k] = v },
    showToast(o) { toasts.push(o.title) },
    showModal(o) { modals.push(o); if (o.success) o.success({ confirm: true }) }
  }
  const fakeData = {
    getReceptCheckinByStaffPromise(id) {
      calls.poll.push(id)
      return Promise.resolve(pollResult())
    }
  }
  const page = loadPage(PAGE, fakeData)
  return { page, calls, nav, modals, toasts, storage }
}

function cleanup(page) {
  page._stopPolling()
  delete global.getApp
  delete global.wx
}

test('老顾客扫码：直接显示会员信息，不弹窗', async () => {
  const { page, calls, modals } = setup(() => VERIFIED)
  page.onLoad({ checkinId: '5', stage: 'verified' })
  page.onShow()
  await settle()
  assert.deepEqual(calls.poll, [5])
  assert.equal(page.data.waitingPhone, false)
  assert.deepEqual(page.data.customer, { memberId: 42, name: '张三', gender: '男', cell: '13800138000' })
  assert.equal(page._pollTimer, null)
  assert.deepEqual(modals, [])
  cleanup(page)
})

test('新顾客扫码：授权前不能开单，授权后弹窗提示店员，再选店铺和业务进开单', async () => {
  let result = { code: 0, data: { stage: 'need_phone' } }
  const { page, nav, modals, toasts, storage } = setup(() => result)
  page.onLoad({ checkinId: '5', stage: 'need_phone' })
  page.onShow()
  await settle()
  assert.equal(page.data.waitingPhone, true)
  assert.notEqual(page._pollTimer, null)

  page.shopSelected({ detail: { shop: '万龙体验中心', sale: 1, rent: 1, care: 0 } })
  page.onBizTap(tap({ type: 'rent' }))
  assert.deepEqual(toasts, ['请等顾客授权手机号'])
  assert.deepEqual(nav, [])

  result = VERIFIED
  page.pollCheckin()
  await settle()
  assert.equal(page.data.waitingPhone, false)
  assert.equal(page._pollTimer, null)
  assert.equal(modals.length, 1)
  assert.equal(modals[0].title, '顾客已授权手机号')
  assert.match(modals[0].content, /138\*\*\*\*8000/)

  page.onBizTap(tap({ type: 'maintain' }))
  assert.equal(nav.length, 1)
  assert.match(nav[0], /^\/pages\/admin\/reception\/recept_new\?bizType=maintain/)
  assert.match(nav[0], /memberId=42/)
  assert.match(nav[0], /customerCell=13800138000/)
  assert.match(nav[0], /shop=%E4%B8%87%E9%BE%99%E6%9C%8D%E5%8A%A1%E4%B8%AD%E5%BF%83/)
  assert.equal(storage.reception_draft.shopName, '万龙服务中心')
  cleanup(page)
})

test('顾客不方便授权：改按散客开单，之后的授权结果不再挂会员', async () => {
  let result = { code: 0, data: { stage: 'need_phone' } }
  const { page, nav, modals } = setup(() => result)
  page.onLoad({ checkinId: '5', stage: 'need_phone' })
  page.onShow()
  await settle()
  page.onWalkInInstead()
  assert.equal(modals[0].title, '按散客开单')
  assert.equal(page.data.mode, 'walkin')
  assert.equal(page.data.waitingPhone, false)
  assert.equal(page._pollTimer, null)

  result = VERIFIED
  page.pollCheckin()
  await settle()
  assert.equal(page.data.customer.memberId, null)

  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })
  page.onBizTap(tap({ type: 'retail' }))
  assert.doesNotMatch(nav[0], /memberId=/)
  cleanup(page)
})

test('散客进入：不轮询，可填顾客信息，手机号匹配到会员时挂上', async () => {
  const { page, calls, nav } = setup(() => VERIFIED)
  page.onLoad({ walkin: '1' })
  page.onShow()
  await settle()
  assert.equal(page.data.mode, 'walkin')
  assert.deepEqual(calls.poll, [])

  page.onCustomerChange({ detail: { name: '李四', gender: '', cell: '13900139000' } })
  page.onMemberInfoFound({ detail: { memberId: 77, member: { real_name: '李四四', gender: '女' } } })
  // 已填的姓名不覆盖，空着的性别用会员档案补上
  assert.deepEqual(page.data.customer, { memberId: 77, name: '李四', gender: '女', cell: '13900139000' })
  // 已经挂了会员就不再改挂
  page.onMemberInfoFound({ detail: { memberId: 99, member: {} } })
  assert.equal(page.data.customer.memberId, 77)

  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })
  page.onBizTap(tap({ type: 'rent' }))
  assert.match(nav[0], /bizType=rent/)
  assert.match(nav[0], /customerName=%E6%9D%8E%E5%9B%9B/)
  assert.match(nav[0], /memberId=77/)
  cleanup(page)
})

test('没选店铺或门店不支持该业务时不进开单', () => {
  const { page, nav, toasts } = setup(() => VERIFIED)
  page.onLoad({ walkin: '1' })
  page.onBizTap(tap({ type: 'rent' }))
  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 0, care: 1 } })
  page.onBizTap(tap({ type: 'rent' }))
  assert.deepEqual(toasts, ['请先选择店铺', '当前店铺不支持租赁'])
  assert.deepEqual(nav, [])
  cleanup(page)
})

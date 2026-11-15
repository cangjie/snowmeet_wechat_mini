// 已经绑过手机号的老会员不会再走验证手机号入口，所以另外在「我的」页补问头像昵称（2026-11-15 用户要求）：
//   · 「我的」页（pages/mine/mine）：每次显示都问一次（组件自己记着已有资料 / 已跳过，不会重复弹，也不会每次都请求）
// 可以跳过，跳过不影响任何流程。
// 付款页不补问：2026-11-15 用户「不论什么情况，付款的环节都不要询问，让顾客授权昵称和头像」，
// 这里有测试保证付款页永远不弹（付款环节的其它入口见 profile_auth_pages.test.js）。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { loadPage, settle } = require('./reception_harness.js')

const ROOT = path.join(__dirname, '..')

function deferred() {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}

function installGlobals(t, sessionKey = 'sk') {
  const app = { loginPromiseNew: Promise.resolve({ authenticated: true }), globalData: { sessionKey, requestPrefix: 'https://t.test/api/', domainName: 't.test', member: { id: 1, wechatMiniOpenId: 'oid' } } }
  global.getApp = () => app
  global.wx = { showToast() {}, showLoading() {}, hideLoading() {}, navigateTo() {}, redirectTo() {}, getStorageSync() { return '' }, setStorageSync() {},
    getSystemInfoSync() { return { windowWidth: 375 } }, getAccountInfoSync() { return { miniProgram: { envVersion: 'release' } } }, getRealtimeLogManager() { return { info() {}, warn() {}, error() {} } } }
  t.after(() => { delete global.getApp; delete global.wx })
  return app
}

function withProfileGate(owner, log) {
  const gate = deferred()
  owner.selectComponent = selector => {
    assert.equal(selector, '#profileAuth')
    return { ensure() { log.push('ensure'); return gate.promise } }
  }
  return gate
}

// ---------- 「我的」页 ----------

test('「我的」页：显示时（已登录）请头像昵称弹层检查一次；不拦页面自己的刷新', async t => {
  installGlobals(t)
  const calls = []
  const page = loadPage('pages/mine/mine.js', {
    getMyCoachPromise: async () => { calls.push('coach'); return { isCoach: false } },
    getMyDistributorPromise: async () => { calls.push('distributor'); return { isDistributor: false } },
    getMyCoachCardsPromise: async () => { calls.push('cards'); return { cards: [] } },
  })
  const log = []
  const gate = withProfileGate(page, log)
  page.onShow()
  await settle()
  assert.deepEqual(log, ['ensure'])
  assert.deepEqual(calls.sort(), ['cards', 'coach', 'distributor'], '弹层开着也不能拦住页面自己的数据刷新')
  gate.resolve()
  await settle()
  page.onShow()
  await settle()
  assert.deepEqual(log, ['ensure', 'ensure'], '每次显示都交给组件判断（组件记着已处理，不会重复弹）')
})

test('「我的」页：还没有登录会话时不问；组件取不到也不报错', async t => {
  installGlobals(t, '')
  const page = loadPage('pages/mine/mine.js', { getMyCoachPromise: async () => ({}), getMyDistributorPromise: async () => ({}), getMyCoachCardsPromise: async () => ({}) })
  const log = []
  withProfileGate(page, log)
  page.onShow()
  await settle()
  assert.deepEqual(log, [])

  installGlobals(t, 'sk')
  const page2 = loadPage('pages/mine/mine.js', { getMyCoachPromise: async () => ({}), getMyDistributorPromise: async () => ({}), getMyCoachCardsPromise: async () => ({}) })
  page2.selectComponent = () => null
  assert.doesNotThrow(() => page2.onShow())
  await settle()
})

// ---------- 顾客付款页：永远不问 ----------

function paymentPage(t, identity, options = {}) {
  installGlobals(t)
  const page = loadPage('pages/order/payment_entry.js', {
    checkPayerIdentityPromise: async () => identity,
    getOrderFromPaymentByCustomer: async () => ({}),
  })
  page.setData({ paymentId: 5, scannerId: 'oid' })
  page._autoPay = options.autoPay !== false
  const log = []
  page.pay = () => { log.push('pay') }
  page._isRentOrder = () => !!options.rent
  // 万一有人把弹层加回来：selectComponent 一被调就记下来，并且永远不放行
  page.selectComponent = () => ({ ensure() { log.push('ensure'); return new Promise(() => {}) } })
  return { page, log }
}

test('顾客付款页：付款人不论是不是已绑手机号、什么身份状态，都不弹头像昵称；自动支付照常、立即发起', async t => {
  for (const identity of [
    { status: 'direct', scannerHasCell: true }, { status: 'direct', scannerHasCell: false },
    { status: 'choose_identity', scannerHasCell: true }, { status: 'phone_required', scannerHasCell: false },
    { status: 'direct_to_scanner', scannerHasCell: false }, { status: 'error', errorCode: 'x' },
  ]) {
    const { page, log } = paymentPage(t, identity)
    page._refreshIdentity()
    await settle()
    assert.ok(!log.includes('ensure'), JSON.stringify(identity))
    if (identity.status === 'direct') assert.deepEqual(log, ['pay'], '自动支付不能被拦')
  }
  const rent = paymentPage(t, { status: 'direct', scannerHasCell: true }, { rent: true })
  rent.page._refreshIdentity()
  await settle()
  assert.deepEqual(rent.log, [], '租赁单照旧不自动支付，也不弹')
})

test('「我的」页的 wxml 放了 <profile-auth id="profileAuth" />，付款页没有', () => {
  const mine = fs.readFileSync(path.join(ROOT, 'pages/mine/mine.wxml'), 'utf8')
  assert.match(mine, /<profile-auth\s+id="profileAuth"\s*(\/>|><\/profile-auth>)/)
  const pay = fs.readFileSync(path.join(ROOT, 'pages/order/payment_entry.wxml'), 'utf8')
  assert.doesNotMatch(pay, /<profile-auth/)
})

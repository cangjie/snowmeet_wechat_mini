// 已经绑过手机号的老会员不会再走验证手机号入口，所以另外在两个地方补问头像昵称（2026-11-15 用户要求）：
//   · 「我的」页（pages/mine/mine）：每次显示都问一次（组件自己记着已有资料 / 已跳过，不会重复弹，也不会每次都请求）
//   · 顾客付款页（pages/order/payment_entry）：扫付款码进来、身份查询回来、自动支付之前问；
//     只在付款人已经绑了手机号时才问（没绑的在 pay-identity-confirm 里授权手机号之后问，不能在授权前先弹）
// 都可以跳过，跳过不影响任何流程。
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

// ---------- 顾客付款页 ----------

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
  return { page, log }
}

test('顾客付款页：付款人已绑手机号、要自动支付时，先弹头像昵称、处理完才自动调起支付', async t => {
  const { page, log } = paymentPage(t, { status: 'direct', scannerHasCell: true })
  const gate = withProfileGate(page, log)
  page._refreshIdentity()
  await settle()
  assert.deepEqual(log, ['ensure'], '支付要等弹层处理完，不能叠在一起')
  gate.resolve()
  await settle()
  assert.deepEqual(log, ['ensure', 'pay'])
})

test('顾客付款页：不自动支付的情形（租赁单、不是 direct、没有 autoPay）也照样补问，但不会触发支付', async t => {
  for (const options of [{ rent: true }, { autoPay: false }]) {
    const { page, log } = paymentPage(t, { status: 'direct', scannerHasCell: true }, options)
    const gate = withProfileGate(page, log)
    page._refreshIdentity()
    await settle()
    gate.resolve()
    await settle()
    assert.deepEqual(log, ['ensure'], JSON.stringify(options))
  }
  const { page, log } = paymentPage(t, { status: 'choose_identity', scannerHasCell: true })
  const gate = withProfileGate(page, log)
  page._refreshIdentity()
  await settle()
  gate.resolve()
  await settle()
  assert.deepEqual(log, ['ensure'])
})

test('顾客付款页：付款人还没绑手机号 / 身份查询出错时不在这里弹（没绑的由 pay-identity-confirm 在授权手机号之后问）', async t => {
  for (const identity of [{ status: 'phone_required', scannerHasCell: false }, { status: 'direct_to_scanner', scannerHasCell: false },
    { status: 'error', errorCode: 'x' }]) {
    const { page, log } = paymentPage(t, identity)
    withProfileGate(page, log)
    page._refreshIdentity()
    await settle()
    assert.ok(!log.includes('ensure'), JSON.stringify(identity))
  }
})

test('顾客付款页：取不到弹层组件时不拦自动支付', async t => {
  const { page, log } = paymentPage(t, { status: 'direct', scannerHasCell: true })
  page.selectComponent = () => null
  page._refreshIdentity()
  await settle()
  assert.deepEqual(log, ['pay'])
})

test('两个页面的 wxml 都放了 <profile-auth id="profileAuth" />', () => {
  for (const rel of ['pages/mine/mine.wxml', 'pages/order/payment_entry.wxml']) {
    const wxml = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    assert.match(wxml, /<profile-auth\s+id="profileAuth"\s*(\/>|><\/profile-auth>)/, rel)
  }
})

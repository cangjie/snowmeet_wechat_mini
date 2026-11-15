// 已经绑过手机号的老会员不会再走验证手机号入口，所以另外在「我的」页补问头像昵称（2026-11-15 用户要求）：
//   · 「我的」页（pages/mine/mine）：顶部显示保存过的头像和昵称（2026-11-15 用户要求）；还没有资料的会员弹一次，处理完立刻刷新顶部。
//     页面自己请求一次 GetMyProfile 决定：已有资料 → 显示、不弹；没有资料且本次运行没跳过过 → 弹层；跳过过 → 不弹。
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

// ---------- 「我的」页：显示头像昵称，没有资料的老会员补问一次 ----------

function minePage(t, responses, options = {}) {
  const app = installGlobals(t, options.sessionKey === undefined ? 'sk' : options.sessionKey)
  const calls = { profile: 0 }
  const page = loadPage('pages/mine/mine.js', {
    getMyCoachPromise: async () => ({ isCoach: false }),
    getMyCoachCardsPromise: async () => ({ cards: [] }),
    getMyDistributorPromise: async () => null,
    getMyProfilePromise: async () => { const r = responses[Math.min(calls.profile, responses.length - 1)]; calls.profile++; return r },
  })
  const log = []
  return { page, app, calls, log }
}

const SAVED = { code: 0, data: { needProfile: false, nickName: '雪友小明', avatarUrl: 'https://img.snowmeet.top/upload/20261115/avatar_x.jpg', updateDate: '2026-11-15T08:00:00' } }
const NO_PROFILE = { code: 0, data: { needProfile: true, nickName: null, avatarUrl: null, updateDate: null } }
const NO_MEMBER = { code: 0, data: { needProfile: false, nickName: null, avatarUrl: null, updateDate: null } }

test('「我的」页：已经授权过头像昵称的会员，顶部显示他的头像和昵称，不再弹层', async t => {
  const { page, log, calls } = minePage(t, [SAVED])
  withProfileGate(page, log)
  page.onShow()
  await settle()
  assert.equal(page.data.profileNick, '雪友小明')
  assert.equal(page.data.profileAvatar, 'https://img.snowmeet.top/upload/20261115/avatar_x.jpg')
  assert.deepEqual(log, [], '已有资料不弹层')
  page.onShow()
  await settle()
  assert.equal(calls.profile, 2, '每次显示刷新一次，但只请求一次后端（不再让弹层组件重复请求）')
  assert.deepEqual(log, [])
})

test('「我的」页：还没有头像昵称的会员，弹层处理完（保存）后，顶部立刻换成刚保存的头像昵称', async t => {
  const { page, log } = minePage(t, [NO_PROFILE, SAVED])
  const gate = withProfileGate(page, log)
  page.onShow()
  await settle()
  assert.deepEqual(log, ['ensure'])
  assert.equal(page.data.profileNick || '', '', '弹层还开着，先不显示')
  gate.resolve()
  await settle()
  assert.equal(page.data.profileNick, '雪友小明')
  assert.equal(page.data.profileAvatar, 'https://img.snowmeet.top/upload/20261115/avatar_x.jpg')
})

test('「我的」页：弹层里点了跳过，顶部还是默认的；本次运行里再显示不会再弹，也不会多请求', async t => {
  const { page, app, log, calls } = minePage(t, [NO_PROFILE, NO_PROFILE])
  const gate = withProfileGate(page, log)
  page.onShow()
  await settle()
  require('../utils/profile_auth.js').markDone(app.globalData, 'sk')    // 组件点「跳过」时做的事
  gate.resolve()
  await settle()
  assert.equal(page.data.profileNick || '', '')
  const before = calls.profile
  page.onShow()
  await settle()
  assert.deepEqual(log, ['ensure'], '跳过过就不再弹')
  assert.equal(calls.profile, before + 1, '只刷新一次')
})

test('「我的」页：没有会员 / 请求失败 / 旧后端没有这个接口时，顶部保持默认，不弹层', async t => {
  for (const response of [NO_MEMBER, null, { code: 1, message: 'x' }]) {
    const { page, log } = minePage(t, [response])
    withProfileGate(page, log)
    page.onShow()
    await settle()
    assert.equal(page.data.profileNick || '', '')
    assert.equal(page.data.profileAvatar || '', '')
    assert.deepEqual(log, [])
  }
})

test('「我的」页：还没有登录会话时什么都不请求；组件取不到也不报错', async t => {
  const { page, calls, log } = minePage(t, [SAVED], { sessionKey: '' })
  withProfileGate(page, log)
  page.onShow()
  await settle()
  assert.equal(calls.profile, 0)
  assert.deepEqual(log, [])

  const missing = minePage(t, [NO_PROFILE])
  missing.page.selectComponent = () => null
  assert.doesNotThrow(() => missing.page.onShow())
  await settle()
})

test('头部组件 myinfo：授权过就显示自己的头像（圆形）和昵称，没授权就还是微信自带的；「我的」页把存好的头像昵称传给它', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'components/myinfo/myinfo.wxml'), 'utf8')
  assert.match(wxml, /wx:if="\{\{avatarUrl \|\| nickName\}\}"/)
  assert.match(wxml, /<image[^>]*wx:if="\{\{avatarUrl\}\}"[^>]*src="\{\{avatarUrl\}\}"/)
  assert.match(wxml, /<text[^>]*>\{\{nickName\}\}<\/text>/)
  assert.match(wxml, /wx:else>[\s\S]*type="userAvatarUrl"[\s\S]*type="userNickName"/, '没授权过：保留原来的显示')
  const js = fs.readFileSync(path.join(ROOT, 'components/myinfo/myinfo.js'), 'utf8')
  assert.match(js, /avatarUrl:\s*\{\s*type:\s*String/)
  assert.match(js, /nickName:\s*\{\s*type:\s*String/)
  const wxss = fs.readFileSync(path.join(ROOT, 'components/myinfo/myinfo.wxss'), 'utf8')
  assert.match(wxss, /\.userinfo-avatar-img\s*\{[^}]*border-radius:\s*50%/)
  const mine = fs.readFileSync(path.join(ROOT, 'pages/mine/mine.wxml'), 'utf8')
  assert.match(mine, /<my-info[^>]*avatarUrl="\{\{profileAvatar\}\}"[^>]*nickName="\{\{profileNick\}\}"/)
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

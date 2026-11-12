// 顾客扫码取板验证页（pages/order/care_pick_verify）：本人通过 / 非本人提示 / 新微信号先授权手机号
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle } = require('./reception_harness.js')

const PAGE = 'pages/order/care_pick_verify.js'
const CODE = 'cp_abcdefghij_25693_801'
const Q = encodeURIComponent('https://mini.snowmeet.top/mapp/care_pick?code=' + CODE)

function setup(verify, bind, options = {}) {
  const calls = { verify: [], verifyKeys: [], bind: [], retry: 0 }
  const toasts = []
  const app = {
    loginPromiseNew: Promise.resolve(options.loginResult || { authenticated: true }),
    globalData: { sessionKey: options.sessionKey === undefined ? 'sk' : options.sessionKey },
    retryLogin() {
      calls.retry++
      this.loginPromiseNew = Promise.resolve().then(() => options.retryLogin(this))
      return this.loginPromiseNew
    }
  }
  global.getApp = () => app
  global.wx = { showToast(o) { toasts.push(o.title) }, showLoading() {}, hideLoading() {} }
  const fakeData = {
    verifyCarePickPromise(code, key) { calls.verify.push(code); calls.verifyKeys.push(key); return verify() },
    bindWechatCellPromise(encData, iv) { calls.bind.push([encData, iv]); return bind ? bind() : Promise.resolve({ id: 7 }) }
  }
  const page = loadPage(PAGE, fakeData)
  return { page, calls, toasts, app }
}

function cleanup() {
  delete global.getApp
  delete global.wx
}

test('扫码人是下单会员：显示取板验证成功', async () => {
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }))
  page.onLoad({ q: Q })
  await settle()
  assert.deepEqual(calls.verify, [CODE])
  assert.equal(page.data.state, 'matched')
  cleanup()
})

test('不是下单人：提示用下单人的微信扫码，并带上打码手机号', async () => {
  const { page } = setup(() => Promise.resolve({ stage: 'mismatch', orderMemberMaskedCell: '138****8000' }))
  page.onLoad({ q: Q })
  await settle()
  assert.equal(page.data.state, 'mismatch')
  assert.equal(page.data.maskedCell, '138****8000')
  cleanup()
})

test('新微信号没有会员身份：授权手机号绑定后再验证', async () => {
  let stage = 'need_member'
  const { page, calls, toasts } = setup(() => Promise.resolve({ stage }))
  page.onLoad({ q: Q })
  await settle()
  assert.equal(page.data.state, 'bind_cell')

  page.onBindCell({ detail: { errMsg: 'getPhoneNumber:fail user deny' } })
  assert.deepEqual(toasts, ['未授权手机号'])
  assert.deepEqual(calls.bind, [])

  stage = 'matched'
  page.onBindCell({ detail: { errMsg: 'getPhoneNumber:ok', encryptedData: 'enc', iv: 'iv' } })
  await settle()
  assert.deepEqual(calls.bind, [['enc', 'iv']])
  assert.deepEqual(calls.verify, [CODE, CODE])
  assert.equal(page.data.state, 'matched')
  cleanup()
})

test('码失效或被别人扫过：显示原因，可重试', async () => {
  const { page, calls } = setup(() => Promise.reject('二维码已过期，请让店员换一个码'))
  page.onLoad({ q: Q })
  await settle()
  assert.equal(page.data.state, 'error')
  assert.equal(page.data.message, '二维码已过期，请让店员换一个码')
  page.onRetryTap()
  await settle()
  assert.equal(calls.verify.length, 2)
  assert.equal(calls.retry, 0)
  cleanup()
})

test('登录失败不发送空会话验证，显示重新登录和退出重扫指引', async t => {
  t.after(cleanup)
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false }
  })
  page.onLoad({ q: Q })
  await settle()
  assert.deepEqual(calls.verify, [])
  assert.equal(page.data.state, 'error')
  assert.equal(page.data.login_error, true)
  assert.match(page.data.message, /重新登录/)
  assert.match(page.data.message, /退出小程序后重新扫描/)
})

test('认证失败即使残留旧会话也不能验证', async t => {
  t.after(cleanup)
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: 'stale', loginResult: { authenticated: false }
  })
  page.onLoad({ code: CODE })
  await settle()
  assert.deepEqual(calls.verify, [])
  assert.equal(page.data.login_error, true)
})

test('认证结果成功但没有有效会话时仍禁止验证', async t => {
  t.after(cleanup)
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }), null, { sessionKey: '  ' })
  page.onLoad({ code: CODE })
  await settle()
  assert.deepEqual(calls.verify, [])
  assert.equal(page.data.login_error, true)
})

test('登录失败后重试重新登录，只用新会话验证一次', async t => {
  t.after(cleanup)
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false },
    retryLogin(app) { app.globalData.sessionKey = 'new-session'; return { authenticated: true } }
  })
  page.onLoad({ code: CODE })
  await settle()
  page.onRetryTap()
  await settle()
  assert.equal(calls.retry, 1)
  assert.deepEqual(calls.verifyKeys, ['new-session'])
  assert.equal(page.data.state, 'matched')
  assert.equal(page.data.login_error, false)
})

test('重新登录仍失败时保留登录指引，不验证且允许再次重试', async t => {
  t.after(cleanup)
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false },
    retryLogin() { return { authenticated: false } }
  })
  page.onLoad({ code: CODE })
  await settle()
  page.onRetryTap()
  await settle()
  assert.equal(calls.retry, 1)
  assert.deepEqual(calls.verify, [])
  assert.equal(page.data.login_error, true)
  assert.equal(page.data.busy, false)
})

test('重新登录发生异常时仍显示登录指引', async t => {
  t.after(cleanup)
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false },
    retryLogin() { return Promise.reject(new Error('offline')) }
  })
  page.onLoad({ code: CODE })
  await settle()
  page.onRetryTap()
  await settle()
  assert.equal(calls.retry, 1)
  assert.deepEqual(calls.verify, [])
  assert.equal(page.data.login_error, true)
  assert.equal(page.data.busy, false)
})

test('连续点击重新登录只发起一次登录和验证', async t => {
  t.after(cleanup)
  let finishLogin
  const { page, calls, app } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false },
    retryLogin() { return new Promise(resolve => { finishLogin = resolve }) }
  })
  page.onLoad({ code: CODE })
  await settle()
  page.onRetryTap()
  page.onRetryTap()
  await settle()
  assert.equal(calls.retry, 1)
  app.globalData.sessionKey = 'new-session'
  finishLogin({ authenticated: true })
  await settle()
  assert.deepEqual(calls.verifyKeys, ['new-session'])
  assert.equal(page.data.state, 'matched')
})

test('手机号授权时会话丢失，不调用绑定或验证接口', async t => {
  t.after(cleanup)
  const { page, calls, app } = setup(() => Promise.resolve({ stage: 'need_member' }))
  page.onLoad({ code: CODE })
  await settle()
  app.globalData.sessionKey = ''
  page.onBindCell({ detail: { errMsg: 'getPhoneNumber:ok', encryptedData: 'enc', iv: 'iv' } })
  await settle()
  assert.deepEqual(calls.bind, [])
  assert.deepEqual(calls.verify, [CODE])
  assert.equal(page.data.login_error, true)
})

test('没有带码打开：直接提示重新扫码', () => {
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }))
  page.onLoad({})
  assert.equal(page.data.state, 'error')
  assert.deepEqual(calls.verify, [])
  cleanup()
})

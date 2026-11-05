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
    loginPromiseNew: options.loginRejects
      ? Promise.reject(new Error(options.loginRejects))
      : Promise.resolve(options.loginResult || { authenticated: true }),
    globalData: { sessionKey: options.sessionKey === undefined ? 'sk' : options.sessionKey },
    // 第 n 次调用 retryLogin（含页面自动重试的那次）时，n 传给 options.retryLogin(app, n)
    retryLogin() {
      calls.retry++
      const n = calls.retry
      this.loginPromiseNew = Promise.resolve().then(() => options.retryLogin(this, n))
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
  // 自动重试前的倒计时在测试里默认去掉；要测倒计时时用 options.autoRetrySeconds / autoRetryTickMs
  page.autoRetrySeconds = options.autoRetrySeconds === undefined ? 0 : options.autoRetrySeconds
  page.autoRetryTickMs = options.autoRetryTickMs === undefined ? 1000 : options.autoRetryTickMs
  // 记录页面「等待提示」变过哪些值（不含空串），测倒计时用
  const hints = []
  const rawSetData = page.setData
  page.setData = function (patch) {
    if (patch && 'wait_hint' in patch && patch.wait_hint) hints.push(patch.wait_hint)
    return rawSetData.call(this, patch)
  }
  return { page, calls, toasts, app, hints }
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

test('自动重试也失败后，手动重新登录成功，只用新会话验证一次', async t => {
  t.after(cleanup)
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false },
    retryLogin(app, n) {
      if (n === 1) return { authenticated: false }    // 页面自动重试的那次仍失败
      app.globalData.sessionKey = 'new-session'
      return { authenticated: true }
    }
  })
  page.onLoad({ code: CODE })
  await settle()
  assert.equal(page.data.login_error, true)
  page.onRetryTap()
  await settle()
  assert.equal(calls.retry, 2)
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
  assert.equal(calls.retry, 2)   // 自动重试 1 次 + 手动点 1 次；手动那次不再自动重试
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
  assert.equal(calls.retry, 2)
  assert.deepEqual(calls.verify, [])
  assert.equal(page.data.login_error, true)
  assert.equal(page.data.busy, false)
})

test('连续点击重新登录只发起一次登录和验证', async t => {
  t.after(cleanup)
  let finishLogin
  const { page, calls, app } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false },
    retryLogin(app, n) {
      if (n === 1) return { authenticated: false }    // 页面自动重试的那次仍失败
      return new Promise(resolve => { finishLogin = resolve })
    }
  })
  page.onLoad({ code: CODE })
  await settle()
  page.onRetryTap()
  page.onRetryTap()
  await settle()
  assert.equal(calls.retry, 2)
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

// ---- 登录失败原因：页面用小字显示，方便店员拍照 ----
test('登录失败：页面显示登录结果带回的失败原因', async t => {
  t.after(cleanup)
  const { page } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false, reason: 'wx_login: login:fail network' },
    retryLogin() { return { authenticated: false, reason: 'wx_login: login:fail network' } }   // 自动重试仍是同样的失败
  })
  page.onLoad({ code: CODE })
  await settle()
  assert.equal(page.data.login_error, true)
  assert.equal(page.data.login_reason, 'wx_login: login:fail network')
})

test('重新登录仍失败：原因更新为最新一次的', async t => {
  t.after(cleanup)
  const { page } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false, reason: 'wx_login: login:fail network' },
    retryLogin(app, n) {
      return { authenticated: false, reason: n === 1 ? 'member_login: request:fail timeout' : 'member_login: HTTP 502' }
    }
  })
  page.onLoad({ code: CODE })
  await settle()
  assert.equal(page.data.login_reason, 'member_login: request:fail timeout')   // 自动重试那次的原因
  page.onRetryTap()
  await settle()
  assert.equal(page.data.login_reason, 'member_login: HTTP 502')
})

test('重新登录抛异常：原因记为 login_exception 加异常信息', async t => {
  t.after(cleanup)
  const { page } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false },
    retryLogin() { return Promise.reject(new Error('offline')) }
  })
  page.onLoad({ code: CODE })
  await settle()
  page.onRetryTap()
  await settle()
  assert.equal(page.data.login_reason, 'login_exception: offline')
})

test('登录结果没带原因：用 no_result 兜底，页面不出现 undefined', async t => {
  t.after(cleanup)
  const { page } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false },
    retryLogin() { return { authenticated: false } }
  })
  page.onLoad({ code: CODE })
  await settle()
  assert.equal(page.data.login_reason, 'no_result')
})

test('认证成功但会话为空：原因记为 empty_session', async t => {
  t.after(cleanup)
  const { page } = setup(() => Promise.resolve({ stage: 'matched' }), null, { sessionKey: '  ' })
  page.onLoad({ code: CODE })
  await settle()
  assert.equal(page.data.login_reason, 'empty_session')
})

test('手机号授权时会话丢失：原因记为 empty_session', async t => {
  t.after(cleanup)
  const { page, app } = setup(() => Promise.resolve({ stage: 'need_member' }))
  page.onLoad({ code: CODE })
  await settle()
  app.globalData.sessionKey = ''
  page.onBindCell({ detail: { errMsg: 'getPhoneNumber:ok', encryptedData: 'enc', iv: 'iv' } })
  await settle()
  assert.equal(page.data.login_reason, 'empty_session')
})

test('重新登录成功后清掉失败原因', async t => {
  t.after(cleanup)
  const { page } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false, reason: 'wx_login: login:fail network' },
    retryLogin(app, n) {
      if (n === 1) return { authenticated: false, reason: 'wx_login: login:fail network' }
      app.globalData.sessionKey = 'new-session'
      return { authenticated: true }
    }
  })
  page.onLoad({ code: CODE })
  await settle()
  page.onRetryTap()
  await settle()
  assert.equal(page.data.state, 'matched')
  assert.equal(page.data.login_reason, '')
})

test('普通验证失败（码过期等）不显示登录原因', async t => {
  t.after(cleanup)
  const { page } = setup(() => Promise.reject('二维码已过期，请让店员换一个码'))
  page.onLoad({ code: CODE })
  await settle()
  assert.equal(page.data.state, 'error')
  assert.equal(page.data.login_reason, '')
})

test('页面里的失败原因小字只在登录失败且有原因时显示', () => {
  const wxml = require('node:fs').readFileSync(require('node:path').join(__dirname, '../pages/order/care_pick_verify.wxml'), 'utf8')
  assert.match(wxml, /wx:if="\{\{login_error && login_reason\}\}"[^>]*>[^<]*\{\{login_reason\}\}/)
})

// ---- 登录失败先自动重试 1 次：网络瞬断时顾客不用自己点「重新登录」 ----
test('首次登录失败、自动重试成功：直接验证通过，顾客看不到登录错误', async t => {
  t.after(cleanup)
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false, reason: 'member_login: request:fail timeout' },
    retryLogin(app) { app.globalData.sessionKey = 'new-session'; return { authenticated: true } }
  })
  page.onLoad({ code: CODE })
  await settle()
  assert.equal(calls.retry, 1)
  assert.deepEqual(calls.verifyKeys, ['new-session'])
  assert.equal(page.data.state, 'matched')
  assert.equal(page.data.login_error, false)
  assert.equal(page.data.login_reason, '')
})

test('首次登录抛异常也会自动重试 1 次', async t => {
  t.after(cleanup)
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginRejects: 'boom',
    retryLogin(app) { app.globalData.sessionKey = 'new-session'; return { authenticated: true } }
  })
  page.onLoad({ code: CODE })
  await settle()
  assert.equal(calls.retry, 1)
  assert.equal(page.data.state, 'matched')
})

test('自动重试也失败：显示登录指引和重试那次的原因，只自动重试 1 次', async t => {
  t.after(cleanup)
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false, reason: 'wx_login: login:fail network' },
    retryLogin() { return { authenticated: false, reason: 'member_login: request:fail timeout' } }
  })
  page.onLoad({ code: CODE })
  await settle()
  assert.equal(calls.retry, 1)
  assert.deepEqual(calls.verify, [])
  assert.equal(page.data.state, 'error')
  assert.equal(page.data.login_error, true)
  assert.equal(page.data.login_reason, 'member_login: request:fail timeout')
  assert.equal(page.data.busy, false)
})

test('首次登录成功：不会自动重试', async t => {
  t.after(cleanup)
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }))
  page.onLoad({ code: CODE })
  await settle()
  assert.equal(calls.retry, 0)
  assert.equal(page.data.state, 'matched')
})

test('登录成功但会话为空：不自动重试，仍提示重新登录', async t => {
  t.after(cleanup)
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }), null, { sessionKey: '  ' })
  page.onLoad({ code: CODE })
  await settle()
  assert.equal(calls.retry, 0)
  assert.equal(page.data.login_reason, 'empty_session')
})

test('自动重试期间页面保持「正在验证」，不闪出错误页', async t => {
  t.after(cleanup)
  let finishRetry
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false },
    retryLogin() { return new Promise(resolve => { finishRetry = resolve }) }
  })
  page.onLoad({ code: CODE })
  await settle()
  assert.equal(calls.retry, 1)
  assert.equal(page.data.state, 'loading')
  assert.equal(page.data.login_error, false)
  assert.equal(page.data.busy, true)
  finishRetry({ authenticated: false, reason: 'member_login: HTTP 502' })
  await settle()
  assert.equal(page.data.state, 'error')
  assert.equal(page.data.login_reason, 'member_login: HTTP 502')
})

const HINT = n => '网络不太稳定，' + n + ' 秒后自动重新登录，请稍候…'
const RETRYING = '正在重新登录…'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

test('自动重试前先倒计时等待，等完才重新登录', async t => {
  t.after(cleanup)
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false }, autoRetrySeconds: 3, autoRetryTickMs: 30,
    retryLogin(app) { app.globalData.sessionKey = 'new-session'; return { authenticated: true } }
  })
  page.onLoad({ code: CODE })
  await settle()                       // 约 10ms：倒计时才刚开始，不能已经重试
  assert.equal(calls.retry, 0)
  assert.equal(page.data.state, 'loading')
  await sleep(150)                     // 3 × 30ms = 90ms 已过
  assert.equal(calls.retry, 1)
  assert.equal(page.data.state, 'matched')
})

test('等待期间界面显示倒计时提示，重试时显示正在重新登录，结束后清掉', async t => {
  t.after(cleanup)
  const { page, hints } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false }, autoRetrySeconds: 3, autoRetryTickMs: 20,
    retryLogin(app) { app.globalData.sessionKey = 'new-session'; return { authenticated: true } }
  })
  page.onLoad({ code: CODE })
  await sleep(150)
  assert.deepEqual(hints, [HINT(3), HINT(2), HINT(1), RETRYING])
  assert.equal(page.data.wait_hint, '')
})

test('等待期间提示里的倒计时随时间递减', async t => {
  t.after(cleanup)
  const { page } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false }, autoRetrySeconds: 3, autoRetryTickMs: 60,
    retryLogin() { return { authenticated: false } }
  })
  page.onLoad({ code: CODE })
  await settle()
  assert.equal(page.data.wait_hint, HINT(3))
  await sleep(80)
  assert.equal(page.data.wait_hint, HINT(2))
})

test('自动重试也失败后：错误页不再带等待提示', async t => {
  t.after(cleanup)
  const { page } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false }, autoRetrySeconds: 1, autoRetryTickMs: 10,
    retryLogin() { return { authenticated: false, reason: 'member_login: request:fail timeout' } }
  })
  page.onLoad({ code: CODE })
  await sleep(80)
  assert.equal(page.data.state, 'error')
  assert.equal(page.data.wait_hint, '')
})

test('手动点重新登录不倒计时，也不显示等待提示', async t => {
  t.after(cleanup)
  const { page, hints } = setup(() => Promise.resolve({ stage: 'matched' }), null, {
    sessionKey: '', loginResult: { authenticated: false }, autoRetrySeconds: 1, autoRetryTickMs: 10,
    retryLogin() { return { authenticated: false } }
  })
  page.onLoad({ code: CODE })
  await sleep(80)
  hints.length = 0
  page.onRetryTap()
  await sleep(40)
  assert.deepEqual(hints, [])
})

test('页面默认：失败后等 10 秒（每秒一跳）再自动重试', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../pages/order/care_pick_verify.js'), 'utf8')
  assert.match(src, /autoRetrySeconds:\s*10\b/)
  assert.match(src, /autoRetryTickMs:\s*1000\b/)
})

test('界面上的「正在验证」块显示等待提示，没有提示时显示请稍候', () => {
  const wxml = require('node:fs').readFileSync(require('node:path').join(__dirname, '../pages/order/care_pick_verify.wxml'), 'utf8')
  assert.match(wxml, /\{\{wait_hint \|\| '请稍候'\}\}/)
})

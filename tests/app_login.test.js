const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const authSession = require('../utils/authSession.js')
const tabbar = require('../utils/tabbar.js')

// 运行真实 App 定义，仅替换微信与网络边界，不发起真实登录请求。
function loadApp(attempts, options = {}) {
  const app = {}
  const calls = { login: 0, requests: [], redirects: [], realtimeErrors: [] }
  let current
  const wx = {
    login(options) {
      current = attempts[calls.login++]
      const attempt = current
      queueMicrotask(() => {
        if (attempt.wxError) options.fail({ errMsg: attempt.wxError })
        else options.success({ code: 'code-' + calls.login })
      })
    },
    getAccountInfoSync() { return { miniProgram: { envVersion: 'trial' } } },
    getDeviceInfo() {
      if (current.deviceThrows) throw new Error(current.deviceThrows)
      return {}
    },
    getWindowInfo() { return { windowWidth: 375 } },
    getAppBaseInfo() { return {} },
    getSystemInfoAsync(options) {
      options.success({ windowWidth: 375 })
      options.complete({})
    },
    getNetworkType(o) { queueMicrotask(() => o.success({ networkType: options.networkType || 'wifi' })) },
    redirectTo(options) { calls.redirects.push(options.url) }
  }
  if (options.realtime) {
    wx.getRealtimeLogManager = () => ({ error(...args) { calls.realtimeErrors.push(args) } })
  }
  const util = {
    performWebRequest(url) {
      calls.requests.push(url)
      if (current.error) return Promise.reject(current.error)
      return Promise.resolve(current.session)
    }
  }
  const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8')
    .replace(/^import fuiConfig[^\n]*\n/, 'const fuiConfig = {}\n')
  vm.runInNewContext(source, {
    App(definition) {
      Object.assign(app, definition)
      Object.assign(app.globalData, { sessionKey: 'stale', member: { id: 99 }, staff: { id: 98 }, scene: '1000' })
    },
    getApp: () => app,
    wx,
    require(name) {
      if (name === './utils/authSession.js') return authSession
      if (name === './utils/tabbar.js') return tabbar
      return util
    },
    console: { log() {}, warn() {} }
  }, { filename: 'app.js' })
  return { app, calls }
}

const session = { session_key: 'fresh+key/', member: { id: 7 }, staff: { id: 8 } }

test('启动登录成功，返回认证结果并保存编码后的新会话及身份', async () => {
  const { app, calls } = loadApp([{ session }])
  const result = await app.loginPromiseNew
  assert.equal(result.authenticated, true)
  assert.equal(app.globalData.sessionKey, encodeURIComponent(session.session_key))
  assert.equal(app.globalData.member, session.member)
  assert.equal(app.globalData.staff, session.staff)
  assert.equal(calls.login, 1)
  assert.match(calls.requests[0], /MiniAppHelper\/MemberLogin\?code=code-1/)
  // 登录本身不再跳转，入口分流统一由 routeEntry 负责（见 entry_navigation.test.js）
  assert.deepEqual(calls.redirects, [])
})

test('MemberLogin 失败会结束等待并清除旧会话和身份', async () => {
  const { app } = loadApp([{ error: '获取会员信息失败' }])
  const result = await app.loginPromiseNew
  assert.equal(result.authenticated, false)
  assert.equal(typeof result.message, 'string')
  assert.equal(app.globalData.sessionKey, '')
  assert.equal(app.globalData.member, null)
  assert.equal(app.globalData.staff, null)
})

test('wx.login 失败会结束等待，清除身份且不请求会员接口', async () => {
  const { app, calls } = loadApp([{ wxError: 'login:fail network' }])
  const result = await app.loginPromiseNew
  assert.equal(result.authenticated, false)
  assert.equal(app.globalData.sessionKey, '')
  assert.equal(app.globalData.member, null)
  assert.equal(app.globalData.staff, null)
  assert.deepEqual(calls.requests, [])
})

test('会员接口未返回有效会话时不能认证成功或保存 undefined 字符串', async () => {
  for (const invalid of [null, {}, { session_key: '' }, { session_key: '  ' }]) {
    const { app } = loadApp([{ session: invalid }])
    const result = await app.loginPromiseNew
    assert.equal(result.authenticated, false)
    assert.equal(app.globalData.sessionKey, '')
    assert.equal(app.globalData.member, null)
    assert.equal(app.globalData.staff, null)
  }
})

test('retryLogin 替换已失败的 Promise，重新走微信登录和会员接口', async () => {
  const { app, calls } = loadApp([{ error: 'offline' }, { session }])
  const previous = app.loginPromiseNew
  await previous
  const retried = app.retryLogin()
  assert.notEqual(retried, previous)
  assert.equal(app.loginPromiseNew, retried)
  assert.equal((await retried).authenticated, true)
  assert.equal(calls.login, 2)
  assert.equal(calls.requests.length, 2)
  assert.equal(app.globalData.sessionKey, encodeURIComponent(session.session_key))
})

test('成功后再次登录失败不会残留上一份会话和会员身份', async () => {
  const { app } = loadApp([{ session }, { wxError: 'login:fail network' }])
  await app.loginPromiseNew
  const result = await app.retryLogin()
  assert.equal(result.authenticated, false)
  assert.equal(app.globalData.sessionKey, '')
  assert.equal(app.globalData.member, null)
  assert.equal(app.globalData.staff, null)
})

// ---- 登录失败原因：结果里带阶段和原因，页面显示，微信实时日志留底 ----
const settle = () => new Promise(resolve => setImmediate(resolve))

test('wx.login 失败：结果带阶段 wx_login 和微信返回的原因', async () => {
  const { app } = loadApp([{ wxError: 'login:fail network' }])
  const result = await app.loginPromiseNew
  assert.equal(result.authenticated, false)
  assert.equal(result.stage, 'wx_login')
  assert.equal(result.reason, 'wx_login: login:fail network')
})

test('MemberLogin 网络失败：保留 request:fail 的原因，不再丢成空对象', async () => {
  const { app } = loadApp([{ error: { errMsg: 'request:fail timeout' } }])
  const result = await app.loginPromiseNew
  assert.equal(result.stage, 'member_login')
  assert.equal(result.reason, 'member_login: request:fail timeout')
})

test('MemberLogin 返回非 200 状态码：原因写 HTTP 状态码', async () => {
  const { app } = loadApp([{ error: 502 }])
  const result = await app.loginPromiseNew
  assert.equal(result.reason, 'member_login: HTTP 502')
})

test('MemberLogin 服务端报错：原因带服务端消息', async () => {
  const { app } = loadApp([{ error: '获取session失败 40029 invalid code' }])
  const result = await app.loginPromiseNew
  assert.equal(result.stage, 'member_login')
  assert.equal(result.reason, 'member_login: 获取session失败 40029 invalid code')
})

test('拒绝值里什么文字都没有：原因至少写出失败阶段', async () => {
  const { app } = loadApp([{ error: {} }])
  const result = await app.loginPromiseNew
  assert.equal(result.stage, 'member_login')
  assert.equal(result.reason, 'member_login')
})

test('会员接口没返回有效会话：阶段 no_session', async () => {
  const { app } = loadApp([{ session: {} }])
  const result = await app.loginPromiseNew
  assert.equal(result.stage, 'no_session')
  assert.match(result.reason, /^no_session: /)
})

test('登录成功后的处理抛异常：阶段 after_login 带异常信息', async () => {
  const { app } = loadApp([{ session, deviceThrows: 'wx.getDeviceInfo is not a function' }])
  const result = await app.loginPromiseNew
  assert.equal(result.authenticated, false)
  assert.equal(result.stage, 'after_login')
  assert.equal(result.reason, 'after_login: wx.getDeviceInfo is not a function')
  assert.equal(app.globalData.sessionKey, '')
})

test('原因文字过长会截断，页面不会被撑满', async () => {
  const { app } = loadApp([{ error: 'x'.repeat(300) }])
  const result = await app.loginPromiseNew
  assert.equal(result.reason, 'member_login: ' + 'x'.repeat(100))
})

test('登录失败写入微信实时日志：阶段、原因和网络类型', async () => {
  const { app, calls } = loadApp([{ error: { errMsg: 'request:fail timeout' } }], { realtime: true, networkType: '4g' })
  await app.loginPromiseNew
  await settle()
  assert.equal(calls.realtimeErrors.length, 1)
  assert.equal(calls.realtimeErrors[0][0], 'login failed')
  // app.js 在 vm 沙箱里运行，对象原型和测试进程不同，先转成普通对象再比较
  assert.deepEqual(JSON.parse(JSON.stringify(calls.realtimeErrors[0][1])), {
    stage: 'member_login', message: 'request:fail timeout', networkType: '4g'
  })
})

test('基础库不支持实时日志时，登录失败结果照常返回', async () => {
  const { app } = loadApp([{ wxError: 'login:fail network' }])
  const result = await app.loginPromiseNew
  await settle()
  assert.equal(result.reason, 'wx_login: login:fail network')
})

test('登录成功不写实时日志错误', async () => {
  const { app, calls } = loadApp([{ session }], { realtime: true })
  await app.loginPromiseNew
  await settle()
  assert.deepEqual(calls.realtimeErrors, [])
})

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const authSession = require('../utils/authSession.js')
const tabbar = require('../utils/tabbar.js')

// 运行真实 App 定义，仅替换微信与网络边界，不发起真实登录请求。
function loadApp(attempts) {
  const app = {}
  const calls = { login: 0, requests: [], redirects: [] }
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
    getDeviceInfo() { return {} },
    getWindowInfo() { return { windowWidth: 375 } },
    getAppBaseInfo() { return {} },
    getSystemInfoAsync(options) {
      options.success({ windowWidth: 375 })
      options.complete({})
    },
    redirectTo(options) { calls.redirects.push(options.url) }
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

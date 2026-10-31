const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const authSession = require('../utils/authSession.js')

const ADMIN = '/pages/admin/admin'
const SHOP = '/pages/punchcard/punchcard_shop'

// 运行真实 app.js，替换微信与网络边界。pages 是模拟的页面栈（route 列表）。
function loadApp({ session, scene = '1089', loginError, sysInfoFail, navFail } = {}) {
  const app = {}
  const calls = []
  const stack = []
  let loginResolve
  const wx = {
    login(options) { queueMicrotask(() => options.success({ code: 'c' })) },
    getAccountInfoSync() { return { miniProgram: { envVersion: 'trial' } } },
    getDeviceInfo() { return {} },
    getWindowInfo() { return { windowWidth: 375 } },
    getAppBaseInfo() { return {} },
    getSystemInfoAsync(options) {
      if (sysInfoFail) options.fail({ errMsg: 'fail' })
      else options.success({ windowWidth: 375 })
      options.complete({})
    },
    getSystemInfoSync() { throw new Error('no sync') },
    getUpdateManager() { return { onCheckForUpdate() {}, onUpdateReady() {}, onUpdateFailed() {} } },
    getStorageSync() { return [] },
    setStorageSync() {},
    redirectTo(o) { nav('redirectTo', o) },
    reLaunch(o) { nav('reLaunch', o) }
  }
  function nav(type, o) {
    calls.push({ type, url: o.url })
    queueMicrotask(() => {
      if (navFail) o.fail && o.fail({ errMsg: type + ':fail' })
      else { stack.length = 0; stack.push(o.url.replace(/^\//, '')) }
      o.complete && o.complete()
    })
  }
  const util = {
    performWebRequest() {
      return loginError ? Promise.reject(loginError) : Promise.resolve(session)
    }
  }
  const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8')
    .replace(/^import fuiConfig[^\n]*\n/, 'const fuiConfig = {}\n')
  vm.runInNewContext(source, {
    App(definition) { Object.assign(app, definition) },
    getApp: () => app,
    getCurrentPages: () => stack.map((route) => ({ route })),
    wx,
    require(name) { return name === './utils/authSession.js' ? authSession : util },
    console: { log() {}, warn() {} }
  }, { filename: 'app.js' })
  app.onLaunch({ scene, query: {} })
  stack.push('pages/index/index')
  return { app, calls, stack }
}

const staffSession = { session_key: 'k', member: { id: 1 }, staff: { id: 2 } }
const customerSession = { session_key: 'k', member: { id: 1 }, staff: null }
const tick = () => new Promise((r) => setTimeout(r, 0))
const urls = (calls) => calls.map((c) => c.url)

test('店员以 1000/1010/1089 冷启动：首页进管理员菜单，只跳一次', async () => {
  for (const scene of ['1000', '1010', '1089']) {
    const { app, calls } = loadApp({ session: staffSession, scene })
    await app.routeEntry({ fromIndex: true })
    await tick()
    assert.deepEqual(urls(calls), [ADMIN], scene)
  }
})

test('登录和系统信息获取失败与否，都不影响冷启动分流', async () => {
  const { app, calls } = loadApp({ session: staffSession, sysInfoFail: true })
  await app.routeEntry({ fromIndex: true })
  await tick()
  assert.deepEqual(urls(calls), [ADMIN])
})

test('登录本身不再发出任何跳转', async () => {
  const { app, calls } = loadApp({ session: staffSession })
  await app.loginPromiseNew
  await tick()
  assert.deepEqual(calls, [])
})

test('普通顾客、其他场景、登录失败：首页都去次卡商城', async () => {
  const cases = [
    loadApp({ session: customerSession }),
    loadApp({ session: staffSession, scene: '1011' }), // 扫码进入
    loadApp({ session: staffSession, scene: '1007' }), // 分享卡片
    loadApp({ loginError: '获取会员信息失败' })
  ]
  for (const { app, calls } of cases) {
    await app.routeEntry({ fromIndex: true })
    await tick()
    assert.deepEqual(urls(calls), [SHOP])
  }
})

test('扫码/分享/付款等非首页入口：冷启动不经首页就不分流', async () => {
  const { app, calls, stack } = loadApp({ session: staffSession, scene: '1011' })
  stack.length = 0
  stack.push('pages/ticket/receive')
  await app.loginPromiseNew
  await tick()
  assert.deepEqual(calls, [])
  assert.deepEqual(stack, ['pages/ticket/receive'])
})

test('进菜单后主动回首页只去商城，不再弹回后台', async () => {
  const { app, calls, stack } = loadApp({ session: staffSession })
  await app.routeEntry({ fromIndex: true })
  await tick()
  assert.deepEqual(stack, ['pages/admin/admin'])
  // 菜单 → 业务页 → 返回菜单，都不触发 routeEntry；这里模拟主动回首页
  stack.length = 0
  stack.push('pages/index/index')
  await app.routeEntry({ fromIndex: true })
  await tick()
  assert.deepEqual(urls(calls), [ADMIN, SHOP])
})

test('同一入口内重复调用不会再跳管理员菜单', async () => {
  const { app, calls } = loadApp({ session: staffSession })
  await app.routeEntry({ fromIndex: true })
  await tick()
  await app.routeEntry({ fromIndex: false })
  await tick()
  assert.deepEqual(urls(calls), [ADMIN])
})

test('导航还没完成时不重复发请求', async () => {
  const { app, calls } = loadApp({ session: staffSession })
  const a = app.routeEntry({ fromIndex: true })
  const b = app.routeEntry({ fromIndex: true })
  await Promise.all([a, b])
  await tick()
  assert.deepEqual(urls(calls), [ADMIN])
})

test('已经在管理员页时不再跳转', async () => {
  const { app, calls, stack } = loadApp({ session: staffSession })
  stack.length = 0
  stack.push('pages/admin/admin')
  await app.routeEntry({ fromIndex: false })
  await tick()
  assert.deepEqual(calls, [])
})

test('跳管理员菜单失败后撤回标记，下一次还能重试', async () => {
  const { app, calls } = loadApp({ session: staffSession, navFail: true })
  await app.routeEntry({ fromIndex: true })
  await tick()
  assert.equal(app.globalData.entryHandledRevision, 0)
  await app.routeEntry({ fromIndex: true })
  await tick()
  assert.deepEqual(urls(calls), [ADMIN, ADMIN])
})

test('店员切后台再以 1089 重新进入：新一次入口，重新进菜单', async () => {
  const { app, calls, stack } = loadApp({ session: staffSession, scene: '1000' })
  await app.routeEntry({ fromIndex: true })
  await tick()
  // 菜单 → 商城
  stack.length = 0
  stack.push('pages/punchcard/punchcard_shop')
  app.onHide()
  app.onShow({ scene: '1089' })
  await tick()
  await tick()
  assert.deepEqual(calls.map((c) => [c.type, c.url]), [['redirectTo', ADMIN], ['reLaunch', ADMIN]])
  assert.equal(app.globalData.scene, '1089')
})

test('冷启动后的第一次 onShow 不处理；顾客重新进入也不分流', async () => {
  const staff = loadApp({ session: staffSession })
  staff.app.onShow({ scene: '1089' })
  await tick()
  assert.deepEqual(staff.calls, [])

  const customer = loadApp({ session: customerSession })
  customer.app.onHide()
  customer.app.onShow({ scene: '1089' })
  await tick()
  assert.deepEqual(customer.calls, [])
})

test('登录期间又切后台：旧入口的结果作废', async () => {
  const { app, calls } = loadApp({ session: staffSession })
  const pending = app.routeEntry({ fromIndex: true })
  app.onHide()
  assert.equal(await pending, 'stale')
  await tick()
  assert.deepEqual(calls, [])
})

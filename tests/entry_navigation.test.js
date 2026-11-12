const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
<<<<<<< HEAD

const INDEX = 'pages/index/index'
const ADMIN = 'pages/admin/admin'
const SHOP = 'pages/punchcard/punchcard_shop'
const ROOT = path.join(__dirname, '..')

function setup({ staff = { id: 1, title_level: 100 }, systemInfo = 'success' } = {}) {
  let app, index, loginOptions, requestResolve, requestReject
  let pages = []
  const redirects = []
  const navigations = []
  const warnings = []
  const request = new Promise((resolve, reject) => { requestResolve = resolve; requestReject = reject })
  const wx = {
    request() {},
    login(options) { loginOptions = options },
    getUpdateManager() { return { onCheckForUpdate() {}, onUpdateReady() {}, onUpdateFailed() {} } },
    getStorageSync() { return [] }, setStorageSync() {},
    getAccountInfoSync() { return { miniProgram: { envVersion: 'trial' } } },
    getDeviceInfo() { return {} }, getWindowInfo() { return { windowWidth: 390 } },
    getAppBaseInfo() { return {} }, getSystemInfoSync() { return { windowWidth: 390 } },
    getSystemInfoAsync(options) {
      if (systemInfo === 'pending') return
      if (systemInfo === 'throw') throw new Error('system info unavailable')
      if (systemInfo === 'fail') options.fail({ errMsg: 'system info failed' })
      else options.success({ windowWidth: 390 })
      if (options.complete) options.complete({})
    },
    canIUse() { return true },
    redirectTo(options) { redirects.push(options) },
    navigateTo(options) {
      navigations.push(options.url)
      const current = pages[pages.length - 1]
      const route = options.url.startsWith('/') ? options.url.slice(1)
        : path.posix.join(path.posix.dirname(current.route), options.url)
      pages.push({ route })
    },
    navigateBack() { pages.pop() }
  }
  const context = vm.createContext({
    wx, fuiConfig: {}, Promise,
    console: { log() {}, warn(...args) { warnings.push(args) } },
    getApp() { return app }, getCurrentPages() { return pages },
    App(value) { app = value }, Page(value) { index = value },
    require(name) {
      if (name.endsWith('/util.js')) return { performWebRequest() { return request } }
      if (name.endsWith('/authSession.js')) return {
        resetAuthenticationState(value) { Object.assign(value.globalData, { sessionKey: '', member: null, staff: null }) }
      }
      return {}
    }
  })
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8').replace(/^import fuiConfig[^\n]*\n/, ''), context)
  vm.runInContext(fs.readFileSync(path.join(ROOT, INDEX + '.js'), 'utf8'), context)
  return {
    app, redirects, warnings, navigations,
    launch(scene = 1089, route = INDEX, query = {}) {
      const options = { scene, path: route, query }
      app.onLaunch(options)
      if (app.onShow) app.onShow(options)
      this.page(route)
    },
    show(scene, route = INDEX, query = {}) {
      if (app.onShow) app.onShow({ scene, path: route, query })
    },
    hide() { if (app.onHide) app.onHide() },
    page(route) {
      pages = [{ route }]
      if (route === INDEX) index.onLoad({})
    },
    async login(ok = true) {
      loginOptions.success({ code: 'mock' })
      if (ok) requestResolve({ session_key: 'session', member: { id: 2 }, staff })
      else requestReject(new Error('login failed'))
      await settle()
    },
    finishNavigation() {
      const navigation = redirects[redirects.length - 1]
      pages = [{ route: navigation.url.slice(1) }]
      navigation.complete()
    },
    menu() {
      let menu
      vm.runInNewContext(fs.readFileSync(path.join(ROOT, ADMIN + '.js'), 'utf8'), {
        wx, getApp() { return app }, Page(value) { menu = value }
      })
      menu.setData = function (patch) { Object.assign(this.data, patch) }
      return menu
    },
    backTo(menu) { wx.navigateBack(); menu.onShow() },
    currentRoute() { return pages[pages.length - 1].route },
    urls() { return redirects.map(options => options.url) }
  }
}

async function settle() {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

for (const scene of [1000, 1010, 1089, '1089']) {
  test('店员从首页冷启动只跳管理员菜单一次，scene=' + scene, async () => {
    const h = setup()
    h.launch(scene)
    await h.login()
    assert.deepEqual(h.urls(), ['/' + ADMIN])
  })
}

for (const systemInfo of ['fail', 'pending', 'throw']) {
  test('获取系统信息' + systemInfo + '时仍能按店员身份进入菜单', async () => {
    const h = setup({ systemInfo })
    h.launch()
    await h.login()
    assert.equal(h.app.globalData.staff.id, 1)
    assert.deepEqual(h.urls(), ['/' + ADMIN])
  })
}

test('普通顾客从首页进入次卡商城', async () => {
  const h = setup({ staff: null })
  h.launch()
  await h.login()
  assert.deepEqual(h.urls(), ['/' + SHOP])
})

test('登录失败也能离开首页，不显示管理员菜单', async () => {
  const h = setup()
  h.launch()
  await h.login(false)
  assert.deepEqual(h.urls(), ['/' + SHOP])
})

test('店员从后台以1089重新进入时使用本次场景', async () => {
  const h = setup()
  h.launch(1047, 'pages/order/recept_checkin')
  await h.login()
  assert.deepEqual(h.urls(), [])
  h.hide()
  h.show(1089)
  await settle()
  assert.equal(h.app.globalData.scene, 1089)
  assert.deepEqual(h.urls(), ['/' + ADMIN])
})

test('后台恢复时已经在管理员菜单，不重复跳转', async () => {
  const h = setup()
  h.launch(1089, ADMIN)
  await h.login()
  h.hide()
  h.show(1089)
  await settle()
  assert.deepEqual(h.urls(), [])
})

for (const [scene, route] of [
  [1047, 'pages/order/recept_checkin'],
  [1011, 'pages/order/care_pick_verify'],
  [1007, 'pages/mine/ticket/ticket_detail'],
  [1038, 'pages/order/payment_entry'],
  [1000, 'pages/order/payment_entry']
]) {
  test('直接入口和后台进入都保留指定页面：' + scene + ' ' + route, async () => {
    const h = setup()
    h.launch(scene, route, { id: '1' })
    await h.login()
    h.hide()
    h.show(scene, route, { id: '1' })
    await settle()
    assert.deepEqual(h.urls(), [])
  })
}

test('等待登录时切换到扫码入口，旧入口不再抢跳', async () => {
  const h = setup()
  h.launch()
  h.hide()
  h.show(1047, 'pages/order/recept_checkin')
  h.page('pages/order/recept_checkin')
  await h.login()
  assert.deepEqual(h.urls(), [])
})

test('在后台完成登录时不跳转，重新进入后再跳', async () => {
  const h = setup()
  h.launch()
  h.hide()
  await h.login()
  assert.deepEqual(h.urls(), [])
  h.show(1089)
  await settle()
  assert.deepEqual(h.urls(), ['/' + ADMIN])
})

test('登录早于首页加载时，首页加载后仍只跳一次', async () => {
  const h = setup()
  h.app.onLaunch({ scene: 1089, query: {} })
  if (h.app.onShow) h.app.onShow({ scene: 1089, path: INDEX, query: {} })
  await h.login()
  h.page(INDEX)
  await settle()
  assert.deepEqual(h.urls(), ['/' + ADMIN])
})

for (const scene of [1000, 1010, 1089]) {
  test('进入管理员菜单后主动回首页，正常进入商城，scene=' + scene, async () => {
    const h = setup()
    h.launch(scene)
    await h.login()
    h.finishNavigation()
    h.page(INDEX)
    await settle()
    assert.deepEqual(h.urls(), ['/' + ADMIN, '/' + SHOP])
    h.finishNavigation()
    h.page(INDEX)
    await settle()
    assert.deepEqual(h.urls(), ['/' + ADMIN, '/' + SHOP, '/' + SHOP])
  })
}

test('本次进入时已在管理员菜单，之后也能主动回首页', async () => {
  const h = setup()
  h.launch(1089, ADMIN)
  await h.login()
  h.page(INDEX)
  await settle()
  assert.deepEqual(h.urls(), ['/' + SHOP])
})

test('从商城退出小程序后再以1089进入，仍会自动去管理员菜单一次', async () => {
  const h = setup()
  h.launch()
  await h.login()
  h.finishNavigation()
  h.page(INDEX)
  await settle()
  h.finishNavigation()
  h.hide()
  h.show(1089, SHOP)
  await settle()
  assert.deepEqual(h.urls(), ['/' + ADMIN, '/' + SHOP, '/' + ADMIN])
  h.finishNavigation()
  h.page(INDEX)
  await settle()
  assert.deepEqual(h.urls(), ['/' + ADMIN, '/' + SHOP, '/' + ADMIN, '/' + SHOP])
})

test('付款入口结束后主动回首页，不再被启动场景送进管理员菜单', async () => {
  const h = setup()
  h.launch(1000, 'pages/order/payment_entry', { paymentId: '1' })
  await h.login()
  h.page(INDEX)
  await settle()
  assert.deepEqual(h.urls(), ['/' + SHOP])
})

test('后台恢复的页面与首页交接时，跳转未完成也不会再发一次', async () => {
  const h = setup()
  h.launch(1089, SHOP)
  await h.login()
  h.page(INDEX)
  await settle()
  assert.deepEqual(h.urls(), ['/' + ADMIN])
})

test('普通顾客从后台重新进入时保留当前页面', async () => {
  const h = setup({ staff: null })
  h.launch()
  await h.login()
  h.finishNavigation()
  h.hide()
  h.show(1089, SHOP)
  await settle()
  assert.deepEqual(h.urls(), ['/' + SHOP])
})

for (const scene of [1000, 1010, 1089]) {
  test('进入菜单后可连续打开业务页并返回，不再次自动跳转，scene=' + scene, async () => {
    const h = setup()
    h.launch(scene)
    await h.login()
    h.finishNavigation()
    const menu = h.menu()
    menu.onLoad({})
    menu.onShow()
    await settle()
    for (const [id, route] of [
      ['recept', 'pages/admin/reception/recept_scan'],
      ['rent_list', 'pages/admin/rent/new_rent_list'],
      ['careOrderList', 'pages/admin/care/care_order_list'],
      ['member_list', 'pages/admin/member/member_list']
    ]) {
      menu.nav({ currentTarget: { id } })
      await settle()
      assert.equal(h.currentRoute(), route)
      assert.deepEqual(h.urls(), ['/' + ADMIN])
      h.backTo(menu)
      await settle()
      assert.equal(h.currentRoute(), ADMIN)
      assert.deepEqual(h.urls(), ['/' + ADMIN])
    }
    assert.equal(h.navigations.length, 4)
  })
}

test('跳转失败会记录场景和目标，下次进入可以重试', async () => {
  const h = setup()
  h.launch()
  await h.login()
  assert.equal(typeof h.redirects[0].fail, 'function')
  h.redirects[0].fail({ errMsg: 'redirectTo:fail mock' })
  assert.ok(JSON.stringify(h.warnings).includes('redirectTo:fail mock'))
  h.hide()
  h.show(1089)
  await settle()
  assert.deepEqual(h.urls(), ['/' + ADMIN, '/' + ADMIN])
=======
const authSession = require('../utils/authSession.js')
const tabbar = require('../utils/tabbar.js')

const ADMIN = '/pages/admin/admin'
// 次卡暂时隐藏：顾客的默认落点是雪票页（utils/tabbar.js 的 customerLandingUrl）
const LANDING = '/pages/ski_pass/ski_pass_selector'

// 运行真实 app.js，替换微信与网络边界。pages 是模拟的页面栈（route 列表）。
function loadApp({ session, scene = '1089', launchPath = 'pages/index/index', loginError, sysInfoFail, navFail } = {}) {
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
    require(name) {
      if (name === './utils/authSession.js') return authSession
      if (name === './utils/tabbar.js') return tabbar
      return util
    },
    console: { log() {}, warn() {} }
  }, { filename: 'app.js' })
  stack.push(launchPath)
  app.onLaunch({ scene, path: launchPath, query: {} })
  return { app, calls, stack }
}

const staffSession = { session_key: 'k', member: { id: 1 }, staff: { id: 2 } }
const customerSession = { session_key: 'k', member: { id: 1 }, staff: null }
const tick = () => new Promise((r) => setTimeout(r, 0))
const urls = (calls) => calls.map((c) => c.url)

test('店员冷启动落在首页：不论什么场景，都进管理员菜单，只跳一次', async () => {
  for (const scene of ['1000', '1001', '1007', '1010', '1011', '1035', '1047', '1089', '1104']) {
    const { app, calls } = loadApp({ session: staffSession, scene })
    await app.routeEntry({ fromIndex: true })
    await tick()
    assert.deepEqual(urls(calls), [ADMIN], scene)
  }
})

test('店员冷启动落在雪票选购页：进管理员菜单；带不带斜杠都认', async () => {
  for (const path of ['pages/ski_pass/ski_pass_selector', '/pages/ski_pass/ski_pass_selector']) {
    const { app, calls } = loadApp({ session: staffSession, launchPath: path })
    await app.loginPromiseNew
    await tick()
    assert.deepEqual(calls.map((c) => [c.type, c.url]), [['reLaunch', ADMIN]], path)
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

test('普通顾客、登录失败：首页都去雪票页', async () => {
  const cases = [
    loadApp({ session: customerSession }),
    loadApp({ session: customerSession, scene: '1007' }),
    loadApp({ loginError: '获取会员信息失败' })
  ]
  for (const { app, calls } of cases) {
    await app.routeEntry({ fromIndex: true })
    await tick()
    assert.deepEqual(urls(calls), [LANDING])
  }
})

test('冷启动直接进指定页面（扫码、分享、付款等）：店员也不分流', async () => {
  for (const [scene, path] of [['1011', 'pages/ticket/receive'], ['1007', 'pages/ski_pass/skipass_detail_new'],
    ['1089', 'pages/punchcard/punchcard_shop'], ['1000', 'pages/admin/admin']]) {
    const { app, calls, stack } = loadApp({ session: staffSession, scene, launchPath: path })
    await app.loginPromiseNew
    await tick()
    assert.deepEqual(calls, [], path)
    assert.deepEqual(stack, [path])
  }
})

test('进菜单后主动回首页只去雪票页，不再弹回后台', async () => {
  const { app, calls, stack } = loadApp({ session: staffSession })
  await app.routeEntry({ fromIndex: true })
  await tick()
  assert.deepEqual(stack, ['pages/admin/admin'])
  // 菜单 → 业务页 → 返回菜单，都不触发 routeEntry；这里模拟主动回首页
  stack.length = 0
  stack.push('pages/index/index')
  await app.routeEntry({ fromIndex: true })
  await tick()
  assert.deepEqual(urls(calls), [ADMIN, LANDING])
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

test('后台重新进入落在首页或雪票选购页：新一次入口，重新进菜单', async () => {
  for (const path of ['pages/index/index', 'pages/ski_pass/ski_pass_selector']) {
    const { app, calls, stack } = loadApp({ session: staffSession, scene: '1000' })
    await app.routeEntry({ fromIndex: true })
    await tick()
    stack.length = 0
    stack.push('pages/punchcard/punchcard_shop')
    app.onHide()
    app.onShow({ scene: '1089', path })
    await tick()
    await tick()
    assert.deepEqual(calls.map((c) => [c.type, c.url]), [['redirectTo', ADMIN], ['reLaunch', ADMIN]], path)
  }
})

test('后台重新进入落在其他页面（指定页面或原来的业务页）：不分流', async () => {
  const { app, calls } = loadApp({ session: staffSession })
  await app.routeEntry({ fromIndex: true })
  await tick()
  for (const path of ['pages/ticket/receive', 'pages/punchcard/punchcard_shop', 'pages/admin/care/care_list']) {
    app.onHide()
    app.onShow({ scene: '1007', path })
    await tick()
  }
  assert.deepEqual(urls(calls), [ADMIN])
})

test('冷启动后的第一次 onShow 不处理；顾客重新进入也不分流', async () => {
  const staff = loadApp({ session: staffSession })
  staff.app.onShow({ scene: '1089', path: 'pages/ski_pass/ski_pass_selector' })
  await tick()
  assert.deepEqual(staff.calls, [])

  const customer = loadApp({ session: customerSession })
  customer.app.onHide()
  customer.app.onShow({ scene: '1089', path: 'pages/index/index' })
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

test('app.globalData.userTabBarItem 是 utils/tabbar.js 的菜单：雪票、我的（次卡暂时隐藏）', () => {
  const { app } = loadApp({ session: customerSession })
  assert.deepEqual(app.globalData.userTabBarItem.map((item) => item.text), ['雪票', '我的'])
  assert.deepEqual(app.globalData.userTabBarItem.map((item) => item.pagePath), [LANDING, '/pages/mine/mine'])
>>>>>>> a405d9abe5ec6517ad3f12b7a1855a64e4fbac7a
})

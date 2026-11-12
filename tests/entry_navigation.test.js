const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

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
})

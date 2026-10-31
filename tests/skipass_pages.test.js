// 万龙雪票两个页面：首页按「时长 + 场次」分组显示价格，详情页选装备、点带价格的月历；顾客只能看，店员才能订。
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle } = require('./reception_harness.js')

const SELECTOR = 'pages/ski_pass/ski_pass_selector.js'
const DETAIL = 'pages/ski_pass/skipass_detail_new.js'
const NOW = new Date(2026, 10, 2, 10, 0, 0) // 2026-11-02 周一 10:00

function rows(list) {
  return list.map(([date, price]) => ({ reserve_date: date + 'T00:00:00', deal_price: price, marketPrice: price }))
}

const PRICES = [['2026-11-02', 399], ['2026-11-03', 399], ['2026-11-07', 479]]

const PRODUCTS = [
  { product_id: 31, name: '【25-26雪季】1天日场含全套雪具滑雪票', dailyPrice: rows([['2026-11-02', 659], ['2026-11-07', 739]]) },
  { product_id: 32, name: '【25-26雪季】1天日场自带板滑雪票', dailyPrice: rows(PRICES) },
  { product_id: 33, name: '【25-26雪季】1天日场含雪具滑雪票', dailyPrice: rows([['2026-11-03', 579], ['2026-11-07', 659]]) },
  { product_id: 41, name: '【25-26雪季】夜场自带板滑雪票', dailyPrice: rows([['2026-11-02', 249]]) },
  { product_id: 51, name: '【25-26雪季】4小时日场自带板滑雪票', dailyPrice: [] }
]

function setup(opts) {
  const o = Object.assign({ staff: null, products: PRODUCTS, resorts: ['万龙', '南山'], balance: 5000, myInfo: { real_name: '王店员', cell: '13900139000' } }, opts)
  const requests = []
  const store = {}
  const navs = []
  const toasts = []
  const modals = []
  const app = {
    loginPromiseNew: Promise.resolve(),
    globalData: { domainName: 'api.test', requestPrefix: 'https://api.test/core/', sessionKey: 'sk%20x', staff: o.staff,
      userTabBarItem: [{ pagePath: '/pages/index/index', text: '首页' }] }
  }
  global.getApp = () => app
  global.wx = {
    request(req) {
      requests.push(req.url)
      let data = []
      let statusCode = 200
      if (req.url.indexOf('SkiPass/GetResorts') >= 0) data = o.resorts
      else if (req.url.indexOf('SkiPass/GetProductsByResort') >= 0) data = o.products
      else if (req.url.indexOf('WanlongZiwoyouHelper/GetBalance') >= 0) {
        const m = req.url.match(/[?&]source=([^&]*)/)
        const src = m ? decodeURIComponent(m[1]) : ''
        data = o.balances && Object.prototype.hasOwnProperty.call(o.balances, src) ? o.balances[src] : o.balance
      }
      else if (req.url.indexOf('SkiPass/ReserveSkiPass') >= 0) {
        if (o.reserve) { statusCode = o.reserve.statusCode; data = o.reserve.data }
        else data = { payments: [{ id: 7 }] }
      } else if (req.url.indexOf('WechatPayByOrderPayment') >= 0) data = { data: { nonce: 'n', prepay_id: 'p', sign: 's', timestamp: 't' } }
      req.success({ statusCode, data })
    },
    getStorageSync(k) { return store[k] },
    setStorageSync(k, v) { store[k] = v },
    navigateTo(x) { navs.push(x.url) },
    redirectTo(x) { navs.push(x.url) },
    showToast(x) { toasts.push(x.title) },
    showLoading() {},
    hideLoading() {},
    showModal(x) { modals.push(x); if (x.success && o.confirm !== false) x.success({ confirm: true }) },
    requestPayment() {},
    setNavigationBarTitle() {},
    getWindowInfo() { return { statusBarHeight: 20, windowWidth: 375 } },
    getMenuButtonBoundingClientRect() { return { top: 26, left: 280, height: 32 } }
  }
  const fakeData = { getMyInfo() { return Promise.resolve(o.myInfo) } }
  return { app, requests, navs, toasts, modals, store, fakeData }
}

function cleanup() {
  delete global.getApp
  delete global.wx
}

function load(file, env) {
  const page = loadPage(file, env.fakeData)
  page._now = () => NOW
  return page
}

// ---------------- 首页 ----------------

test('首页：顾客看到分组卡片和价格，顶部提示仅限店员订票；只有一个雪场不显示标签栏', async () => {
  const env = setup()
  const page = load(SELECTOR, env)
  page.onLoad({ resort: encodeURIComponent('万龙') })
  await settle()
  assert.equal(page.data.isStaff, false)
  assert.equal(page.data.loaded, true)
  assert.equal(page.data.showTabs, false)
  assert.deepEqual(page.data.groups.map(x => [x.title, x.minPriceStr, x.subtitle]), [
    ['1天日场', '399', '2 种装备'],
    ['夜场', '249', '自带板']
  ])
  const call = env.requests.find(u => u.indexOf('GetProductsByResort') >= 0)
  assert.ok(call.indexOf('resort=' + encodeURIComponent('万龙')) >= 0)
  assert.ok(call.indexOf('showHidden=0') >= 0)
  assert.ok(call.indexOf('sessionKey=' + encodeURIComponent('sk%20x')) >= 0)
  assert.equal(page.data.tabbarItemList.length, 1)
  cleanup()
})

test('首页：店员身份标记为店员', async () => {
  const env = setup({ staff: { id: 28 } })
  const page = load(SELECTOR, env)
  page.onLoad({ resort: encodeURIComponent('万龙') })
  await settle()
  assert.equal(page.data.isStaff, true)
  cleanup()
})

test('首页：整个雪场都没有可订日期，显示价格暂未发布', async () => {
  const env = setup({ products: [PRODUCTS[4]] })
  const page = load(SELECTOR, env)
  page.onLoad({})
  await settle()
  assert.equal(page.data.loaded, true)
  assert.deepEqual(page.data.groups, [])
  assert.equal(page.data.resort, '万龙')
  cleanup()
})

test('首页：接口失败不显示空状态误导', async () => {
  const env = setup()
  global.wx.request = req => { req.success({ statusCode: 500, data: 'oops' }) }
  const page = load(SELECTOR, env)
  page.onLoad({})
  await settle()
  assert.equal(page.data.loaded, true)
  assert.equal(page.data.loadFailed, true)
  cleanup()
})

test('首页：点卡片进详情页，带分组键和雪场，保留 memberId、staffId', async () => {
  const env = setup()
  const page = load(SELECTOR, env)
  page.onLoad({ resort: encodeURIComponent('万龙'), memberId: '5', staffId: '28' })
  await settle()
  const key = page.data.groups[0].key
  page.gotoDetail({ currentTarget: { dataset: { key } } })
  assert.equal(env.navs.length, 1)
  assert.equal(env.navs[0],
    'skipass_detail_new?group=' + encodeURIComponent(key) + '&resort=' + encodeURIComponent('万龙') + '&memberId=5&staffId=28')
  cleanup()
})

test('首页：有多个雪场时才显示标签栏，南山被剔除', async () => {
  const env = setup({ resorts: ['万龙', '南山', '云顶'] })
  const page = load(SELECTOR, env)
  page.onLoad({ resort: encodeURIComponent('万龙') })
  await settle()
  assert.deepEqual(page.data.resortArr, ['万龙', '云顶'])
  assert.equal(page.data.showTabs, true)
  cleanup()
})

// ---------------- 详情页 ----------------

async function openDetail(env, options) {
  const page = load(DETAIL, env)
  page.onLoad(options)
  await settle()
  return page
}

function dayKey(page) {
  // 1天日场的分组键：和首页用同一个函数算出来
  return require('../utils/skipass_group.js').buildGroups(PRODUCTS, NOW).find(g => g.title === '1天日场').key
}

test('详情页：按分组打开，默认选自带板和第一个有价日期，月历只有有价日期可点', async () => {
  const env = setup({ staff: { id: 28 } })
  const page = await openDetail(env, { group: dayKey(), resort: encodeURIComponent('万龙') })
  assert.equal(page.data.groupTitle, '1天日场')
  // 含全套雪具不出现；含雪具留着但置灰
  assert.deepEqual(page.data.gearOptions.map(x => [x.id, x.label, x.minPriceStr, x.disabled]), [
    [32, '自带板', '399', false], [33, '含雪具', '579', true]
  ])
  assert.equal(page.data.productId, 32)
  assert.equal(page.data.selectedDate, '2026-11-02')
  assert.equal(page.data.priceStr, '399')
  assert.equal(page.data.summaryStr, '¥399.00')
  assert.equal(page.data.hasPrice, true)
  const nov = page.data.months[0]
  assert.deepEqual(nov.cells.filter(c => c.enabled).map(c => c.date), ['2026-11-02', '2026-11-03', '2026-11-07'])
  cleanup()
})

test('详情页：旧链接只带 id，也能打开所在分组并选中该商品；指到暂未上线的含雪具时改选可选的装备', async () => {
  const env = setup({ staff: { id: 28 } })
  const page = await openDetail(env, { id: '32' })
  assert.equal(page.data.groupTitle, '1天日场')
  assert.equal(page.data.productId, 32)
  cleanup()

  const env2 = setup({ staff: { id: 28 } })
  const page2 = await openDetail(env2, { id: '33' })
  assert.equal(page2.data.groupTitle, '1天日场')
  assert.equal(page2.data.productId, 32)
  assert.equal(page2.data.selectedDate, '2026-11-02')
  assert.equal(page2.data.priceStr, '399')
  cleanup()
})

const TWO_GEARS = PRODUCTS.concat([
  { product_id: 34, name: '【25-26雪季】1天日场不含雪具滑雪票', dailyPrice: rows([['2026-11-02', 419], ['2026-11-07', 499]]) }
])

test('详情页：切换装备，日期还有价就保留，没价就换成第一个有价日期', async () => {
  const env = setup({ staff: { id: 28 }, products: TWO_GEARS })
  const key = require('../utils/skipass_group.js').buildGroups(TWO_GEARS, NOW).find(g => g.title === '1天日场').key
  const page = await openDetail(env, { group: key })
  page.onSelectDay({ currentTarget: { dataset: { date: '2026-11-07', enabled: true } } })
  assert.equal(page.data.priceStr, '479')
  page.onSelectGear({ currentTarget: { dataset: { id: 34 } } })
  assert.equal(page.data.productId, 34)
  assert.equal(page.data.selectedDate, '2026-11-07')
  assert.equal(page.data.priceStr, '499')
  page.setDate('2026-11-02')
  page.onSelectGear({ currentTarget: { dataset: { id: 32 } } })
  page.onSelectDay({ currentTarget: { dataset: { date: '2026-11-03', enabled: true } } })
  page.onSelectGear({ currentTarget: { dataset: { id: 34 } } })
  assert.equal(page.data.selectedDate, '2026-11-02') // 不含雪具 11-03 没价格
  assert.equal(page.data.priceStr, '419')
  cleanup()
})

test('详情页：含雪具置灰，点了提示暂未上线、不切换；含全套雪具不出现', async () => {
  const env = setup({ staff: { id: 28 } })
  const page = await openDetail(env, { group: dayKey() })
  assert.equal(page.data.gearOptions.some(x => /全套/.test(x.label)), false)
  assert.equal(page.data.gearOptions.find(x => x.label === '含雪具').disabled, true)
  assert.equal(page.data.productId, 32)
  page.onSelectGear({ currentTarget: { dataset: { id: 33 } } })
  assert.equal(page.data.productId, 32)
  assert.equal(page.data.priceStr, '399')
  assert.deepEqual(env.toasts, ['含雪具暂未上线，请过几天再看'])
  cleanup()
})

test('详情页：整个分组只有含雪具（暂未上线）时，打开不报错但不能支付', async () => {
  const only = [{ product_id: 61, name: '【25-26雪季】1.5天日场含雪具套票', dailyPrice: rows([['2026-11-02', 799]]) }]
  const env = setup({ staff: { id: 28 }, products: only })
  const key = require('../utils/skipass_group.js').buildGroups(only, NOW)[0].key
  const page = await openDetail(env, { group: key })
  assert.equal(page.data.hasPrice, true)
  assert.equal(page.data.productId, 61)
  assert.equal(page.data.canAdd, false)
  cleanup()
})

test('详情页：点没有价格的日期没反应', async () => {
  const env = setup({ staff: { id: 28 } })
  const page = await openDetail(env, { group: dayKey() })
  page.onSelectDay({ currentTarget: { dataset: { date: '2026-11-05', enabled: false } } })
  assert.equal(page.data.selectedDate, '2026-11-02')
  cleanup()
})

test('详情页：顾客不显示游客信息和购物车，不取个人信息，不能加入购物车', async () => {
  const env = setup()
  const page = await openDetail(env, { group: dayKey() })
  assert.equal(page.data.isStaff, false)
  assert.equal(page.data.canAdd, false)
  assert.equal(page.data.priceStr, '399')
  page.onAddToCart()
  assert.deepEqual(env.toasts, ['仅限店员订票'])
  assert.equal(env.store['skipass_cart_v1'], undefined)
  cleanup()
})

test('详情页：店员带出本人姓名手机号，不再查预存款（结算时后端核对）', async () => {
  const env = setup({ staff: { id: 28 } })
  const page = await openDetail(env, { group: dayKey() })
  assert.equal(page.data.isStaff, true)
  assert.equal(page.data.canAdd, true)
  assert.equal(page.data.name, '王店员')
  assert.equal(page.data.cell, '13900139000')
  assert.equal(env.requests.some(u => u.indexOf('GetBalance') >= 0), false)
  assert.equal(env.requests.some(u => u.indexOf('ReserveSkiPass') >= 0), false)
  cleanup()
})

test('详情页：加入购物车，校验的是用户实际填的姓名和手机号；相同的合并成一条', async () => {
  const env = setup({ staff: { id: 28 }, myInfo: {} })
  const page = await openDetail(env, { group: dayKey(), staffId: '28', memberId: '5' })
  page.onAddToCart()
  assert.deepEqual(env.toasts, ['请填写姓名'])
  page.onNameInput({ detail: { value: '张三' } })
  page.onAddToCart()
  assert.equal(env.toasts[1], '请填写正确的手机号')
  page.onPhoneInput({ detail: { value: '12345' } })
  page.onAddToCart()
  assert.equal(env.toasts[2], '请填写正确的手机号')
  assert.equal(env.store['skipass_cart_v1'], undefined)

  page.onPhoneInput({ detail: { value: '13800138000' } })
  page.onAddToCart()
  page.onAddToCart()
  assert.equal(env.toasts[3], '已加入购物车')
  const cart = env.store['skipass_cart_v1']
  assert.equal(cart.items.length, 1)
  assert.deepEqual([cart.items[0].productId, cart.items[0].date, cart.items[0].cell, cart.items[0].name, cart.items[0].price, cart.items[0].count],
    [32, '2026-11-02', '13800138000', '张三', 399, 2])
  assert.equal(cart.staffId, '28')
  assert.equal(cart.items[0].resort, '万龙')
  assert.equal(page.data.cartCount, 2)
  // 换一天，是新的一条
  page.onSelectDay({ currentTarget: { dataset: { date: '2026-11-03', enabled: true } } })
  page.onAddToCart()
  assert.equal(env.store['skipass_cart_v1'].items.length, 2)
  assert.equal(page.data.cartCount, 3)
  assert.equal(env.requests.some(u => u.indexOf('ReserveSkiPass') >= 0), false)
  cleanup()
})

test('详情页：购物车满 10 张不能再加', async () => {
  const env = setup({ staff: { id: 28 } })
  const page = await openDetail(env, { group: dayKey() })
  page.onNameInput({ detail: { value: '张三' } })
  page.onPhoneInput({ detail: { value: '13800138000' } })
  for (let i = 0; i < 10; i++) page.onAddToCart()
  assert.equal(page.data.cartCount, 10)
  page.onAddToCart()
  assert.equal(env.toasts[env.toasts.length - 1], '购物车最多 10 张票')
  assert.equal(page.data.cartCount, 10)
  cleanup()
})

test('详情页：点购物车进购物车页', async () => {
  const env = setup({ staff: { id: 28 } })
  const page = await openDetail(env, { group: dayKey() })
  page.onOpenCart()
  assert.equal(env.navs[env.navs.length - 1], '/pages/ski_pass/skipass_cart')
  cleanup()
})

test('详情页：链接里的分组已经没有价格了，显示暂无价格而不是报错', async () => {
  const env = setup({ staff: { id: 28 }, products: [PRODUCTS[4]] })
  const page = await openDetail(env, { group: 'whatever' })
  assert.equal(page.data.hasPrice, false)
  assert.equal(page.data.canAdd, false)
  assert.deepEqual(page.data.months, [])
  cleanup()
})

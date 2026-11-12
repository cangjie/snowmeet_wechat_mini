// 雪票购物车页：显示合并后的行和合计，加减删，结算下单一次、一次支付，成功后清空并跳「我的雪票」。
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle } = require('./reception_harness.js')
const cart = require('../utils/skipass_cart.js')

const FILE = 'pages/ski_pass/skipass_cart.js'

const NOW = new Date(2026, 10, 2, 10, 0, 0) // 2026-11-02 周一 10:00
const rows = list => list.map(([date, price]) => ({ reserve_date: date + 'T00:00:00', deal_price: price, marketPrice: price }))
const PRODUCTS = [
  { product_id: 641, name: '【万龙】全雪区日场4小时雪票-11.6', dailyPrice: rows([['2026-11-03', 309], ['2026-11-04', 309], ['2026-11-06', 309], ['2026-11-07', 369]]) },
  { product_id: 643, name: '【万龙】全雪区日场6小时雪票-11.6', dailyPrice: rows([['2026-11-04', 359], ['2026-11-07', 419]]) }
]

function seedCart() {
  let r = cart.addItem(cart.emptyCart(), { productId: 641, title: '【万龙】全雪区日场4小时雪票-11.6', date: '2026-11-03', cell: '13501177897', name: '张三', price: 309, staffId: '28' }, 2)
  r = cart.addItem(r.cart, { productId: 643, title: '【万龙】全雪区日场6小时雪票-11.6', date: '2026-11-04', cell: '13900139000', name: '李四', price: 359 }, 1)
  return r.cart
}

function setup(o) {
  o = Object.assign({ staff: { id: 28 }, reserve: null, confirm: true, payOk: true, products: PRODUCTS }, o)
  const store = {}
  const requests = []
  const toasts = []
  const modals = []
  const navs = []
  store[cart.STORAGE_KEY] = o.cart === undefined ? seedCart() : o.cart
  global.getApp = () => ({
    loginPromiseNew: Promise.resolve(),
    globalData: { domainName: 'api.test', requestPrefix: 'https://api.test/core/', sessionKey: 'sk%20x', staff: o.staff }
  })
  global.getCurrentPages = () => [{}]
  global.wx = {
    getStorageSync: k => store[k],
    setStorageSync: (k, v) => { store[k] = v },
    request(req) {
      requests.push(req)
      if (req.url.indexOf('GetProductsByResort') >= 0) {
        req.success({ statusCode: 200, data: o.products })
      } else if (req.url.indexOf('ReserveSkiPassCart') >= 0) {
        const r = o.reserve || { statusCode: 200, data: { total_amount: 977, payments: [{ id: 7 }] } }
        req.success(r)
      } else if (req.url.indexOf('WechatPayByOrderPayment') >= 0) {
        req.success({ statusCode: 200, data: { data: { nonce: 'n', prepay_id: 'p', sign: 's', timestamp: 't' } } })
      }
    },
    requestPayment(x) { if (o.payOk) x.success(); else x.fail() },
    showToast(x) { toasts.push(x.title); if (x.complete) x.complete() },
    showLoading() {}, hideLoading() {},
    showModal(x) { modals.push(x); if (x.success) x.success({ confirm: o.confirm }) },
    redirectTo(x) { navs.push(x.url) },
    navigateBack() { navs.push('back') }
  }
  return { store, requests, toasts, modals, navs }
}

function cleanup() { delete global.getApp; delete global.wx; delete global.getCurrentPages }

async function open(env) {
  const page = loadPage(FILE, {})
  page._now = () => NOW
  page.onLoad()
  await settle()
  return page
}

test('购物车页：每条显示 票种 日期 手机号 × n，底部合计', async () => {
  const env = setup()
  const page = await open(env)
  assert.equal(page.data.empty, false)
  assert.equal(page.data.ticketCount, 3)
  assert.equal(page.data.totalStr, '¥977.00')
  assert.deepEqual(page.data.lines.map(l => [l.title, l.dateText, l.cell, l.count, l.lineTotalStr]), [
    ['【万龙】全雪区日场4小时雪票-11.6', '11月3日 周二', '13501177897', 2, '¥618.00'],
    ['【万龙】全雪区日场6小时雪票-11.6', '11月4日 周三', '13900139000', 1, '¥359.00']
  ])
  cleanup()
})

test('购物车页：加减张数、删除，合计跟着变，存回本机', async () => {
  const env = setup()
  const page = await open(env)
  const key = page.data.lines[0].key
  page.onInc({ currentTarget: { dataset: { key } } })
  assert.equal(page.data.totalStr, '¥1286.00')
  page.onDec({ currentTarget: { dataset: { key } } })
  page.onDec({ currentTarget: { dataset: { key } } })
  assert.equal(page.data.lines[0].count, 1)
  page.onDec({ currentTarget: { dataset: { key } } })
  assert.equal(page.data.lines.length, 1)
  assert.equal(env.store[cart.STORAGE_KEY].items.length, 1)
  page.onRemove({ currentTarget: { dataset: { key: page.data.lines[0].key } } })
  assert.equal(page.data.empty, true)
  assert.equal(page.data.totalStr, '¥0.00')
  cleanup()
})

test('购物车页：满 10 张再加提示上限', async () => {
  const full = cart.addItem(cart.emptyCart(), { productId: 641, title: 't', date: '2026-11-03', cell: '13501177897', name: '张三', price: 309 }, 10).cart
  const env = setup({ cart: full })
  const page = await open(env)
  page.onInc({ currentTarget: { dataset: { key: page.data.lines[0].key } } })
  assert.deepEqual(env.toasts, ['购物车最多 10 张票'])
  assert.equal(page.data.ticketCount, 10)
  cleanup()
})

test('购物车页：结算——一次下单带全部条目，一次支付，成功后清空购物车并跳新版我的雪票', async () => {
  const env = setup()
  const page = await open(env)
  page.onCheckout()
  assert.match(env.modals[0].content, /共 3 张/)
  assert.match(env.modals[0].content, /合计 ¥977\.00/)
  const reserve = env.requests.find(r => r.url.indexOf('ReserveSkiPassCart') >= 0)
  assert.equal(reserve.method, 'POST')
  assert.ok(reserve.url.indexOf('sessionKey=' + encodeURIComponent('sk%20x')) >= 0)
  assert.deepEqual(reserve.data, {
    staffId: 28,
    items: [
      { productId: 641, date: '2026-11-03', cell: '13501177897', name: '张三', count: 2 },
      { productId: 643, date: '2026-11-04', cell: '13900139000', name: '李四', count: 1 }
    ]
  })
  assert.equal(env.requests.filter(r => r.url.indexOf('WechatPayByOrderPayment/7') >= 0).length, 1)
  assert.deepEqual(env.store[cart.STORAGE_KEY].items, [])
  assert.equal(env.navs[env.navs.length - 1], '/pages/mine/skipass/my_skipasses')
  cleanup()
})

test('购物车页：后端拒绝（预存款不足等）显示原因，购物车保留，可重试', async () => {
  const env = setup({ reserve: { statusCode: 400, data: '大好河山预存款不足，暂时不能订票' } })
  const page = await open(env)
  page.onCheckout()
  assert.deepEqual(env.toasts, ['大好河山预存款不足，暂时不能订票'])
  assert.equal(page.data.paying, false)
  assert.equal(env.store[cart.STORAGE_KEY].items.length, 2)
  assert.equal(env.requests.some(r => r.url.indexOf('WechatPayByOrderPayment') >= 0), false)
  cleanup()
})

test('购物车页：支付取消，购物车保留', async () => {
  const env = setup({ payOk: false })
  const page = await open(env)
  page.onCheckout()
  assert.deepEqual(env.toasts, ['支付已取消'])
  assert.equal(page.data.paying, false)
  assert.equal(env.store[cart.STORAGE_KEY].items.length, 2)
  cleanup()
})

test('购物车页：后台价格和购物车里不一致，先让店员确认；不继续就不支付', async () => {
  const env = setup({ reserve: { statusCode: 200, data: { total_amount: 1000, payments: [{ id: 7 }] } } })
  const page = await open(env)
  let n = 0
  global.wx.showModal = (x) => { env.modals.push(x); n++; if (x.success) x.success({ confirm: n === 1 }) } // 第一次确认订单，第二次拒绝价格变化
  page.onCheckout()
  assert.equal(env.modals[1].title, '价格已更新')
  assert.match(env.modals[1].content, /¥1000\.00.*¥977\.00/)
  assert.equal(env.requests.some(r => r.url.indexOf('WechatPayByOrderPayment') >= 0), false)
  assert.equal(page.data.paying, false)
  cleanup()
})

test('购物车页：非店员不能结算；空购物车提示；不确认订单就不下单', async () => {
  let env = setup({ staff: null })
  let page = await open(env)
  page.onCheckout()
  assert.deepEqual(env.toasts, ['仅限店员订票'])
  cleanup()

  env = setup({ cart: cart.emptyCart() })
  page = await open(env)
  assert.equal(page.data.empty, true)
  page.onCheckout()
  assert.deepEqual(env.toasts, ['购物车是空的'])
  cleanup()

  env = setup({ confirm: false })
  page = await open(env)
  page.onCheckout()
  assert.equal(env.requests.filter(r => r.url.indexOf('GetProductsByResort') < 0).length, 0)
  cleanup()
})

test('购物车页：日期下拉列出这个票种有价格的日期，每项带当天价格', async () => {
  const env = setup()
  const page = await open(env)
  assert.deepEqual(page.data.lines[0].dateRange, ['11月3日 周二  ¥309.00', '11月4日 周三  ¥309.00', '11月6日 周五  ¥309.00', '11月7日 周六  ¥369.00'])
  assert.equal(page.data.lines[0].dateIndex, 0)
  assert.equal(page.data.lines[1].dateRange.length, 2)
  assert.equal(page.data.lines[1].dateIndex, 0)
  assert.ok(env.requests.some(r => r.url.indexOf('GetProductsByResort') >= 0 && r.url.indexOf(encodeURIComponent('万龙')) >= 0))
  cleanup()
})

test('购物车页：改日期，价格换成新日期的价格，合计跟着变并存回本机', async () => {
  const env = setup()
  const page = await open(env)
  assert.equal(page.data.totalStr, '¥977.00')
  const key = page.data.lines[0].key
  page.onDateChange({ currentTarget: { dataset: { key } }, detail: { value: 3 } }) // 11-07 周六 369
  assert.equal(page.data.lines[0].dateText, '11月7日 周六')
  assert.equal(page.data.lines[0].priceStr, '¥369.00')
  assert.equal(page.data.lines[0].lineTotalStr, '¥738.00')
  assert.equal(page.data.totalStr, '¥1097.00')
  const saved = env.store[cart.STORAGE_KEY].items[0]
  assert.deepEqual([saved.date, saved.price, saved.count], ['2026-11-07', 369, 2])
  assert.equal(page.data.lines[0].dateIndex, 3)
  // 选回原来的日期，价格也回来
  page.onDateChange({ currentTarget: { dataset: { key: page.data.lines[0].key } }, detail: { value: 0 } })
  assert.equal(page.data.totalStr, '¥977.00')
  cleanup()
})

test('购物车页：改日期后和另一条票种、日期、手机号都相同，合并成一条并累加张数', async () => {
  let r = cart.addItem(cart.emptyCart(), { productId: 641, title: 't', date: '2026-11-03', cell: '13501177897', name: '张三', price: 309 }, 2)
  r = cart.addItem(r.cart, { productId: 641, title: 't', date: '2026-11-04', cell: '13501177897', name: '张三', price: 309 }, 1)
  const env = setup({ cart: r.cart })
  const page = await open(env)
  page.onDateChange({ currentTarget: { dataset: { key: page.data.lines[0].key } }, detail: { value: 1 } }) // 11-03 → 11-04
  assert.equal(page.data.lines.length, 1)
  assert.deepEqual([page.data.lines[0].count, page.data.lines[0].dateText], [3, '11月4日 周三'])
  assert.equal(page.data.ticketCount, 3)
  assert.equal(page.data.totalStr, '¥927.00')
  cleanup()
})

test('购物车页：改手机号——合法的保存，不合法的提示并恢复，没改不动，改成和另一条相同就合并', async () => {
  let r = cart.addItem(cart.emptyCart(), { productId: 641, title: 't', date: '2026-11-03', cell: '13501177897', name: '张三', price: 309 }, 1)
  r = cart.addItem(r.cart, { productId: 641, title: 't', date: '2026-11-03', cell: '13900139000', name: '李四', price: 309 }, 1)
  const env = setup({ cart: r.cart })
  const page = await open(env)
  const key = page.data.lines[0].key
  page.onCellBlur({ currentTarget: { dataset: { key } }, detail: { value: '12345' } })
  assert.deepEqual(env.toasts, ['请填写正确的手机号'])
  assert.equal(page.data.lines[0].cell, '13501177897')
  page.onCellBlur({ currentTarget: { dataset: { key } }, detail: { value: '13501177897' } })
  assert.equal(env.toasts.length, 1)
  page.onCellBlur({ currentTarget: { dataset: { key } }, detail: { value: ' 13600136000 ' } })
  assert.equal(page.data.lines[0].cell, '13600136000')
  assert.equal(env.store[cart.STORAGE_KEY].items[0].cell, '13600136000')
  // 改成和另一条一样的手机号：合并
  page.onCellBlur({ currentTarget: { dataset: { key: page.data.lines[0].key } }, detail: { value: '13900139000' } })
  assert.equal(page.data.lines.length, 1)
  assert.equal(page.data.lines[0].count, 2)
  cleanup()
})

test('购物车页：购物车里的价格和现在的价格不一样，打开时同步成现在的价格', async () => {
  const stale = cart.addItem(cart.emptyCart(), { productId: 641, title: 't', date: '2026-11-03', cell: '13501177897', name: '张三', price: 319 }, 2).cart
  const env = setup({ cart: stale })
  const page = await open(env)
  assert.equal(page.data.lines[0].priceStr, '¥309.00')
  assert.equal(page.data.totalStr, '¥618.00')
  assert.equal(env.store[cart.STORAGE_KEY].items[0].price, 309)
  cleanup()
})

test('购物车页：这个票种现在没有可选日期（价格接口没给）时，日期显示但不可改', async () => {
  const env = setup({ products: [] })
  const page = await open(env)
  assert.deepEqual(page.data.lines.map(l => l.dateRange.length), [0, 0])
  page.onDateChange({ currentTarget: { dataset: { key: page.data.lines[0].key } }, detail: { value: 0 } })
  assert.equal(page.data.lines[0].dateText, '11月3日 周二')
  cleanup()
})

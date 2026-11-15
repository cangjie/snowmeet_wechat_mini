// 分销商（教练 / 机构）订票二维码落地：scene d= 解析、购物车携带、和员工码互斥（后扫覆盖）、结算请求带 introducerId；
// 以及「我的顾客与消费」两个页面。设计：snowmeet_ai_doc/docs/superpowers/specs/2026-11-15-distributor-backend-design.md
const test = require('node:test')
const assert = require('node:assert/strict')
const scene = require('../utils/skipass_staff_scene.js')
const cart = require('../utils/skipass_cart.js')
const api = require('../pages/distributor/common/api.js')
const { loadPage, settle } = require('./reception_harness.js')

const ITEM = over => Object.assign({ productId: 641, title: '日场', date: '2026-11-20', cell: '13501177897', name: '张三', price: 309 }, over)

test('scene：d=<编号> 只认合法分销商编号；员工的 s= 不受影响，互不串', () => {
  assert.equal(scene.distributorId('d=42'), '42')
  assert.equal(scene.distributorId(encodeURIComponent('d=42')), '42')
  assert.equal(scene.distributorFromOptions({ scene: encodeURIComponent('d=7') }), '7')
  for (const bad of ['d=0', 'd=-1', 'd=abc', 'd=2147483648', 'd=1&x=2', 's=42', '', undefined, null]) assert.equal(scene.distributorId(bad), '')
  assert.equal(scene.fromOptions({ scene: encodeURIComponent('d=42') }), '')       // 员工解析不认 d=
  assert.equal(scene.distributorFromOptions({ scene: encodeURIComponent('s=42') }), '')
  assert.equal(scene.distributorFromOptions(null), '')
})

test('购物车：分销商码跟着购物车走，结算请求带 introducerId；没扫码就没有这个字段（旧请求体不变）', () => {
  assert.deepEqual(cart.toRequest(cart.emptyCart()), { staffId: null, items: [] })
  let r = cart.addItem(cart.emptyCart(), ITEM({ distributorId: '9' }), 2)
  r = cart.addItem(r.cart, ITEM({ productId: 643, cell: '13900139000' }))      // 后加的票没带码，沿用购物车上的
  assert.equal(r.cart.distributorId, '9')
  assert.equal(r.cart.staffId, '')
  const req = cart.toRequest(r.cart)
  assert.equal(req.introducerId, 9)
  assert.equal(req.staffId, null)
  // 改张数、改手机号、删除都不丢分销商码
  const key = r.cart.items[0].key
  assert.equal(cart.changeCount(r.cart, key, 1).cart.distributorId, '9')
  assert.equal(cart.editLine(r.cart, key, { cell: '13700000000' }).cart.distributorId, '9')
  assert.equal(cart.remove(r.cart, key).distributorId, '9')
})

test('购物车：员工码和分销商码互斥，后扫的覆盖先扫的', () => {
  let r = cart.addItem(cart.emptyCart(), ITEM({ staffId: '28' }))
  assert.equal(r.cart.staffId, '28')
  r = cart.addItem(r.cart, ITEM({ productId: 643, distributorId: '9' }))
  assert.deepEqual([r.cart.staffId, r.cart.distributorId], ['', '9'])
  r = cart.addItem(r.cart, ITEM({ productId: 644, staffId: '28' }))
  assert.equal(r.cart.staffId, '28')
  assert.equal(r.cart.distributorId, undefined)
  assert.equal(cart.toRequest(r.cart).introducerId, undefined)
})

test('购物车：存取本机时保留分销商码；老数据（没有这个字段）照常读', () => {
  const store = {}
  global.wx = { getStorageSync: k => store[k], setStorageSync: (k, v) => { store[k] = v } }
  try {
    cart.save({ items: [Object.assign({ count: 1, key: 'a' }, ITEM())], staffId: '', distributorId: '9' })
    assert.equal(cart.load().distributorId, '9')
    store[cart.STORAGE_KEY] = { items: [Object.assign({ count: 1, key: 'a' }, ITEM())], staffId: '28' }
    const old = cart.load()
    assert.equal(old.staffId, '28')
    assert.equal(old.distributorId, undefined)
  } finally { delete global.wx }
})

function selectorEnv(t) {
  const store = {}
  const app = { loginPromiseNew: Promise.resolve(), globalData: { domainName: 't.test', entryRevision: 1 } }
  global.getApp = () => app
  global.wx = { getStorageSync: k => store[k], setStorageSync: (k, v) => { store[k] = v }, request() {}, navigateTo() {}, showToast() {} }
  t.after(() => { delete global.getApp; delete global.wx })
  return { store, app }
}

test('雪票选购页：扫分销商码进来记下分销商、清掉员工，进详情页带 distributorId；再扫员工码则反过来', async t => {
  const { store, app } = selectorEnv(t)
  store[cart.STORAGE_KEY] = { items: [Object.assign({ count: 1, key: 'a' }, ITEM())], staffId: '28' }
  const page = loadPage('pages/ski_pass/ski_pass_selector.js', {})
  page.onLoad({ scene: encodeURIComponent('d=9') })
  assert.equal(page.data.distributorId, '9')
  assert.equal(page.data.staffId, '')
  assert.equal(store[cart.STORAGE_KEY].distributorId, '9')
  assert.equal(store[cart.STORAGE_KEY].staffId, '')
  // 已打开的小程序再次扫员工码：本次入口覆盖
  app.globalData.skipassQrStaffId = '42'
  app.globalData.skipassQrDistributorId = ''
  app.globalData.entryRevision = 2
  page.onShow()
  assert.equal(page.data.staffId, '42')
  assert.equal(page.data.distributorId, '')
  assert.equal(store[cart.STORAGE_KEY].distributorId, undefined)
  // 再扫分销商码（同一次入口记录里分销商优先）
  app.globalData.skipassQrDistributorId = '11'
  app.globalData.entryRevision = 3
  page.onShow()
  assert.equal(page.data.distributorId, '11')
})

test('app：落在雪票选购页的冷启动按 scene 记下分销商码，并视为码入口（店员扫也不被送去管理员页）', () => {
  const fs = require('fs')
  const src = fs.readFileSync(require('path').join(__dirname, '../app.js'), 'utf8')
  assert.match(src, /skipassQrDistributorId = res\.path[^\n]*distributorFromOptions\(res\.query\)/)
  assert.match(src, /skipassQrDistributorId = res && res\.path[^\n]*distributorFromOptions\(res\.query\)/)
  assert.equal((src.match(/skipassQrEntry = !!\(this\.globalData\.skipassQrStaffId \|\| this\.globalData\.skipassQrDistributorId\)/g) || []).length, 2)
})

function customersEnv(t, handler) {
  const app = { loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk', requestPrefix: 'https://x/api/' } }
  const calls = { api: [], nav: [] }
  global.getApp = () => app
  global.wx = { navigateTo: o => calls.nav.push(o.url), stopPullDownRefresh() {}, showToast() {} }
  api.setTransport(options => {
    calls.api.push(options.url.replace('https://x/api/', ''))
    setImmediate(() => options.success({ statusCode: 200, data: handler(options.url) }))
  })
  t.after(() => { delete global.getApp; delete global.wx; api.setTransport(function (o) { wx.request(o) }) })
  return calls
}

test('我的顾客页：汇总、关系标签和点进订单；空列表给说明', async t => {
  const calls = customersEnv(t, () => ({ code: 0, message: '', data: {
    summary: { customers: 1, orders: 3, amount: 713.4 },
    customers: [
      { memberId: 3, name: '学员A', phoneTail: '1003', relation: 'mine', since: '2026-11-15T10:00:00', orderCount: 1, amount: 134.4, lastOrderDate: '2026-11-15T10:05:00' },
      { memberId: 4, name: '学员B', phoneTail: '1004', relation: 'other', orderCount: 2, amount: 270, lastOrderDate: null },
      { memberId: 5, name: '学员C', phoneTail: '1005', relation: 'none', orderCount: 1, amount: 309, lastOrderDate: '2026-11-16 08:00:00' }] } }))
  const page = loadPage('pages/distributor/customers/customers.js', {})
  await page.onLoad()
  await settle()
  assert.deepEqual(calls.api, ['Distributor/GetMyCustomers?sessionKey=sk'])
  assert.deepEqual(page.data.customers.map(c => c.tag.text), ['名下顾客', '他人顾客 · 仅本单', '尚未归属 · 仅本单'])
  assert.equal(page.data.customers[0].last, '2026-11-15')
  assert.equal(page.data.customers[1].last, '')
  assert.equal(page.data.summary.amount, 713.4)
  page.onCustomer({ currentTarget: { dataset: { id: 4 } } })
  assert.deepEqual(calls.nav, ['/pages/distributor/customer_orders/customer_orders?memberId=4'])

  const none = customersEnv(t, () => ({ code: 0, message: '', data: { summary: { customers: 0, orders: 0, amount: 0 }, customers: [] } }))
  const empty = loadPage('pages/distributor/customers/customers.js', {})
  await empty.onLoad(); await settle()
  assert.deepEqual(empty.data.customers, [])
  assert.equal(none.api.length, 1)
})

test('我的顾客页：服务端拒绝（不是分销商）时显示原因', async t => {
  customersEnv(t, () => ({ code: 3, message: '你还不是教练或机构' }))
  const page = loadPage('pages/distributor/customers/customers.js', {})
  await page.onLoad(); await settle()
  assert.equal(page.data.error, '你还不是教练或机构')
})

test('顾客订单页：逐单显示来源；缺 memberId 不请求', async t => {
  const calls = customersEnv(t, () => ({ code: 0, message: '', data: {
    customer: { memberId: 4, name: '学员B', phoneTail: '1004', orderCount: 2, amount: 270 },
    orders: [{ orderId: 1, date: '2026-11-15T09:00:00', type: '雪票', itemName: '日场', amount: 200, sources: ['雪票码'] },
      { orderId: 2, date: '2026-11-15T10:00:00', type: '养护', itemName: '单项 单板', amount: 70, sources: ['优惠券', '学员卡'] }] } }))
  const page = loadPage('pages/distributor/customer_orders/customer_orders.js', {})
  await page.onLoad({ memberId: '4' }); await settle()
  assert.deepEqual(calls.api, ['Distributor/GetCustomerOrders?sessionKey=sk&memberId=4'])
  assert.deepEqual(page.data.orders.map(o => o.from), ['雪票码', '优惠券、学员卡'])
  assert.equal(page.data.orders[0].day, '2026-11-15')
  const blank = loadPage('pages/distributor/customer_orders/customer_orders.js', {})
  await blank.onLoad({}); await settle()
  assert.equal(blank.data.error, '缺少顾客信息')
  assert.equal(calls.api.length, 1)
})

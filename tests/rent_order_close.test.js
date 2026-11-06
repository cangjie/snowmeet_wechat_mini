// 租赁订单详情页最下方的「订单关闭」按钮（2026-11-06 用户要求）：
// 订单全部退完押金，或无需退押金且全部租赁物已归还时才显示（后端算好 order.canManualClose）；
// 点击先提示「操作不可逆」，确认后调后端关单，成功后重新加载订单；后端记录关闭时间和操作的员工。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, settle } = require('./reception_harness.js')

const FILE = 'pages/admin/rent/rent_order_detail/rent_order_detail.js'
const WXML = fs.readFileSync(path.join(__dirname, '../pages/admin/rent/rent_order_detail/rent_order_detail.wxml'), 'utf8')

function setup(options = {}) {
  const calls = { close: [], modals: [], toasts: [], getData: 0 }
  const staff = options.staff === undefined ? { id: 28, title_level: 300 } : options.staff
  global.getApp = () => ({ globalData: { sessionKey: 'sk%20x', staff, uiProfile: {} }, loginPromiseNew: Promise.resolve() })
  global.wx = {
    showModal(o) { calls.modals.push(o); if (o.success) o.success({ confirm: options.confirm !== false }) },
    showToast(o) { calls.toasts.push(o.title) },
    showLoading() {}, hideLoading() {}
  }
  const fakeData = {
    closeRentOrderByStaffPromise(id, key) {
      calls.close.push([id, key])
      if (options.closePromise) return options.closePromise
      return options.closeFails ? Promise.reject('订单还不满足关闭条件') : Promise.resolve({ orderId: id })
    }
  }
  const page = loadPage(FILE, fakeData)
  page.setData({ id: 5 })
  page.getData = () => { calls.getData++ }
  return { page, calls }
}

function cleanup() {
  delete global.getApp
  delete global.wx
}

test('点「订单关闭」：先弹窗提示操作不可逆；取消就不请求、不重新加载', async t => {
  t.after(cleanup)
  const { page, calls } = setup({ confirm: false })
  page.onCloseOrder()
  await settle()
  assert.equal(calls.modals.length, 1)
  assert.match(calls.modals[0].content, /不可逆/)
  assert.deepEqual(calls.close, [])
  assert.equal(calls.getData, 0)
})

test('确认关闭：调一次关单接口（订单号、会话），成功提示后重新加载订单', async t => {
  t.after(cleanup)
  const { page, calls } = setup()
  page.onCloseOrder()
  await settle()
  assert.deepEqual(calls.close, [[5, 'sk%20x']])
  assert.deepEqual(calls.toasts, ['订单已关闭'])
  assert.equal(calls.getData, 1)
})

test('后端拒绝关单：不提示成功、不重新加载，按钮还能再点', async t => {
  t.after(cleanup)
  const { page, calls } = setup({ closeFails: true })
  page.onCloseOrder()
  await settle()
  assert.deepEqual(calls.toasts, [])
  assert.equal(calls.getData, 0)
  page.onCloseOrder()
  await settle()
  assert.equal(calls.close.length, 2)
})

test('关单请求还没回来时再点：不重复请求', async t => {
  t.after(cleanup)
  let finish
  const { page, calls } = setup({ closePromise: new Promise(resolve => { finish = resolve }) })
  page.onCloseOrder()
  page.onCloseOrder()
  await settle()
  assert.equal(calls.modals.length, 1)
  assert.equal(calls.close.length, 1)
  finish({ orderId: 5 })
  await settle()
  assert.equal(calls.getData, 1)
})

test('onShow：职级 100 及以上的员工才有关单权限（页面上的按钮据此显示）', async t => {
  t.after(cleanup)
  for (const [staff, expected] of [[{ id: 1, title_level: 100 }, true], [{ id: 1, title_level: 300 }, true], [{ id: 1, title_level: 50 }, false], [null, false]]) {
    const { page } = setup({ staff })
    page.onShow()
    await settle()
    assert.equal(page.data._canCloseOrder, expected, JSON.stringify(staff))
  }
})

test('页面最下方有「订单关闭」卡片：订单未关闭、后端说可以关、员工有权限才显示', () => {
  assert.match(WXML, /wx:if="\{\{order\.closed == 0 && order\.canManualClose && _canCloseOrder\}\}"/)
  assert.match(WXML, /bindtap="onCloseOrder"|bind:click="onCloseOrder"/)
  assert.ok(WXML.includes('订单关闭'))
})

test('「订单关闭」卡片排在「追加租赁商品」之后，是页面内容的最后一块', () => {
  const append = WXML.indexOf('追加租赁商品')
  const close = WXML.indexOf('onCloseOrder')
  const loading = WXML.indexOf('<view wx:else class="page-loading">')
  assert.ok(append > 0 && close > append && loading > close)
})

test('data.js：关单接口是 POST Rent/CloseOrderByStaff/{订单号}，带会话', async t => {
  const requests = []
  global.getApp = () => ({ globalData: { requestPrefix: 'https://api.test/api/', domainName: 'api.test', sessionKey: 'sk' } })
  global.wx = {
    request(o) { requests.push(o); o.success({ statusCode: 200, data: { code: 0, message: '', data: { orderId: 5 } } }) },
    showToast() {}
  }
  t.after(() => { cleanup(); delete require.cache[require.resolve('../utils/data.js')] })
  delete require.cache[require.resolve('../utils/data.js')]
  const data = require('../utils/data.js')
  const result = await data.closeRentOrderByStaffPromise(5, 'sk%20x')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[0].url, 'https://api.test/api/Rent/CloseOrderByStaff/5?sessionKey=sk%20x')
  assert.deepEqual(result, { orderId: 5 })
})

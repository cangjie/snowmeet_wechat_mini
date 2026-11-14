// 租赁开单后顾客看到的支付页（pages/order/payment_entry）。2026-11-14 用户要求：
//   1) 不管是店员开单后顾客手机自动跳转（autoPay=1），还是顾客再次扫码进来，租赁单都不默认调起微信支付，
//      要让顾客先看清租赁商品、租赁物和押金租金，自己点「敬请支付」；
//   2) 租赁物默认展开；每件租赁物第一行是品类，第二行是编码 + 名称（同一行）。
// 其它业务（养护、零售…）的自动支付照旧。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, settle } = require('./reception_harness.js')

const FILE = 'pages/order/payment_entry.js'
const WXML = fs.readFileSync(path.join(__dirname, '../pages/order/payment_entry.wxml'), 'utf8')

function order(type) {
  return {
    id: 1, type, shop: '万龙服务中心', code: 'WT_ZL_261114_00001', biz_date: '2026-11-14T10:00:00',
    payments: [{ id: 43070, status: '待支付', valid: 1, pay_method: '微信支付', amount: 3000 }],
    rentals: type === '租赁' ? [{
      id: 5, name: '中级双板套餐', guaranty: 3000, pricePresets: [{ price: 260, discount: 0 }],
      rentItems: [
        { id: 1, code: 'B-001', name: '全能 170', class_name: '双板' },
        { id: 2, code: '', name: '雪杖', class_name: '雪杖' },
      ],
    }] : [],
    cares: [],
  }
}

function setup(bizType, { autoPay = true } = {}) {
  global.getApp = () => ({
    loginPromiseNew: Promise.resolve(),
    globalData: { sessionKey: 'sk%20x', member: { id: 41275, wechatMiniOpenId: 'openid-x' } }
  })
  global.wx = { showToast() {}, showLoading() {}, hideLoading() {} }
  const calls = { pay: 0 }
  const fakeData = {
    getOrderFromPaymentByCustomer() { return Promise.resolve(order(bizType)) },
    checkPayerIdentityPromise() { return Promise.resolve({ status: 'direct' }) },
  }
  const page = loadPage(FILE, fakeData)
  page.pay = () => { calls.pay++ }
  page.onLoad(autoPay ? { paymentId: '43070', autoPay: '1' } : { paymentId: '43070' })
  return { page, calls }
}

function cleanup() {
  delete global.getApp
  delete global.wx
}

test('租赁单：店员开单后顾客手机自动跳来（autoPay=1），不自动调起微信支付', async t => {
  t.after(cleanup)
  const { page, calls } = setup('租赁')
  page.onShow()
  await settle()
  assert.equal(page.data.identity.status, 'direct')
  assert.equal(page.data.order.type, '租赁')
  assert.equal(calls.pay, 0, '要让顾客先看订单信息，自己点支付')
  assert.equal(page.data.payment.status, '待支付', '「敬请支付」按钮的显示条件仍然满足')
})

test('租赁单：顾客再次扫码进来（没有 autoPay）也不会自动支付', async t => {
  t.after(cleanup)
  const { page, calls } = setup('租赁', { autoPay: false })
  page.onShow()
  await settle()
  assert.equal(calls.pay, 0)
})

test('养护单：autoPay=1 照旧自动调起支付，只调一次', async t => {
  t.after(cleanup)
  const { page, calls } = setup('养护')
  page.onShow()
  await settle()
  assert.equal(calls.pay, 1)
  // 支付弹窗关掉后页面再显示：不能再弹一遍
  page.onShow()
  await settle()
  assert.equal(calls.pay, 1)
})

test('租赁单：身份确认完成（onIdentityRefreshed）后也不自动支付；养护单照旧', async t => {
  t.after(cleanup)
  for (const [type, want] of [['租赁', 0], ['养护', 1]]) {
    const { page, calls } = setup(type, { autoPay: false })
    page.onShow()
    await settle()
    calls.pay = 0
    page.onIdentityRefreshed({ detail: { result: { status: 'direct' } } })
    await settle()
    assert.equal(calls.pay, want, type)
    assert.equal(page.data.identity.status, 'direct', type)
  }
})

test('租赁物默认展开，点标题行可以收起', async t => {
  t.after(cleanup)
  const { page } = setup('租赁', { autoPay: false })
  page.onShow()
  await settle()
  assert.equal(page.data.order.rentals[0].expanded, true)
  page.toggleRental({ currentTarget: { dataset: { index: 0 } } })
  assert.equal(page.data.order.rentals[0].expanded, false)
})

test('每件租赁物：品类在上，编码和名称同一行', () => {
  const block = WXML.slice(WXML.indexOf('class="item-row"'), WXML.indexOf('养护内容'))
  const category = block.indexOf('item-category')
  const main = block.indexOf('item-main')
  const code = block.indexOf('item-code')
  const name = block.indexOf('item-name')
  assert.ok(category >= 0 && main > category, '品类行在编码名称行上面')
  assert.ok(code > main && name > code, '编码和名称都在同一个 item-main 行里')
  assert.equal(block.split('item-main').length - 1, 1, '一件租赁物只有一个编码名称行')
  assert.ok(!/<text class="label">(编码|名称|品类)<\/text>/.test(block), '不再是三行带标签的写法')
})

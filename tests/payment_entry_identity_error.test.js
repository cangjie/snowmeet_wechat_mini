// 顾客扫付款二维码（pages/order/payment_entry）：二维码对应的付款已被店员重新出码作废时，
// 以前页面把后端的「支付记录不存在」统一改写成「身份验证查询失败，请重试」，顾客以为是身份有问题；
// 现在明确提示「二维码已失效，请让店员重新出码」，真正的网络/接口失败才保留「身份验证查询失败」。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, settle } = require('./reception_harness.js')

const FILE = 'pages/order/payment_entry.js'
const WXML = fs.readFileSync(path.join(__dirname, '../pages/order/payment_entry.wxml'), 'utf8')

function setup(identityResult) {
  global.getApp = () => ({
    loginPromiseNew: Promise.resolve(),
    globalData: { sessionKey: 'sk%20x', member: { id: 41275, wechatMiniOpenId: 'openid-x' } }
  })
  global.wx = { showToast() {}, showLoading() {}, hideLoading() {} }
  const calls = { checks: 0 }
  const fakeData = {
    getOrderFromPaymentByCustomer() { return Promise.reject('没有找到') },
    checkPayerIdentityPromise() {
      calls.checks++
      return identityResult.reject ? Promise.reject(identityResult.reject) : Promise.resolve(identityResult.ok)
    }
  }
  const page = loadPage(FILE, fakeData)
  page.onLoad({ paymentId: '43070' })
  return { page, calls }
}

function cleanup() {
  delete global.getApp
  delete global.wx
}

test('付款已作废（支付记录不存在）：提示二维码已失效，请让店员重新出码', async t => {
  t.after(cleanup)
  const { page } = setup({ reject: '支付记录不存在' })
  page.onShow()
  await settle()
  assert.equal(page.data.identity.status, 'error')
  assert.equal(page.data.identity.errorMessage, '二维码已失效，请让店员重新出码')
})

test('订单已支付或已取消：照后端的话提示，不改写成身份验证失败', async t => {
  t.after(cleanup)
  const { page } = setup({ reject: '订单已支付或已取消' })
  page.onShow()
  await settle()
  assert.equal(page.data.identity.status, 'error')
  assert.equal(page.data.identity.errorMessage, '订单已支付或已取消')
})

test('网络或接口本身失败（没有后端文字）：仍提示身份验证查询失败，请重试', async t => {
  t.after(cleanup)
  for (const reason of [{}, 502, undefined, '']) {
    const { page } = setup({ reject: reason })
    page.onShow()
    await settle()
    assert.equal(page.data.identity.status, 'error', JSON.stringify(reason))
    assert.equal(page.data.identity.errorMessage, '身份验证查询失败，请重试', JSON.stringify(reason))
  }
})

test('正常的身份核验结果不受影响', async t => {
  t.after(cleanup)
  const { page } = setup({ ok: { status: 'choose_identity', orderMemberMaskedCell: '189****2780' } })
  page.onShow()
  await settle()
  assert.equal(page.data.identity.status, 'choose_identity')
})

test('订单拉不到又是错误状态时，不再显示自相矛盾的「仍可继续支付」', () => {
  const line = WXML.split('\n').find(l => l.includes('仍可继续支付'))
  assert.ok(line, '页面里应还有这句提示（身份正常但订单拉不到时用）')
  assert.match(line, /wx:if="\{\{!\(identity && identity\.status === 'error'\)\}\}"/)
})

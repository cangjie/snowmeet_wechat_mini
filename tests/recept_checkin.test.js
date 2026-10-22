// 顾客扫码报到页（pages/order/recept_checkin）：验证手机号 → 等待开单 → 微信支付自动跳付款页 / 支付宝只提示
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle } = require('./reception_harness.js')

const PAGE = 'pages/order/recept_checkin.js'
const CODE = 'rc_abcdefghij_9'
const Q = encodeURIComponent('https://mini.snowmeet.top/mapp/recept_checkin?code=' + CODE)

function setup(fake) {
  const calls = { scan: [], verify: [], poll: 0 }
  const redirects = []
  const toasts = []
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk' } })
  global.wx = {
    redirectTo(o) { redirects.push(o.url) },
    showToast(o) { toasts.push(o.title) },
    showLoading() {},
    hideLoading() {}
  }
  const fakeData = {
    scanReceptCheckinPromise(code) { calls.scan.push(code); return fake.scan() },
    verifyReceptCheckinPhonePromise(code, encData, iv) { calls.verify.push([code, encData, iv]); return fake.verify() },
    getReceptCheckinByCustomerPromise() { calls.poll++; return Promise.resolve(fake.poll()) }
  }
  const page = loadPage(PAGE, fakeData)
  page.onLoad({ q: Q })
  return { page, calls, redirects, toasts }
}

function cleanup(page) {
  page._stopPolling()
  delete global.getApp
  delete global.wx
}

test('新顾客验证手机号后等待，店员选微信支付就跳付款页并自动支付', async () => {
  const { page, calls, redirects } = setup({
    scan: () => Promise.resolve({ stage: 'need_phone' }),
    verify: () => Promise.resolve({ stage: 'waiting', maskedCell: '138****8000' }),
    poll: () => ({ code: 0, data: { stage: 'wepay', paymentId: 77 } })
  })
  assert.equal(page.data.code, CODE)
  page.onShow()
  await settle()
  assert.deepEqual(calls.scan, [CODE])
  assert.equal(page.data.state, 'need_phone')

  page.onGetPhoneNumber({ detail: { errMsg: 'getPhoneNumber:ok', encryptedData: 'enc', iv: 'iv' } })
  await settle()
  assert.deepEqual(calls.verify, [[CODE, 'enc', 'iv']])
  assert.equal(page.data.state, 'waiting')
  assert.equal(page.data.maskedCell, '138****8000')
  assert.notEqual(page._pollTimer, null)

  page.poll()
  await settle()
  assert.deepEqual(redirects, ['/pages/order/payment_entry?paymentId=77&autoPay=1'])
  assert.equal(page._pollTimer, null)
  // 跳走之后再轮询 / 回到前台都不会重复跳转
  page.poll()
  page.onShow()
  await settle()
  assert.equal(redirects.length, 1)
  cleanup(page)
})

test('已有手机号的会员扫码直接进入等待', async () => {
  const { page } = setup({
    scan: () => Promise.resolve({ stage: 'waiting', maskedCell: '139****9000' }),
    verify: () => Promise.reject(new Error('不应验证')),
    poll: () => ({ code: 0, data: { stage: 'waiting' } })
  })
  page.onShow()
  await settle()
  assert.equal(page.data.state, 'waiting')
  assert.notEqual(page._pollTimer, null)
  cleanup(page)
})

test('拒绝授权手机号时停在验证步骤并说明原因', async () => {
  const { page, calls, toasts } = setup({
    scan: () => Promise.resolve({ stage: 'need_phone' }),
    verify: () => Promise.resolve({ stage: 'waiting' }),
    poll: () => null
  })
  page.onShow()
  await settle()
  page.onGetPhoneNumber({ detail: { errMsg: 'getPhoneNumber:fail user deny' } })
  assert.deepEqual(calls.verify, [])
  assert.deepEqual(toasts, ['验证手机号后，店员才能为您开单'])
  assert.equal(page.data.state, 'need_phone')
  cleanup(page)
})

test('店员选支付宝时只提示扫支付宝码，并继续等店员改回微信', async () => {
  let stage = 'alipay'
  const { page, redirects } = setup({
    scan: () => Promise.resolve({ stage: 'waiting' }),
    verify: () => Promise.resolve({}),
    poll: () => ({ code: 0, data: { stage, paymentId: 80 } })
  })
  page.onShow()
  await settle()
  page.poll()
  await settle()
  assert.equal(page.data.state, 'alipay')
  assert.notEqual(page._pollTimer, null)
  assert.deepEqual(redirects, [])
  stage = 'wepay'
  page.poll()
  await settle()
  assert.deepEqual(redirects, ['/pages/order/payment_entry?paymentId=80&autoPay=1'])
  cleanup(page)
})

test('码被别人用过或已失效时显示原因，轮询报错也停下', async () => {
  const { page } = setup({
    scan: () => Promise.reject('这个二维码已被其他顾客使用，请让店员换一个码'),
    verify: () => Promise.resolve({}),
    poll: () => ({ code: 1, message: '请重新扫描店员手机上的二维码' })
  })
  page.onShow()
  await settle()
  assert.equal(page.data.state, 'error')
  assert.equal(page.data.message, '这个二维码已被其他顾客使用，请让店员换一个码')

  page._startPolling()
  page.poll()
  await settle()
  assert.equal(page.data.message, '请重新扫描店员手机上的二维码')
  assert.equal(page._pollTimer, null)
  cleanup(page)
})

test('等待超时停止轮询，刷新再查一次', async () => {
  let scans = 0
  const { page } = setup({
    scan: () => { scans++; return Promise.resolve({ stage: 'expired' }) },
    verify: () => Promise.resolve({}),
    poll: () => null
  })
  page.onShow()
  await settle()
  assert.equal(page.data.state, 'expired')
  assert.equal(page._pollTimer, null)
  page.onRetryTap()
  await settle()
  assert.equal(scans, 2)
  cleanup(page)
})

// 顾客扫码取板验证页（pages/order/care_pick_verify）：本人通过 / 非本人提示 / 新微信号先授权手机号
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle } = require('./reception_harness.js')

const PAGE = 'pages/order/care_pick_verify.js'
const CODE = 'cp_abcdefghij_25693_801'
const Q = encodeURIComponent('https://mini.snowmeet.top/mapp/care_pick?code=' + CODE)

function setup(verify, bind) {
  const calls = { verify: [], bind: [] }
  const toasts = []
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk' } })
  global.wx = { showToast(o) { toasts.push(o.title) }, showLoading() {}, hideLoading() {} }
  const fakeData = {
    verifyCarePickPromise(code) { calls.verify.push(code); return verify() },
    bindWechatCellPromise(encData, iv) { calls.bind.push([encData, iv]); return bind ? bind() : Promise.resolve({ id: 7 }) }
  }
  const page = loadPage(PAGE, fakeData)
  return { page, calls, toasts }
}

function cleanup() {
  delete global.getApp
  delete global.wx
}

test('扫码人是下单会员：显示取板验证成功', async () => {
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }))
  page.onLoad({ q: Q })
  await settle()
  assert.deepEqual(calls.verify, [CODE])
  assert.equal(page.data.state, 'matched')
  cleanup()
})

test('不是下单人：提示用下单人的微信扫码，并带上打码手机号', async () => {
  const { page } = setup(() => Promise.resolve({ stage: 'mismatch', orderMemberMaskedCell: '138****8000' }))
  page.onLoad({ q: Q })
  await settle()
  assert.equal(page.data.state, 'mismatch')
  assert.equal(page.data.maskedCell, '138****8000')
  cleanup()
})

test('新微信号没有会员身份：授权手机号绑定后再验证', async () => {
  let stage = 'need_member'
  const { page, calls, toasts } = setup(() => Promise.resolve({ stage }))
  page.onLoad({ q: Q })
  await settle()
  assert.equal(page.data.state, 'bind_cell')

  page.onBindCell({ detail: { errMsg: 'getPhoneNumber:fail user deny' } })
  assert.deepEqual(toasts, ['未授权手机号'])
  assert.deepEqual(calls.bind, [])

  stage = 'matched'
  page.onBindCell({ detail: { errMsg: 'getPhoneNumber:ok', encryptedData: 'enc', iv: 'iv' } })
  await settle()
  assert.deepEqual(calls.bind, [['enc', 'iv']])
  assert.deepEqual(calls.verify, [CODE, CODE])
  assert.equal(page.data.state, 'matched')
  cleanup()
})

test('码失效或被别人扫过：显示原因，可重试', async () => {
  const { page, calls } = setup(() => Promise.reject('二维码已过期，请让店员换一个码'))
  page.onLoad({ q: Q })
  await settle()
  assert.equal(page.data.state, 'error')
  assert.equal(page.data.message, '二维码已过期，请让店员换一个码')
  page.onRetryTap()
  await settle()
  assert.equal(calls.verify.length, 2)
  cleanup()
})

test('没有带码打开：直接提示重新扫码', () => {
  const { page, calls } = setup(() => Promise.resolve({ stage: 'matched' }))
  page.onLoad({})
  assert.equal(page.data.state, 'error')
  assert.deepEqual(calls.verify, [])
  cleanup()
})

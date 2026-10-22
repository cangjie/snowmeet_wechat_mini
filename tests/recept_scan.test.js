// 扫码接待入口（pages/admin/reception/recept_scan）：出码、有人扫码就跳顾客信息页、散客进入、码过期换新、手动录入链接
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle, tap } = require('./reception_harness.js')

const PAGE = 'pages/admin/reception/recept_scan.js'

function setup(pollResult, queryCell) {
  const calls = { create: 0, poll: [], stop: [], recoverShop: [], queryCell: [] }
  const nav = []
  const toasts = []
  let nextId = 5
  global.getApp = () => ({
    loginPromiseNew: Promise.resolve(),
    globalData: { sessionKey: 'sk', requestPrefix: 'https://api.example/api/' }
  })
  global.wx = {
    navigateTo(o) { nav.push(o.url) },
    showToast(o) { toasts.push(o.title) }
  }
  const fakeData = {
    createReceptCheckinByStaffPromise() {
      calls.create++
      const id = nextId++
      return Promise.resolve({ id, code: 'rc_abcdefghij_' + id, qrText: 'https://mini.snowmeet.top/mapp/recept_checkin?code=rc_abcdefghij_' + id, stage: 'waiting_scan' })
    },
    getReceptCheckinByStaffPromise(id) {
      calls.poll.push(id)
      return Promise.resolve(pollResult ? pollResult() : { code: 0, data: { stage: 'waiting_scan' } })
    },
    stopScanQrCodePromise(id) { calls.stop.push(id); return Promise.resolve() },
    queryReceptCellPromise(id, cell) { calls.queryCell.push([id, cell]); return queryCell ? queryCell(id, cell) : Promise.reject('用户不存在') },
    getRentReceptingOrdersPromise(shop) {
      calls.recoverShop.push(shop)
      return Promise.resolve([{ id: 88, contact_name: '张三', contact_gender: '男', contact_num: '13800138000', biz_date: '2026-10-22T10:00:00' }])
    }
  }
  const page = loadPage(PAGE, fakeData)
  page.onLoad()
  return { page, calls, nav, toasts }
}

function cleanup(page) {
  page._stopPolling()
  delete global.getApp
  delete global.wx
}

test('出码后新顾客扫码，跳到顾客信息页等授权；回到本页重新出码', async () => {
  const { page, calls, nav } = setup(() => ({ code: 0, data: { stage: 'need_phone' } }))
  page.onShow()
  await settle()
  assert.equal(calls.create, 1)
  assert.match(page.data.qrCodeUrl, /MediaHelper\/GetQRCode\?qrCodeText=https%3A%2F%2Fmini\.snowmeet\.top%2Fmapp%2Frecept_checkin%3Fcode%3Drc_abcdefghij_5/)
  assert.equal(page.data.stageText, '请顾客用微信扫码')

  page.pollCheckin()
  await settle()
  assert.deepEqual(nav, ['/pages/admin/reception/recept_member?checkinId=5&stage=need_phone'])
  assert.equal(page.data.checkin, null)
  assert.equal(page._pollTimer, null)
  // 已扫的码交给顾客信息页，不作废
  assert.deepEqual(calls.stop, [])

  page.onHide()
  page.onShow()
  await settle()
  assert.equal(calls.create, 2)
  assert.equal(page.data.checkin.id, 6)
  cleanup(page)
})

test('老顾客扫码直接跳顾客信息页显示会员信息', async () => {
  const { page, nav } = setup(() => ({ code: 0, data: { stage: 'verified', memberId: 42 } }))
  page.onShow()
  await settle()
  page.pollCheckin()
  await settle()
  assert.deepEqual(nav, ['/pages/admin/reception/recept_member?checkinId=5&stage=verified'])
  cleanup(page)
})

test('散客进入：作废没用上的码，进顾客信息页的散客模式', async () => {
  const { page, calls, nav } = setup()
  page.onShow()
  await settle()
  page.onWalkInTap()
  assert.deepEqual(nav, ['/pages/admin/reception/recept_member?walkin=1'])
  assert.deepEqual(calls.stop, [5])
  assert.equal(page.data.checkin, null)
  assert.equal(page._pollTimer, null)
  cleanup(page)
})

test('码过期自动换新，旧码作废', async () => {
  let first = true
  const { page, calls } = setup(() => {
    if (first) { first = false; return { code: 0, data: { stage: 'expired' } } }
    return { code: 0, data: { stage: 'waiting_scan' } }
  })
  page.onShow()
  await settle()
  page.pollCheckin()
  await settle()
  assert.equal(calls.create, 2)
  assert.deepEqual(calls.stop, [5])
  assert.equal(page.data.checkin.id, 6)
  cleanup(page)
})

test('切到后台只暂停轮询不作废码，离开页面才作废', async () => {
  const { page, calls } = setup()
  page.onShow()
  await settle()
  assert.notEqual(page._pollTimer, null)
  page.onHide()
  assert.equal(page._pollTimer, null)
  assert.deepEqual(calls.stop, [])
  page.onShow()
  await settle()
  assert.equal(calls.create, 1)
  assert.notEqual(page._pollTimer, null)
  page.onUnload()
  assert.equal(page._pollTimer, null)
  assert.deepEqual(calls.stop, [5])
  cleanup(page)
})

test('找回今天所有店铺中断的订单，按单子上的店铺恢复', async () => {
  const { page, calls, nav } = setup()
  page.onRecoverOrder()
  await settle()
  assert.deepEqual(calls.recoverShop, [null])
  assert.equal(page.data.recoverOrders[0].calledName, '张三 先生')
  page.onRecoverOrderTap(tap({ id: 88 }))
  assert.deepEqual(nav, ['/pages/admin/reception/recept_new?orderId=88&bizType=rent'])
  cleanup(page)
})

test('店长输会员手机号直接通过，进入顾客信息页', async () => {
  const { page, calls, nav, toasts } = setup(null, () => Promise.resolve({ id: 5, authed: 1 }))
  page.onShow()
  await settle()
  page.onCellInput({ detail: { value: ' 13800138000 ' } })
  page.onSubmitCell()
  await settle()
  assert.deepEqual(calls.queryCell, [[5, '13800138000']])
  assert.deepEqual(nav, ['/pages/admin/reception/recept_member?checkinId=5&stage=phone_authed'])
  assert.equal(page.data.checkin, null)
  assert.deepEqual(toasts, [])
  cleanup(page)
})

test('普通店员输手机号要等店长授权，授权后进入顾客信息页', async () => {
  let stage = { stage: 'need_auth', name: '张三', maskedCell: '138****8000' }
  const { page, nav, toasts } = setup(() => ({ code: 0, data: stage }), () => Promise.resolve({ id: 5, authed: 0 }))
  page.onShow()
  await settle()
  page.onCellInput({ detail: { value: '13800138000' } })
  page.onSubmitCell()
  await settle()
  assert.equal(page.data.waitingAuth, true)
  assert.match(page.data.authText, /138\*\*\*\*8000/)
  assert.deepEqual(toasts, ['需要店长授权'])
  assert.notEqual(page._pollTimer, null)

  page.pollCheckin()
  await settle()
  assert.match(page.data.authText, /张三 138\*\*\*\*8000/)
  assert.deepEqual(nav, [])

  stage = { stage: 'phone_authed', memberId: 42 }
  page.pollCheckin()
  await settle()
  assert.deepEqual(nav, ['/pages/admin/reception/recept_member?checkinId=5&stage=phone_authed'])
  assert.equal(page.data.waitingAuth, false)
  cleanup(page)
})

test('不等授权了：作废这次提交，重新出码', async () => {
  const { page, calls } = setup(() => ({ code: 0, data: { stage: 'need_auth' } }), () => Promise.resolve({ id: 5, authed: 0 }))
  page.onShow()
  await settle()
  page.onCellInput({ detail: { value: '13800138000' } })
  page.onSubmitCell()
  await settle()
  page.onCancelAuthTap()
  await settle()
  assert.deepEqual(calls.stop, [5])
  assert.equal(page.data.waitingAuth, false)
  assert.equal(page.data.cell, '')
  assert.equal(page.data.checkin.id, 6)
  cleanup(page)
})

test('手机号不完整不提交；不是会员时停在本页', async () => {
  const { page, calls, nav, toasts } = setup()
  page.onShow()
  await settle()
  page.onCellInput({ detail: { value: '13800' } })
  page.onSubmitCell()
  assert.deepEqual(toasts, ['请输入完整手机号'])
  assert.deepEqual(calls.queryCell, [])

  page.onCellInput({ detail: { value: '13900139000' } })
  page.onSubmitCell()
  await settle()
  assert.deepEqual(calls.queryCell, [[5, '13900139000']])
  assert.equal(page.data.waitingAuth, false)
  assert.deepEqual(nav, [])
  cleanup(page)
})

test('底部链接进入手动录入入口', () => {
  const { page, nav } = setup()
  page.onManualEntryTap()
  assert.deepEqual(nav, ['/pages/admin/reception/recept_entry'])
  cleanup(page)
})

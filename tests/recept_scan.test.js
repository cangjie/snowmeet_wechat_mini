// 扫码接待入口（pages/admin/reception/recept_scan）：出码、有人扫码就跳顾客信息页、散客进入、码过期换新、手动录入链接
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle, tap } = require('./reception_harness.js')

const PAGE = 'pages/admin/reception/recept_scan.js'

function setup(pollResult) {
  const calls = { create: 0, poll: [], stop: [], recoverShop: [] }
  const nav = []
  let nextId = 5
  global.getApp = () => ({
    loginPromiseNew: Promise.resolve(),
    globalData: { sessionKey: 'sk', requestPrefix: 'https://api.example/api/' }
  })
  global.wx = {
    navigateTo(o) { nav.push(o.url) },
    showToast(o) { throw new Error('不应提示：' + o.title) }
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
    getRentReceptingOrdersPromise(shop) {
      calls.recoverShop.push(shop)
      return Promise.resolve([{ id: 88, contact_name: '张三', contact_gender: '男', contact_num: '13800138000', biz_date: '2026-10-22T10:00:00' }])
    }
  }
  const page = loadPage(PAGE, fakeData)
  page.onLoad()
  return { page, calls, nav }
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

test('底部链接进入手动录入入口', () => {
  const { page, nav } = setup()
  page.onManualEntryTap()
  assert.deepEqual(nav, ['/pages/admin/reception/recept_entry'])
  cleanup(page)
})

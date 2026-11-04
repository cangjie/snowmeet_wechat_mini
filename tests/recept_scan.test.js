// 扫码接待入口（pages/admin/reception/recept_scan）：出码、有人扫码就跳顾客信息页、散客进入、码过期换新、手动录入链接
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle, tap } = require('./reception_harness.js')

const PAGE = 'pages/admin/reception/recept_scan.js'

// enterByPhone：服务器一次建好接待记录、写手机号、判授权的返回（QrCode/EnterReceptByPhone），不设置就是「用户不存在」
// navFail：模拟 wx.navigateTo 没跳成功（调用 fail 回调），页面不能因此停在空白页
// slowCreate：出码请求一直不返回，直到 releaseCreate()，模拟「二维码还没出来」
function setup(pollResult, enterByPhone, { navFail = false, slowCreate = false } = {}) {
  const calls = { create: 0, poll: [], stop: [], recoverShop: [], enter: [] }
  const nav = []
  const toasts = []
  const pendingCreates = []
  let nextId = 5
  global.getApp = () => ({
    loginPromiseNew: Promise.resolve(),
    globalData: { sessionKey: 'sk', requestPrefix: 'https://api.example/api/' }
  })
  global.wx = {
    navigateTo(o) {
      nav.push(o.url)
      if (navFail && o.fail) o.fail({ errMsg: 'navigateTo:fail' })
    },
    showToast(o) { toasts.push(o.title) }
  }
  const fakeData = {
    createReceptCheckinByStaffPromise() {
      calls.create++
      const id = nextId++
      const checkin = { id, code: 'rc_abcdefghij_' + id, qrText: 'https://mini.snowmeet.top/mapp/recept_checkin?code=rc_abcdefghij_' + id, stage: 'waiting_scan' }
      if (!slowCreate) return Promise.resolve(checkin)
      return new Promise(resolve => pendingCreates.push(() => resolve(checkin)))
    },
    getReceptCheckinByStaffPromise(id) {
      calls.poll.push(id)
      return Promise.resolve(pollResult ? pollResult() : { code: 0, data: { stage: 'waiting_scan' } })
    },
    stopScanQrCodePromise(id) { calls.stop.push(id); return Promise.resolve() },
    enterReceptByPhonePromise(cell) { calls.enter.push(cell); return enterByPhone ? enterByPhone(cell) : Promise.reject('用户不存在') },
    getRentReceptingOrdersPromise(shop) {
      calls.recoverShop.push(shop)
      return Promise.resolve([{ id: 88, contact_name: '张三', contact_gender: '男', contact_num: '13800138000', biz_date: '2026-10-22T10:00:00' }])
    }
  }
  const page = loadPage(PAGE, fakeData)
  page.onLoad()
  return { page, calls, nav, toasts, releaseCreate: () => pendingCreates.splice(0).forEach(resolve => resolve()) }
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
  const { page, calls, nav, toasts } = setup(null, () => Promise.resolve({ id: 50, stage: 'phone_authed', memberId: 42 }))
  page.onShow()
  await settle()
  page.onCellInput({ detail: { value: ' 13800138000 ' } })
  page.onSubmitCell()
  await settle()
  assert.deepEqual(calls.enter, ['13800138000'])
  assert.deepEqual(nav, ['/pages/admin/reception/recept_member?checkinId=50&stage=phone_authed'])
  assert.equal(page.data.checkin, null)
  // 页面上没人扫的那张二维码作废，免得过后有人扫到、一直等不到开单
  assert.deepEqual(calls.stop, [5])
  assert.deepEqual(toasts, [])
  cleanup(page)
})

test('普通店员输手机号要等店长授权，授权后进入顾客信息页', async () => {
  let stage = { stage: 'need_auth', name: '张三', maskedCell: '138****8000' }
  const { page, calls, nav, toasts } = setup(() => ({ code: 0, data: stage }),
    () => Promise.resolve({ id: 50, stage: 'need_auth', name: '张三', maskedCell: '138****8000' }))
  page.onShow()
  await settle()
  page.onCellInput({ detail: { value: '13800138000' } })
  page.onSubmitCell()
  await settle()
  assert.equal(page.data.waitingAuth, true)
  assert.match(page.data.authText, /张三 138\*\*\*\*8000/)
  assert.deepEqual(toasts, ['需要店长授权'])
  assert.notEqual(page._pollTimer, null)
  // 之后轮询、授权后跳转的都是手机号这条记录；页面上原来那张二维码作废
  assert.equal(page.data.checkin.id, 50)
  assert.deepEqual(calls.stop, [5])

  page.pollCheckin()
  await settle()
  assert.equal(calls.poll[calls.poll.length - 1], 50)
  assert.deepEqual(nav, [])

  stage = { stage: 'phone_authed', memberId: 42 }
  page.pollCheckin()
  await settle()
  assert.deepEqual(nav, ['/pages/admin/reception/recept_member?checkinId=50&stage=phone_authed'])
  assert.equal(page.data.waitingAuth, false)
  cleanup(page)
})

// 11-03 12:41～12:43 杨兴的手机：输号码放行后页面已清空，顾客信息页却没打开，只剩空白二维码框，再点确认只弹「二维码还没生成好」
test('放行后跳顾客信息页没成功：不停在空白页，自动重新出码并提示再输一次手机号', async () => {
  const { page, calls, nav, toasts } = setup(null, () => Promise.resolve({ id: 50, stage: 'phone_authed' }), { navFail: true })
  page.onShow()
  await settle()
  page.onCellInput({ detail: { value: '13800138000' } })
  page.onSubmitCell()
  await settle()
  assert.deepEqual(nav, ['/pages/admin/reception/recept_member?checkinId=50&stage=phone_authed'])
  assert.deepEqual(toasts, ['打开顾客信息页没成功，已重新出码，请再输入手机号'])
  assert.equal(calls.create, 2)
  assert.equal(page.data.checkin.id, 6)
  assert.match(page.data.qrCodeUrl, /rc_abcdefghij_6/)
  assert.notEqual(page._pollTimer, null)
  cleanup(page)
})

// 手机号进入不依赖页面上的二维码：服务器一次建好接待记录，页面是空白的、二维码还没出来，都不影响
test('页面是空白的（没有二维码、也没在出码）时，手机号照样直接进入，不弹任何提示', async () => {
  const { page, calls, nav, toasts } = setup(null, () => Promise.resolve({ id: 50, stage: 'phone_authed' }))
  page.onShow()
  await settle()
  page._stopPolling()
  page.setData({ checkin: null, qrCodeUrl: '', stageText: '' })
  page.onCellInput({ detail: { value: '13800138000' } })
  page.onSubmitCell()
  await settle()
  assert.deepEqual(toasts, [])
  assert.deepEqual(calls.enter, ['13800138000'])
  assert.deepEqual(nav, ['/pages/admin/reception/recept_member?checkinId=50&stage=phone_authed'])
  cleanup(page)
})

test('二维码还在生成时就输手机号：不用等；后来才生成好的码直接作废，页面不受影响', async () => {
  const { page, calls, toasts, releaseCreate } = setup(null,
    () => Promise.resolve({ id: 50, stage: 'need_auth', name: '张三', maskedCell: '138****8000' }), { slowCreate: true })
  page.onShow()                                  // 出码请求还没返回
  page.onCellInput({ detail: { value: '13800138000' } })
  page.onSubmitCell()
  await settle()
  assert.deepEqual(toasts, ['需要店长授权'])
  assert.equal(page.data.waitingAuth, true)
  assert.equal(page.data.checkin.id, 50)
  assert.equal(page.data.loadingQr, false)

  releaseCreate()
  await settle()
  assert.deepEqual(calls.stop, [5])              // 迟到的二维码作废了
  assert.equal(page.data.checkin.id, 50)         // 没有顶掉手机号这条记录
  assert.equal(page.data.qrCodeUrl, '')
  assert.equal(page.data.waitingAuth, true)
  assert.equal(calls.create, 1)
  cleanup(page)
})

test('手机号进入后回到本页，重新出码不被还没返回的旧请求挡住', async () => {
  const { page, calls, releaseCreate } = setup(null, () => Promise.resolve({ id: 50, stage: 'phone_authed' }), { slowCreate: true })
  page.onShow()                                  // 第一次出码，一直没返回
  page.onCellInput({ detail: { value: '13800138000' } })
  page.onSubmitCell()
  await settle()
  page.onHide()
  page.onShow()                                  // 从顾客信息页回来，要重新出码
  await settle()
  assert.equal(calls.create, 2)

  releaseCreate()
  await settle()
  assert.deepEqual(calls.stop, [5])              // 第一次迟到的码作废
  assert.equal(page.data.checkin.id, 6)          // 页面上是第二次出的码
  assert.match(page.data.qrCodeUrl, /rc_abcdefghij_6/)
  cleanup(page)
})

test('连点两下确认只提交一次', async () => {
  const { page, calls } = setup(null, () => Promise.resolve({ id: 50, stage: 'need_auth' }))
  page.onShow()
  await settle()
  page.onCellInput({ detail: { value: '13800138000' } })
  page.onSubmitCell()
  page.onSubmitCell()
  await settle()
  assert.deepEqual(calls.enter, ['13800138000'])
  cleanup(page)
})

test('不等授权了：作废这次提交，重新出码', async () => {
  const { page, calls } = setup(() => ({ code: 0, data: { stage: 'need_auth' } }), () => Promise.resolve({ id: 50, stage: 'need_auth' }))
  page.onShow()
  await settle()
  page.onCellInput({ detail: { value: '13800138000' } })
  page.onSubmitCell()
  await settle()
  page.onCancelAuthTap()
  await settle()
  assert.deepEqual(calls.stop, [5, 50])          // 原来那张二维码、手机号这条记录都作废
  assert.equal(page.data.waitingAuth, false)
  assert.equal(page.data.cell, '')
  assert.equal(page.data.checkin.id, 6)
  cleanup(page)
})

test('手机号不完整不提交；不是会员时停在本页，二维码照旧', async () => {
  const { page, calls, nav, toasts } = setup()
  page.onShow()
  await settle()
  page.onCellInput({ detail: { value: '13800' } })
  page.onSubmitCell()
  assert.deepEqual(toasts, ['请输入完整手机号'])
  assert.deepEqual(calls.enter, [])

  page.onCellInput({ detail: { value: '13900139000' } })
  page.onSubmitCell()
  await settle()
  assert.deepEqual(calls.enter, ['13900139000'])
  assert.equal(page.data.waitingAuth, false)
  assert.deepEqual(nav, [])
  assert.equal(page.data.checkin.id, 5)
  assert.deepEqual(calls.stop, [])
  cleanup(page)
})

test('底部链接进入手动录入入口', () => {
  const { page, nav } = setup()
  page.onManualEntryTap()
  assert.deepEqual(nav, ['/pages/admin/reception/recept_entry'])
  cleanup(page)
})

test('底部链接的文字是「远程开单」（原来叫「手动录入顾客信息开单」）', () => {
  const wxml = require('node:fs').readFileSync(require('node:path').join(__dirname, '../pages/admin/reception/recept_scan.wxml'), 'utf8')
  const link = /<view class="recover-link" bindtap="onManualEntryTap">([\s\S]*?)<\/view>/.exec(wxml)
  assert.ok(link, '没找到绑定 onManualEntryTap 的底部链接')
  assert.match(link[1], /<text>远程开单<\/text>/)
  assert.doesNotMatch(wxml, /<text>手动录入顾客信息开单<\/text>/)
})

// 扫码接待入口（pages/admin/reception/recept_scan）：出码、识别顾客、带会员开单、散客开单作废码、手动录入链接
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle, tap } = require('./reception_harness.js')

const PAGE = 'pages/admin/reception/recept_scan.js'

function setup(pollResult) {
  const calls = { create: 0, poll: [], stop: [] }
  const nav = []
  const modals = []
  const storage = {}
  let nextId = 5
  global.getApp = () => ({
    loginPromiseNew: Promise.resolve(),
    globalData: { sessionKey: 'sk', requestPrefix: 'https://api.example/api/' }
  })
  global.wx = {
    navigateTo(o) { nav.push(o.url) },
    setStorageSync(k, v) { storage[k] = v },
    showToast(o) { throw new Error('不应提示：' + o.title) },
    showModal(o) { modals.push(o.title); o.success({ confirm: true }) }
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
    getRentReceptingOrdersPromise() { return Promise.resolve([]) }
  }
  const page = loadPage(PAGE, fakeData)
  page.onLoad()
  return { page, calls, nav, modals, storage }
}

function cleanup(page) {
  page._stopPolling()
  delete global.getApp
  delete global.wx
}

test('出码后顾客验证完手机号，开单带上会员信息', async () => {
  const verified = { code: 0, data: { stage: 'verified', memberId: 42, name: '张三', gender: '男', cell: '13800138000', maskedCell: '138****8000' } }
  const { page, calls, nav, storage } = setup(() => verified)
  page.onShow()
  await settle()
  assert.equal(calls.create, 1)
  assert.match(page.data.qrCodeUrl, /MediaHelper\/GetQRCode\?qrCodeText=https%3A%2F%2Fmini\.snowmeet\.top%2Fmapp%2Frecept_checkin%3Fcode%3Drc_abcdefghij_5/)
  assert.equal(page.data.stageText, '请顾客用微信扫码')

  page.pollCheckin()
  await settle()
  assert.equal(page.data.customer.memberId, 42)
  assert.equal(page.data.checkin.stage, 'verified')
  assert.equal(page._pollTimer, null)

  page.shopSelected({ detail: { shop: '万龙体验中心', sale: 1, rent: 1, care: 0 } })
  assert.equal(page.data.care, 1)
  page.onBizTap(tap({ type: 'maintain' }))
  assert.equal(nav.length, 1)
  assert.match(nav[0], /memberId=42/)
  assert.match(nav[0], /customerCell=13800138000/)
  assert.match(nav[0], /shop=%E4%B8%87%E9%BE%99%E6%9C%8D%E5%8A%A1%E4%B8%AD%E5%BF%83/)
  assert.equal(storage.reception_draft.shopName, '万龙服务中心')
  // 已识别的码不作废；回到本页保留顾客、不重新出码
  page.onHide()
  page.onShow()
  assert.deepEqual(calls.stop, [])
  assert.equal(calls.create, 1)
  cleanup(page)
})

test('没扫码直接点业务按散客开单，没用上的码作废', async () => {
  const { page, calls, nav } = setup()
  page.onShow()
  await settle()
  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })
  page.onBizTap(tap({ type: 'rent' }))
  assert.equal(nav.length, 1)
  assert.doesNotMatch(nav[0], /memberId=/)
  assert.deepEqual(calls.stop, [5])
  assert.equal(page.data.checkin, null)
  // 回到本页重新出一张码
  page.onShow()
  await settle()
  assert.equal(calls.create, 2)
  assert.equal(page.data.checkin.id, 6)
  cleanup(page)
})

test('顾客还在验证手机号时开单要先确认', async () => {
  const { page, nav, modals } = setup(() => ({ code: 0, data: { stage: 'need_phone' } }))
  page.onShow()
  await settle()
  page.pollCheckin()
  await settle()
  assert.equal(page.data.stageText, '顾客已扫码，正在验证手机号…')
  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })
  page.onBizTap(tap({ type: 'retail' }))
  assert.deepEqual(modals, ['顾客还在验证手机号'])
  assert.equal(nav.length, 1)
  assert.doesNotMatch(nav[0], /memberId=/)
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

test('底部链接进入手动录入入口', () => {
  const { page, nav } = setup()
  page.onManualEntryTap()
  assert.deepEqual(nav, ['/pages/admin/reception/recept_entry'])
  cleanup(page)
})

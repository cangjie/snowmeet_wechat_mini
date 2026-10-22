// 养护订单页扫码取板（pages/admin/care/care_order_detail）：出小程序码、轮询验证结果、本人才自动完成发板
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle } = require('./reception_harness.js')

const PAGE = 'pages/admin/care/care_order_detail/care_order_detail.js'
const QR_TEXT = 'https://mini.snowmeet.top/mapp/care_pick?code=cp_abcdefghij_25693_801'

function setup(pollResult) {
  const calls = { create: [], poll: [], stop: [], task: [], loadOrder: 0 }
  const toasts = []
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk', requestPrefix: 'https://api.example/api/' } })
  global.wx = { showToast(o) { toasts.push(o.title) } }
  const fakeData = {
    createCarePickByStaffPromise(careId) {
      calls.create.push(careId)
      return Promise.resolve({ id: 801, careId, code: 'cp_abcdefghij_25693_801', qrText: QR_TEXT, stage: 'waiting_scan' })
    },
    getCarePickByStaffPromise(id) { calls.poll.push(id); return Promise.resolve(pollResult()) },
    stopScanQrCodePromise(id) { calls.stop.push(id); return Promise.resolve() },
    updateCareTaskStatusPromise(taskId, status, method, sk, a, b, c, isCancel, reason) {
      calls.task.push({ taskId, status, method, isCancel, reason })
      return Promise.resolve()
    }
  }
  const page = loadPage(PAGE, fakeData)
  page.loadOrder = () => { calls.loadOrder++ }
  page.setData({ cares: [{ id: 25693, _tasks: [{ id: 9, task_name: '发板', status: '未开始' }] }] })
  return { page, calls, toasts }
}

function cleanup(page) {
  page._closeScan()
  delete global.getApp
  delete global.wx
}

async function openReady(env) {
  env.page._openScan(0)
  await settle()
}

test('出小程序码（不再用公众号码），顾客是本人就自动完成发板', async () => {
  const env = setup(() => ({ code: 0, data: { stage: 'matched' } }))
  await openReady(env)
  const { page, calls, toasts } = env
  assert.deepEqual(calls.create, [25693])
  assert.equal(page.data.scanQr.status, 'ready')
  assert.equal(page.data.scanQr.url, 'https://api.example/api/MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent(QR_TEXT))
  assert.notEqual(page._scan.timer, null)

  page._pollScan()
  await settle()
  assert.deepEqual(calls.task, [{ taskId: 9, status: '已完成', method: '扫码取板', isCancel: false, reason: undefined }])
  assert.deepEqual(toasts, ['扫码发板完成'])
  assert.equal(calls.loadOrder, 1)
  assert.equal(page._scan, null)
  // 码已经用掉，不再作废
  assert.deepEqual(calls.stop, [])
  cleanup(page)
})

test('新微信号扫码后在授权手机号：提示等待，授权后验证通过再发板', async () => {
  let stage = 'need_member'
  const env = setup(() => ({ code: 0, data: { stage } }))
  await openReady(env)
  const { page, calls } = env
  page._pollScan()
  await settle()
  assert.equal(page.data.scanQr.status, 'scanned')
  assert.deepEqual(calls.task, [])
  assert.notEqual(page._scan, null)

  stage = 'matched'
  page._pollScan()
  await settle()
  assert.equal(calls.task.length, 1)
  cleanup(page)
})

test('不是下单人本人：提示顾客非本人，给重新生成二维码入口，不发板', async () => {
  const env = setup(() => ({ code: 0, data: { stage: 'mismatch' } }))
  await openReady(env)
  const { page, calls, toasts } = env
  page._pollScan()
  await settle()
  assert.deepEqual(toasts, ['顾客非本人'])
  assert.deepEqual(calls.task, [])
  assert.deepEqual(page.data.scanQr, { careId: 25693, url: '', status: 'broken' })
  cleanup(page)
})

test('二维码过期：不误报非本人，直接给重新生成入口', async () => {
  const env = setup(() => ({ code: 0, data: { stage: 'expired' } }))
  await openReady(env)
  const { page, toasts } = env
  page._pollScan()
  await settle()
  assert.deepEqual(toasts, [])
  assert.equal(page.data.scanQr.status, 'broken')
  cleanup(page)
})

test('离开页面时停止轮询并作废还没人扫的码', async () => {
  const env = setup(() => ({ code: 0, data: { stage: 'waiting_scan' } }))
  await openReady(env)
  const { page, calls } = env
  page._pollScan()
  await settle()
  assert.notEqual(page._scan.timer, null)
  page._closeScan()
  assert.equal(page._scan, null)
  assert.deepEqual(calls.stop, [801])
  cleanup(page)
})

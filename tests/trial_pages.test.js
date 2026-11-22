const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, settle } = require('./reception_harness')
const api = require('../utils/trial_api')

test('会员必须确认才会提交扫码签到，失败时显示错误', async () => {
  const calls = []
  api.request = async (action, params, body) => {
    calls.push({ action, params, body })
    if (action === 'CheckinInfo') return { barcode: '108', name: '板' }
    throw new Error('请预约会员本人扫码确认')
  }
  const page = loadPage('pages/trial/checkin.js', {})
  page.onLoad({ scene: '0123456789abcdef01234567' })
  await settle()
  assert.deepEqual(calls.map(x => x.action), ['CheckinInfo'])
  page.confirm()
  await settle()
  assert.deepEqual(calls.map(x => x.action), ['CheckinInfo', 'Checkin'])
  assert.equal(page.data.done, false)
  assert.equal(page.data.error, '请预约会员本人扫码确认')
})

test('预约列表显示资格、可选板和个人预约', async () => {
  api.request = async action => action === 'Options'
    ? { eligible: true, already: false, boards: [{ id: 1, barcode: '108', available: true }], seasonEnd: '2027-04-30' }
    : { reservations: [{ id: 1, status: 'returned', reservation_date: '2026-11-21T00:00:00' }] }
  const page = loadPage('pages/trial/index.js', {})
  await page.load()
  assert.equal(page.data.eligible, true)
  assert.equal(page.data.boards[0].barcode, '108')
  assert.equal(page.data.reservations[0].label, '已归还')
})

test('店员列表切换日期时显示加载状态，不显示旧日期结果或错误', async t => {
  const original = api.request
  t.after(() => { api.request = original })
  const pending = []
  api.request = (action, params) => new Promise((resolve, reject) => pending.push({ params, resolve, reject }))
  const page = loadPage('pages/trial/staff.js', {})
  page.load()
  page.setData({ rows: [{ id: 1 }] })
  page.dateChange({ detail: { value: '2027-01-02' } })
  assert.equal(page.data.loading, true)
  assert.deepEqual(page.data.rows, [])
  pending[0].reject(new Error('旧日期失败'))
  await settle()
  assert.equal(page.data.error, '')
  assert.equal(page.data.loading, true)
  pending[1].resolve({ reservations: [] })
  await settle()
  assert.equal(page.data.loading, false)
  assert.deepEqual(page.data.rows, [])
  page.dateChange({ detail: { value: '2027-01-03' } })
  pending[2].reject(new Error('查询失败'))
  await settle()
  assert.equal(page.data.loading, false)
  assert.equal(page.data.error, '查询失败')
})

test('本地试滑签到码通过请求加载，关闭后不接受迟到图片', async t => {
  const original = api.request
  let imageRequest
  t.after(() => { api.request = original; delete global.getApp; delete global.wx })
  global.getApp = () => ({ globalData: { requestPrefix: 'https://localhost:5001/api/', sessionKey: 'staff' } })
  global.wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    request: options => { imageRequest = options },
    arrayBufferToBase64: data => Buffer.from(data).toString('base64')
  }
  api.request = async () => ({})
  const page = loadPage('pages/trial/staff.js', {})
  t.after(() => page.stopPolling())
  page.showQr({ currentTarget: { dataset: { id: 1 } } })
  await settle()
  assert.equal(imageRequest.responseType, 'arraybuffer')
  assert.equal(page.data.qr.url, '')
  imageRequest.success({ statusCode: 200, data: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]).buffer })
  await settle()
  assert.equal(page.data.qr.url, 'data:image/png;base64,iVBORw0KGgo=')
  page.closeQr()
  imageRequest.success({ statusCode: 200, data: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]).buffer })
  assert.equal(page.data.qr, null)
})

test('本地二维码接口失败时显示状态并停止轮询', async t => {
  const original = api.request
  t.after(() => { api.request = original; delete global.getApp; delete global.wx })
  global.getApp = () => ({ globalData: { requestPrefix: 'https://localhost:5001/api/', sessionKey: 'staff' } })
  global.wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    request: options => options.success({ statusCode: 500, data: new ArrayBuffer(0) })
  }
  api.request = async () => ({})
  const page = loadPage('pages/trial/staff.js', {})
  t.after(() => page.stopPolling())
  page.showQr({ currentTarget: { dataset: { id: 1 } } })
  await settle()
  assert.equal(page.data.qr.url, '')
  assert.match(page.data.qr.message, /HTTP 500/)
  assert.equal(page._timer, null)
})

test('我的页面仅对有效武士团会籍显示试滑入口，返回时刷新资格', async t => {
  const original = api.request
  t.after(() => { api.request = original; delete global.getApp })
  const app = { loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'member' } }
  global.getApp = () => app
  let eligible = true
  api.request = async (action, params) => {
    assert.equal(action, 'Options')
    assert.match(params.date, /^\d{4}-\d{2}-\d{2}$/)
    return { eligible }
  }
  const page = loadPage('pages/mine/mine.js', {
    getMyCoachPromise: async () => ({}), getMyDistributorPromise: async () => ({}),
    getMyCoachCardsPromise: async () => ({ cards: [] }), getMyProfilePromise: async () => ({})
  })
  page._showProfile = () => {}
  assert.equal(page.data.hasTrialMembership, false)
  page.onShow(); await settle()
  assert.equal(page.data.hasTrialMembership, true)
  eligible = false
  page.onShow()
  assert.equal(page.data.hasTrialMembership, false)
  await settle()
  assert.equal(page.data.hasTrialMembership, false)
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/mine/mine.wxml'), 'utf8')
  assert.match(wxml, /wx:if="\{\{hasTrialMembership\}\}" value="武士团单板试滑预约"/)
})

test('我的页面不接受旧会话或已隐藏页面的迟到资格结果，失败时隐藏入口', async t => {
  const original = api.request
  t.after(() => { api.request = original; delete global.getApp })
  const app = { loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'first' } }
  global.getApp = () => app
  let resolve
  api.request = () => new Promise(r => { resolve = r })
  const page = loadPage('pages/mine/mine.js', {
    getMyCoachPromise: async () => ({}), getMyDistributorPromise: async () => ({}),
    getMyCoachCardsPromise: async () => ({ cards: [] })
  })
  page._showProfile = () => {}
  page.onShow(); await settle()
  app.globalData.sessionKey = 'second'
  resolve({ eligible: true }); await settle()
  assert.equal(page.data.hasTrialMembership, false)
  page.onShow(); await settle()
  page.onHide()
  resolve({ eligible: true }); await settle()
  assert.equal(page.data.hasTrialMembership, false)
  api.request = () => Promise.reject(new Error('offline'))
  page.onShow(); await settle()
  assert.equal(page.data.hasTrialMembership, false)
})

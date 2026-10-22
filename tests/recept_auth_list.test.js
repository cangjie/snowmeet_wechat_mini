// 【接待】接待授权（pages/admin/reception/recept_auth_list）：店长看今天的手机号进入申请并授权
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle, tap } = require('./reception_harness.js')

const PAGE = 'pages/admin/reception/recept_auth_list.js'

function setup(titleLevel) {
  const calls = { list: 0, give: [] }
  const toasts = []
  const rows = [
    { id: 9, cell: '13800138000', authed: false, submitTime: '2026-10-22T14:05:00', member: { real_name: '张三', gender: '男' }, submitStaff: { name: '小王' } },
    { id: 8, cell: '13900139000', authed: true, submitTime: '2026-10-22T09:30:00', member: null, submitStaff: null }
  ]
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk', staff: { id: 1, title_level: titleLevel } } })
  global.wx = { showToast(o) { toasts.push(o.title) } }
  const fakeData = {
    getTodayAuthCellListPromise() { calls.list++; return Promise.resolve(JSON.parse(JSON.stringify(rows))) },
    giveReceptAuthPromise(id) { calls.give.push(id); rows[0].authed = true; return Promise.resolve({ id, authed: 1 }) }
  }
  const page = loadPage(PAGE, fakeData)
  page.onLoad()
  return { page, calls, toasts }
}

function cleanup(page) {
  page.onUnload()
  delete global.getApp
  delete global.wx
}

test('普通店员打开时不拉申请列表', async () => {
  const { page, calls } = setup(100)
  page.onShow()
  await settle()
  assert.equal(page.data.isManager, false)
  assert.equal(calls.list, 0)
  assert.equal(page._timer, null)
  cleanup(page)
})

test('店长看到申请并授权，授权后列表刷新；离开页面停止自动刷新', async () => {
  const { page, calls, toasts } = setup(200)
  page.onShow()
  await settle()
  assert.equal(page.data.isManager, true)
  assert.equal(calls.list, 1)
  assert.notEqual(page._timer, null)
  assert.deepEqual(page.data.authList[0], { id: 9, cell: '13800138000', authed: false, name: '张三', gender: '男', staffName: '小王', timeStr: '14:05' })
  assert.equal(page.data.authList[1].name, '')
  assert.equal(page.data.authList[1].authed, true)

  page.giveAuth(tap({ id: 9 }))
  await settle()
  assert.deepEqual(calls.give, [9])
  assert.deepEqual(toasts, ['已授权'])
  assert.equal(page.data.authList[0].authed, true)

  page.onHide()
  assert.equal(page._timer, null)
  cleanup(page)
})

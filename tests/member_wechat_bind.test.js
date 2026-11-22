const test = require('node:test')
const assert = require('node:assert/strict')
const util = require('../utils/util.js')
const { loadPage, settle } = require('./reception_harness')

function setup(t) {
  const oldApp = global.getApp, oldWx = global.wx, oldRequest = util.performWebRequest
  const app = { globalData: { sessionKey: 'key', requestPrefix: 'https://test/api/' },
    loginPromiseNew: Promise.resolve(), retryLogin: async () => {} }
  global.getApp = () => app
  global.wx = { showToast() {}, getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial' } }) }
  t.after(() => { global.getApp = oldApp; global.wx = oldWx; util.performWebRequest = oldRequest })
  return app
}

test('顾客授权后提交一次性码，成功后刷新登录', async t => {
  const app = setup(t), calls = []
  let refreshed = false
  app.retryLogin = async () => { refreshed = true }
  util.performWebRequest = async (url, body) => { calls.push({ url, body }); return { bound: true } }
  const page = loadPage('pages/member/wechat_bind.js', {})
  page.selectComponent = () => null
  page.onLoad({ scene: '1234567890abcdef12345678' })
  page.onPhone({ detail: { code: 'phone-code' } })
  await settle()
  assert.deepEqual(calls[0].body, { token: '1234567890abcdef12345678', phoneCode: 'phone-code' })
  assert.equal(page.data.bound, true)
  assert.equal(refreshed, true)
})

test('无效码或未授权手机号不发绑定请求，服务端拒绝时显示原因', async t => {
  setup(t)
  let requests = 0
  util.performWebRequest = async () => { requests++; throw '该微信已绑定其他会员，请联系管理员核对' }
  const page = loadPage('pages/member/wechat_bind.js', {})
  page.onLoad({ scene: 'invalid' })
  page.onPhone({ detail: { code: 'x' } })
  assert.equal(requests, 0)
  page.onLoad({ scene: '1234567890abcdef12345678' })
  page.onPhone({ detail: {} })
  assert.equal(requests, 0)
  page.onPhone({ detail: { code: 'x' } })
  await settle()
  assert.equal(page.data.bound, false)
  assert.match(page.data.message, /已绑定其他会员/)
})

test('会员详情生成二维码并在关闭时作废', async t => {
  setup(t)
  const calls = []
  util.performWebRequest = async (url) => {
    calls.push(url)
    if (url.includes('/Create?')) return { id: 8 }
    return { stopped: true }
  }
  const page = loadPage('pages/admin/member/member_detail.js', {})
  page.setData({ memberId: 3 })
  page.onWechatBindOpen()
  await settle()
  assert.match(page.data.wechatBindImage, /Image\?id=8.*envVersion=trial/)
  page.onWechatBindClose()
  await settle()
  assert.ok(calls.some(url => url.includes('/Cancel?id=8')))
  assert.equal(page.data.wechatBindShow, false)
})

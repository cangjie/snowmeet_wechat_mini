// 「我的」里的分销商菜单区域（教练 / 机构）：条目由服务端按身份返回；订票二维码和收款资料页
// 设计：snowmeet_ai_doc/docs/superpowers/specs/2026-11-15-distributor-backend-design.md
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const menu = require('../utils/distributor_menu.js')
const api = require('../pages/distributor/common/api.js')
const { loadPage, settle } = require('./reception_harness.js')

const ROOT = path.join(__dirname, '..')
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8')
const PREFIX = 'https://x/api/'
const ALL = ['qrcode', 'customers', 'cards', 'coupons', 'payee']
const ORG = ['qrcode', 'customers', 'makeCard', 'makeCoupon', 'cards', 'coupons', 'payee']

function resp(type, entries) {
  return { isDistributor: true, distributor: { id: 2, type, name: type + '甲', coachId: 3 }, entries: entries || ALL }
}

test('菜单：不是分销商 / 空响应 → 没有区域；教练和机构按服务端顺序列出全部条目并带页面', () => {
  for (const r of [null, undefined, {}, { isDistributor: false }]) {
    assert.deepEqual(menu.build(r), { distributor: null, title: '', entries: [] })
  }
  for (const type of ['教练', '机构']) {
    const m = menu.build(resp(type, type === '机构' ? ORG : ALL))
    assert.equal(m.title, '分销商 · ' + type)
    assert.deepEqual(m.entries.map(e => e.key), type === '机构' ? ORG : ALL)
    assert.deepEqual(m.entries.map(e => e.title), type === '机构'
      ? ['订票二维码', '我的顾客与消费', '制作会员卡', '制作优惠券', '发卡与领取情况', '我的优惠券', '收款资料']
      : ['订票二维码', '我的顾客与消费', '发卡与领取情况', '我的优惠券', '收款资料'])
  }
})

test('菜单：发卡 / 券直达教练中心对应标签；顾客有自己的页面；不认识的条目 key 被忽略（以后服务端加条目，旧小程序不出错）', () => {
  const m = menu.build(resp('机构', ['qrcode', 'makeSomethingNew', 'customers', 'coupons']))
  assert.deepEqual(m.entries.map(e => e.key), ['qrcode', 'customers', 'coupons'])      // 以后服务端新增、这版小程序还不认识的条目，直接忽略
  assert.equal(menu.ENTRIES.makeCard.url, '/pages/coach/card_standard/card_standard')
  assert.equal(menu.ENTRIES.makeCoupon.url, '/pages/coach/coupon_maker/coupon_maker')
  assert.equal(menu.ENTRIES.customers.url, '/pages/distributor/customers/customers')
  assert.equal(menu.ENTRIES.cards.url, '/pages/coach/home/home?tab=share')
  assert.equal(menu.ENTRIES.coupons.url, '/pages/coach/home/home?tab=coupons')
  assert.equal(menu.build({ isDistributor: true, distributor: { type: '教练' } }).entries.length, 0)
})

test('菜单里每个页面都在 app.json 里注册（主包页面或对应分包）', () => {
  const app = JSON.parse(read('app.json'))
  const pages = new Set(app.pages)
  ;(app.subpackages || app.subPackages || []).forEach(sp => sp.pages.forEach(p => pages.add(sp.root + '/' + p)))
  for (const e of Object.values(menu.ENTRIES)) {
    const page = e.url.split('?')[0].replace(/^\//, '')
    assert.ok(pages.has(page), '未注册的页面：' + page)
    for (const ext of ['js', 'wxml', 'json']) assert.ok(fs.existsSync(path.join(ROOT, page + '.' + ext)), page + '.' + ext)
  }
})

function installGlobals(t, sessionKey = 'sk') {
  const app = { loginPromiseNew: Promise.resolve({ authenticated: true }), globalData: { sessionKey, requestPrefix: PREFIX, env: 'trial' } }
  const calls = { nav: [], toasts: [] }
  global.getApp = () => app
  global.wx = { showToast(o) { calls.toasts.push(o.title) }, navigateTo(o) { calls.nav.push(o.url) }, stopPullDownRefresh() {},
    getAccountInfoSync() { return { miniProgram: { envVersion: 'trial' } } }, getStorageSync() { return '' }, setStorageSync() {},
    getRealtimeLogManager() { return { info() {}, warn() {}, error() {} } } }
  t.after(() => { delete global.getApp; delete global.wx; api.setTransport(function (o) { wx.request(o) }) })
  return { app, calls }
}

function minePage(data) {
  const base = { getMyCoachPromise: async () => ({ isCoach: false }), getMyCoachCardsPromise: async () => ({ cards: [] }) }
  const page = loadPage('pages/mine/mine.js', Object.assign(base, data))
  page.selectComponent = () => null
  return page
}

test('「我的」页：教练 / 机构显示时拿到区域标题和条目，并存进 globalData；点条目进对应页面', async t => {
  const { app, calls } = installGlobals(t)
  const page = minePage({ getMyDistributorPromise: async () => resp('机构', ORG) })
  page.onShow()
  await settle()
  assert.equal(page.data.distributorTitle, '分销商 · 机构')
  assert.deepEqual(page.data.distributorEntries.map(e => e.key), ORG)
  assert.equal(app.globalData.distributor.type, '机构')
  page.gotoDistributorEntry({ currentTarget: { dataset: { url: '/pages/distributor/qrcode/qrcode' } } })
  page.gotoDistributorEntry({ currentTarget: { dataset: {} } })
  assert.deepEqual(calls.nav, ['/pages/distributor/qrcode/qrcode'])
})

test('「我的」页：不是分销商，或接口失败（老后端没有这个接口），区域不显示、不报错', async t => {
  installGlobals(t)
  const no = minePage({ getMyDistributorPromise: async () => ({ isDistributor: false }) })
  no.onShow(); await settle()
  assert.equal(no.data.distributor, null)
  assert.deepEqual(no.data.distributorEntries, [])
  const failing = minePage({ getMyDistributorPromise: async () => { throw new Error('404') } })
  failing.onShow(); await settle()
  assert.equal(failing.data.distributor, null)
})

test('「我的」页模板：分销商区域按条目循环，旧「我是分销商」单入口只在没有新区域时显示', () => {
  const wxml = read('pages/mine/mine.wxml')
  assert.match(wxml, /<view wx:if="\{\{distributor\}\}" class="distributor-area">/)
  assert.match(wxml, /<mp-cells title="\{\{distributorTitle\}\}">/)
  assert.match(wxml, /wx:for="\{\{distributorEntries\}\}"[^>]*data-url="\{\{item\.url\}\}"[^>]*bindtap="gotoDistributorEntry"/)
  assert.match(wxml, /wx:if="\{\{coach && !distributor\}\}" value="我是分销商"/)
})

test('订票二维码页：用登录会话和当前小程序版本拼二维码地址；失败给出提示；没有会话不请求', async t => {
  const { app } = installGlobals(t)
  const page = loadPage('pages/distributor/qrcode/qrcode.js', {})
  await page.onLoad()
  assert.match(page.data.qrUrl, /^https:\/\/x\/api\/Distributor\/GetQrCode\?sessionKey=sk&envVersion=trial&_=\d+$/)
  assert.equal(page.data.loading, true)
  page.onQrLoad()
  assert.equal(page.data.loading, false)
  page.onQrError()
  assert.match(page.data.error, /二维码生成失败/)
  app.globalData.sessionKey = ''
  page.getQrCode()
  assert.equal(page.data.qrUrl, '')
  assert.equal(page.data.error, '请先登录')
  // 页面不能出现让用户填分销商编号的入口：编号由服务端按登录态确定
  assert.doesNotMatch(read('pages/distributor/qrcode/qrcode.wxml'), /<input/)
})

function payeeEnv(t, handler) {
  installGlobals(t)
  const calls = []
  api.setTransport(options => {
    calls.push(options.url.replace(PREFIX, ''))
    setImmediate(() => options.success({ statusCode: 200, data: handler() }))
  })
  return calls
}

test('收款资料页：只读展示，登录号和姓名用服务端脱敏值，没有任何修改入口', async t => {
  const calls = payeeEnv(t, () => ({ code: 0, message: '', data: {
    name: '周教练', type: '教练',
    wechat: { filled: true, kind: '个人微信', merchantName: null },
    alipay: { filled: true, bound: true, loginName: '136****7006', realName: '周**' } } }))
  const page = loadPage('pages/distributor/payee/payee.js', {})
  await page.onLoad()
  await settle()
  assert.deepEqual(calls, ['Distributor/GetPayee?sessionKey=sk'])
  assert.equal(page.data.payee.alipay.loginName, '136****7006')
  assert.equal(page.data.loading, false)
  const wxml = read('pages/distributor/payee/payee.wxml')
  assert.doesNotMatch(wxml, /<input|<textarea|bindinput|bindtap="(save|edit|submit)/)
  assert.match(wxml, /请联系系统管理员修改/)
})

test('收款资料页：服务端拒绝时显示原因，可重试', async t => {
  payeeEnv(t, () => ({ code: 3, message: '你还不是教练或机构' }))
  const page = loadPage('pages/distributor/payee/payee.js', {})
  await page.onLoad()
  await settle()
  assert.equal(page.data.error, '你还不是教练或机构')
  assert.equal(page.data.payee, null)
})

test('api：二维码地址原样拼接 sessionKey，参数编码，空参数省略', () => {
  global.getApp = () => ({ globalData: { sessionKey: 'sk%2B1', requestPrefix: PREFIX } })
  try {
    assert.equal(api.qrCodeUrl('release'), PREFIX + 'Distributor/GetQrCode?sessionKey=sk%2B1&envVersion=release')
    assert.equal(api.qrCodeUrl(''), PREFIX + 'Distributor/GetQrCode?sessionKey=sk%2B1')
  } finally { delete global.getApp }
})

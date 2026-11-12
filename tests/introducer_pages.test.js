// 介绍人管理页：真实 introducer_api.js 经 setTransport 接到假后端，逐页 onLoad。
// 覆盖：非系统管理员被挡、列表加载与筛选、补绑支付宝、添加页的校验和请求体、绑定失败时给出原因。
const test = require('node:test')
const assert = require('node:assert/strict')
const api = require('../utils/introducer_api.js')
const { loadPage, settle, tap } = require('./reception_harness.js')

const PREFIX = 'https://x/api/'
const OK = data => ({ code: 0, message: '', data })

const ROW = over => Object.assign({
  id: 1, memberId: 5, type: 'KOL', name: '小王', realName: null, valid: true, coachId: null,
  wechat: '已填写', alipay: '未填写', alipayMessage: ''
}, over)

function setup(t, { handler, staff }) {
  const previous = { wx: global.wx, getApp: global.getApp }
  const calls = [], toasts = [], nav = []
  api.setTransport(options => {
    const [pathPart, query] = options.url.replace(PREFIX, '').split('?')
    const [controller, action] = pathPart.split('/')
    const params = {}
    ;(query || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); params[k] = decodeURIComponent(v) })
    calls.push({ controller, action, method: options.method, params, body: options.data })
    setImmediate(() => options.success({ statusCode: 200, data: handler(controller, action, params, options.data) }))
  })
  global.wx = {
    showToast(o) { toasts.push(o.title) }, stopPullDownRefresh() {},
    navigateTo(o) { nav.push(o.url) }, navigateBack() { nav.push('back') },
    showModal(o) { setImmediate(() => o.success && o.success({ confirm: true })) }
  }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { staff, sessionKey: 'sk%2B1', requestPrefix: PREFIX } })
  t.after(() => {
    global.wx = previous.wx
    global.getApp = previous.getApp
    api.setTransport(function (options) { wx.request(options) })
  })
  return { calls, toasts, nav }
}

const ADMIN = { valid: 1, title_level: 300 }

test('非系统管理员进列表页被挡，不发请求', async t => {
  const env = setup(t, { staff: { valid: 1, title_level: 200 }, handler: () => OK({}) })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  page.onLoad()
  await settle()
  assert.equal(page.data.blocked, '只有系统管理员可以管理介绍人')
  assert.equal(env.calls.length, 0)
})

test('管理员进列表页：加载、按类型筛选、补绑支付宝、停用', async t => {
  const rows = [
    ROW({ id: 1, name: '李教练', type: '教练', alipay: '已绑定' }),
    ROW({ id: 2, name: '小王', type: 'KOL', alipay: '未绑定', alipayMessage: '账号与姓名不一致' }),
    ROW({ id: 3, name: '某俱乐部', type: '机构' })
  ]
  const env = setup(t, {
    staff: ADMIN,
    handler: (c, a) => {
      if (a === 'ListIntroducers') return OK({ introducers: rows })
      if (a === 'BindAlipay') return OK(ROW({ id: 2, alipay: '未绑定', alipayMessage: '账号与姓名不一致' }))
      return OK(ROW({ id: 2, valid: false }))
    }
  })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  page.onLoad()
  await settle()
  assert.equal(env.calls[0].controller + '/' + env.calls[0].action, 'Introducer/ListIntroducers')
  assert.equal(page.data.rows.length, 3)
  assert.deepEqual(page.data.counts, { '全部': 3, '教练': 1, 'KOL': 1, '机构': 1 })

  page.onFilter(tap({ name: 'KOL' }))
  assert.deepEqual(page.data.rows.map(r => r.name), ['小王'])
  assert.equal(page.data.rows[0].alipayClass, 'danger')

  await page.onRebind(tap({ id: 2 }))
  const bind = env.calls.find(c => c.action === 'BindAlipay')
  assert.deepEqual(bind.body, { introducerId: 2 })
  assert.ok(env.toasts.includes('绑定失败：账号与姓名不一致'))

  await page.onToggle(tap({ id: 2, valid: true }))
  const update = env.calls.find(c => c.action === 'UpdateIntroducer')
  assert.deepEqual(update.body, { introducerId: 2, valid: false })
})

test('添加页：校验提示、请求体、机构要商户号和全称', async t => {
  const env = setup(t, {
    staff: ADMIN,
    handler: (c, a, params, body) => {
      if (a === 'LookupMember') return OK({ exists: true, memberId: 7, name: '示例', phoneTail: '3306', isCoach: false })
      return OK(ROW({ id: 9, alipay: '未填写' }))
    }
  })
  const page = loadPage('pages/introducer/admin/add/add.js', {})
  page.onLoad()
  await settle()

  page.onSave()
  assert.equal(env.toasts.pop(), '请先点「查找」找到会员')

  page.onCell({ detail: { value: '13800003306' } })
  await page.onLookup()
  assert.equal(page.data.found.memberId, 7)
  assert.equal(page.data.name, '示例')

  page.onType(tap({ type: '机构' }))
  page.onName({ detail: { value: '某俱乐部' } })
  page.onSave()
  assert.equal(env.toasts.pop(), '机构要填商户号和商户全称')

  page.onWepayNum({ detail: { value: '1600000001' } })
  page.onWepayName({ detail: { value: '某某公司' } })
  await page.onSave()
  const call = env.calls.find(c => c.action === 'AddIntroducer')
  assert.equal(call.method, 'POST')
  assert.deepEqual(call.body, {
    memberId: 7, type: '机构', name: '某俱乐部', realName: '', wepayAccountNum: '1600000001', wepayAccountName: '某某公司',
    aliAccountNum: ''
  })
  assert.equal(page.data.result.ok, true)
})

test('添加页：支付宝只填登录号；格式要是手机号或邮箱；要真实姓名；绑定失败时给出原因，介绍人仍保存', async t => {
  const env = setup(t, {
    staff: ADMIN,
    handler: (c, a) => {
      if (a === 'LookupMember') return OK({ exists: true, memberId: 7, name: '张三', phoneTail: '7006', isCoach: true })
      return OK(ROW({ id: 9, type: '教练', alipay: '未绑定', alipayMessage: '账号与姓名不一致' }))
    }
  })
  const page = loadPage('pages/introducer/admin/add/add.js', {})
  page.onLoad()
  await settle()
  assert.equal('aliAccountType' in page.data, false)   // 不再选登录号 / 用户号
  page.onCell({ detail: { value: '13691457006' } })
  await page.onLookup()
  page.onType(tap({ type: '教练' }))

  for (const bad of ['2088000000000001', '1369145700', 'abc', 'a@b']) {
    page.onAliNum({ detail: { value: bad } })
    page.onSave()
    assert.equal(env.toasts.pop(), '支付宝登录号要填手机号或邮箱', bad)
  }
  assert.equal(env.calls.filter(c => c.action === 'AddIntroducer').length, 0)

  page.onAliNum({ detail: { value: '13691457006' } })
  page.onSave()
  assert.equal(env.toasts.pop(), '登录号要同时填真实姓名')
  assert.equal(env.calls.filter(c => c.action === 'AddIntroducer').length, 0)

  page.onRealName({ detail: { value: '张三' } })
  await page.onSave()
  const call = env.calls.find(c => c.action === 'AddIntroducer')
  assert.deepEqual(call.body, {
    memberId: 7, type: '教练', name: '张三', realName: '张三', wepayAccountNum: '', wepayAccountName: '',
    aliAccountNum: '13691457006'
  })
  assert.equal(page.data.result.ok, false)
  assert.equal(page.data.result.title, '已保存，但支付宝绑定失败')
  assert.match(page.data.result.body, /账号与姓名不一致/)
})

test('添加页：支付宝登录号可以是邮箱', async t => {
  const env = setup(t, {
    staff: ADMIN,
    handler: (c, a) => (a === 'LookupMember'
      ? OK({ exists: true, memberId: 7, name: '张三', phoneTail: '7006', isCoach: false })
      : OK(ROW({ id: 9, alipay: '已绑定' })))
  })
  const page = loadPage('pages/introducer/admin/add/add.js', {})
  page.onLoad()
  await settle()
  page.onCell({ detail: { value: '13691457006' } })
  await page.onLookup()
  page.onRealName({ detail: { value: '张三' } })
  page.onAliNum({ detail: { value: ' zhang.san@example.com ' } })
  await page.onSave()
  assert.equal(env.calls.find(c => c.action === 'AddIntroducer').body.aliAccountNum, 'zhang.san@example.com')
  assert.equal(page.data.result.ok, true)
})

test('添加页：这个手机号还没有会员，不能保存', async t => {
  const env = setup(t, { staff: ADMIN, handler: () => OK({ exists: false, cell: '13800000000' }) })
  const page = loadPage('pages/introducer/admin/add/add.js', {})
  page.onLoad()
  await settle()
  page.onCell({ detail: { value: '13800000000' } })
  await page.onLookup()
  page.onName({ detail: { value: '某人' } })
  page.onSave()
  assert.equal(env.toasts.pop(), '这个手机号还没有会员，介绍人必须先是会员')
  assert.equal(env.calls.filter(c => c.action === 'AddIntroducer').length, 0)
})

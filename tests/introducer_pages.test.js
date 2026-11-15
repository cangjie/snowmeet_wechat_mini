// 介绍人管理页：真实 introducer_api.js 经 setTransport 接到假后端，逐页 onLoad。
// 覆盖：非系统管理员被挡、列表加载与筛选、补绑支付宝、添加页的校验和请求体、绑定失败时给出原因。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
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

test('编辑分销商时可以切换角色；机构和教练、KOL 一样，不需要商户号和商户全称', async t => {
  const template = fs.readFileSync(path.join(__dirname, '../pages/introducer/admin/list/list.wxml'), 'utf8')
  assert.match(template, /bindtap="onEditType"/)
  assert.doesNotMatch(template, /商户号|商户全称|onEditWepay/)
  const env = setup(t, { staff: ADMIN, handler: (c, a) => a === 'ListIntroducers'
    ? OK({ introducers: [ROW()] }) : a === 'ListCoaches' ? OK({ coaches: [] }) : OK(ROW({ type: '机构' })) })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  await page.onLoad()
  page.onEdit(tap({ id: 1 }))
  assert.equal(typeof page.onEditType, 'function')
  assert.equal(page.onEditWepayNum, undefined)
  page.onEditType(tap({ type: '教练' }))
  await page.onSaveEdit()
  assert.equal(env.calls.find(c => c.action === 'UpdateIntroducer').body.type, '教练')
  page.onEdit(tap({ id: 1 }))
  page.onEditType(tap({ type: '机构' }))
  await page.onSaveEdit()                                    // 改成机构直接保存，不再被商户号拦下
  const updates = env.calls.filter(c => c.action === 'UpdateIntroducer')
  assert.equal(updates.length, 2)
  assert.equal(updates[1].body.type, '机构')
  assert.equal('wepayAccountNum' in updates[1].body, false)
  assert.equal('wepayAccountName' in updates[1].body, false)
  assert.ok(!env.toasts.some(x => /商户/.test(x)))
})

test('管理员和分销商入口使用统一的分销商名称', () => {
  const admin = fs.readFileSync(path.join(__dirname, '../pages/admin/admin.wxml'), 'utf8')
  const mine = fs.readFileSync(path.join(__dirname, '../pages/mine/mine.wxml'), 'utf8')
  assert.match(admin, /id="introducer_admin" value="【分销】分销商管理"/)
  assert.doesNotMatch(admin, /id="coach_admin"/)
  assert.match(mine, /我是分销商/)
  const home = fs.readFileSync(path.join(__dirname, '../pages/coach/home/home.wxml'), 'utf8')
  const claim = fs.readFileSync(path.join(__dirname, '../pages/coach/claim/claim.wxml'), 'utf8')
  assert.doesNotMatch(home, /你的教练身份/)
  assert.doesNotMatch(claim, /请向教练再要一张/)
  const editor = fs.readFileSync(path.join(__dirname, '../components/share/order_share_editor/order_share_editor.wxml'), 'utf8')
  const add = fs.readFileSync(path.join(__dirname, '../pages/introducer/share/add/add.wxml'), 'utf8')
  assert.match(editor, /分销商分账/)
  assert.match(add, /没有符合条件的分销商/)
})

test('分销商管理可以查看该分销商的卡和价格，并进入分销商分账列表', async t => {
  const env = setup(t, { staff: ADMIN, handler: (c, a) => {
    if (a === 'ListIntroducers') return OK({ introducers: [ROW({ coachId: 17 })] })
    return OK({ coaches: [] })
  } })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  await page.onLoad()
  page.onOpenPlatform(tap({ id: 17 }))
  page.onShareList()
  assert.deepEqual(env.nav, ['/pages/coach/admin/detail/detail?id=17', '/pages/introducer/share/list/list?distributors=1'])
})

test('历史身份冲突会在分销商管理中显示，不能悄悄跳过', async t => {
  setup(t, { staff: ADMIN, handler: () => OK({ introducers: [ROW()], syncConflicts: ['小王：历史身份状态冲突'] }) })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  await page.onLoad()
  assert.deepEqual(page.data.syncConflicts, ['小王：历史身份状态冲突'])
  assert.match(fs.readFileSync(path.join(__dirname, '../pages/introducer/admin/list/list.wxml'), 'utf8'), /syncConflicts/)
})

test('分销商管理保留发卡与顾客消费统计', async t => {
  setup(t, { staff: ADMIN, handler: (c, a) => {
    if (a === 'ListIntroducers') return OK({ introducers: [ROW({ id: 1, coachId: 17 })] })
    if (a === 'ListCoaches') return OK({ coaches: [{ coach: { id: 17, cards: { total: 5, claimed: 3 } }, students: 3, seasonAmount: 120 }] })
    return OK({})
  } })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  await page.load()
  assert.deepEqual(page.data.stats, { distributors: 1, cardsIssued: 5, cardsClaimed: 3, consumption: 120 })
  assert.equal(page.data.rows[0].students, 3)
})

test('同一历史身份不会重复统计卡与消费', async t => {
  setup(t, { staff: ADMIN, handler: (c, a) => a === 'ListIntroducers'
    ? OK({ introducers: [ROW({ id: 1, coachId: 17 }), ROW({ id: 2, coachId: 17, valid: false })] })
    : OK({ coaches: [{ coach: { id: 17, cards: { total: 5, claimed: 3 } }, students: 3, seasonAmount: 120 }] }) })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  await page.load()
  assert.deepEqual(page.data.stats, { distributors: 1, cardsIssued: 5, cardsClaimed: 3, consumption: 120 })
})

test('统计请求失败时仍显示分销商名单并说明统计不可用', async t => {
  setup(t, { staff: ADMIN, handler: (c, a) => a === 'ListIntroducers'
    ? OK({ introducers: [ROW({ id: 1, coachId: 17 })] }) : { code: 1, message: '统计暂时不可用' } })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  await page.load()
  assert.equal(page.data.rows.length, 1)
  assert.equal(page.data.statsUnavailable, true)
})

test('管理员可以为已有分销商补充支付宝收款信息', async t => {
  const env = setup(t, { staff: ADMIN, handler: (c, a) => a === 'ListIntroducers' ? OK({ introducers: [ROW({ id: 1, name: '小王', coachId: 17 })] }) : OK(ROW({ id: 1, alipay: '已绑定' })) })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  await page.onLoad()
  page.onEdit(tap({ id: 1 }))
  page.onEditRealName({ detail: { value: '王先生' } })
  page.onEditAli({ detail: { value: '13800001234' } })
  await page.onSaveEdit()
  const request = env.calls.find(c => c.action === 'UpdateIntroducer')
  assert.equal(request.body.introducerId, 1)
  assert.equal(request.body.realName, '王先生')
  assert.equal(request.body.aliAccountNum, '13800001234')
})

test('分销商列表可搜索并勾选启用的分销商批量发券', async t => {
  const env = setup(t, { staff: ADMIN, handler: () => OK({ introducers: [ROW({ id: 1, coachId: 17, name: '小王' }), ROW({ id: 2, coachId: 18, name: '小李', valid: false })] }) })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  await page.onLoad()
  page.onSearch({ detail: { value: '小王' } })
  assert.deepEqual(page.data.rows.map(r => r.name), ['小王'])
  page.onSelect(tap({ id: 1 }))
  page.onIssue()
  assert.deepEqual(env.nav, ['/pages/coach/admin/issue/issue?ids=17'])
})

test('分销商列表可按启用状态筛选', async t => {
  setup(t, { staff: ADMIN, handler: (c, a) => a === 'ListIntroducers'
    ? OK({ introducers: [ROW({ id: 1, valid: true }), ROW({ id: 2, name: '停用', valid: false })] }) : OK({ coaches: [] }) })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  await page.load()
  page.onStatusFilter(tap({ value: 'stopped' }))
  assert.deepEqual(page.data.rows.map(r => r.id), [2])
  page.onStatusFilter(tap({ value: 'active' }))
  assert.deepEqual(page.data.rows.map(r => r.id), [1])
})

test('完整手机号搜索按会员精确匹配，不把相同尾号的其他分销商混入', async t => {
  setup(t, { staff: ADMIN, handler: (c, a) => {
    if (a === 'ListIntroducers') return OK({ introducers: [ROW({ id: 1, memberId: 51, phoneTail: '1234' }), ROW({ id: 2, memberId: 52, phoneTail: '1234' })] })
    if (a === 'LookupMember') return OK({ exists: true, memberId: 51 })
    return OK({ coaches: [] })
  } })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  await page.load()
  await page.onSearch({ detail: { value: '13800001234' } })
  assert.deepEqual(page.data.rows.map(r => r.id), [1])
})

test('手机号查询返回前改搜名称时，旧查询不会覆盖新结果', async t => {
  setup(t, { staff: ADMIN, handler: (c, a) => {
    if (a === 'ListIntroducers') return OK({ introducers: [ROW({ id: 1, memberId: 51, name: '甲' }), ROW({ id: 2, memberId: 52, name: '乙' })] })
    if (a === 'LookupMember') return OK({ exists: true, memberId: 51 })
    return OK({ coaches: [] })
  } })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  await page.load()
  const old = page.onSearch({ detail: { value: '13800001234' } })
  await page.onSearch({ detail: { value: '乙' } })
  await old
  assert.deepEqual(page.data.rows.map(r => r.id), [2])
})

test('筛选隐藏已选分销商时清除选择，避免误发券', async t => {
  const env = setup(t, { staff: ADMIN, handler: (c, a) => a === 'ListIntroducers'
    ? OK({ introducers: [ROW({ id: 1, name: '甲', coachId: 17 }), ROW({ id: 2, name: '乙', coachId: 18 })] }) : OK({ coaches: [] }) })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  await page.load()
  page.onSelect(tap({ id: 1 }))
  assert.equal(page.data.selected[1], 17)
  page.onSearch({ detail: { value: '乙' } })
  page.onIssue()
  assert.equal(env.nav.length, 0)
  assert.ok(env.toasts.includes('请先勾选分销商'))
})

test('刷新后已停用的分销商不会留在发券选择里', async t => {
  let enabled = true
  const env = setup(t, { staff: ADMIN, handler: () => OK({ introducers: [ROW({ id: 1, coachId: 17, valid: enabled })] }) })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  await page.load()
  page.onSelect(tap({ id: 1 }))
  assert.equal(page.data.selected[1], 17)
  enabled = false
  await page.load()
  page.onIssue()
  assert.equal(env.nav.length, 0)
  assert.ok(env.toasts.includes('请先勾选分销商'))
})

test('非系统管理员进列表页被挡，不发请求', async t => {
  const env = setup(t, { staff: { valid: 1, title_level: 200 }, handler: () => OK({}) })
  const page = loadPage('pages/introducer/admin/list/list.js', {})
  await page.onLoad()
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
  await page.onLoad()
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

test('添加页：校验提示、请求体；机构和教练、KOL 一样不需要商户号', async t => {
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

  const wxml = fs.readFileSync(path.join(__dirname, '../pages/introducer/admin/add/add.wxml'), 'utf8')
  assert.doesNotMatch(wxml, /商户号（必填）|商户全称（必填）|onWepay/)
  assert.equal(page.onWepayNum, undefined)

  page.onType(tap({ type: '机构' }))
  page.onName({ detail: { value: '某俱乐部' } })
  await page.onSave()                                        // 机构不填商户号也能保存
  const call = env.calls.find(c => c.action === 'AddIntroducer')
  assert.equal(call.method, 'POST')
  assert.deepEqual(call.body, { memberId: 7, type: '机构', name: '某俱乐部', realName: '', aliAccountNum: '' })
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
    memberId: 7, type: '教练', name: '张三', realName: '张三',
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

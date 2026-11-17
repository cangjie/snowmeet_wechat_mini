// 教练平台页面：真实 api.js 经 setTransport 接到假后端，逐页 onLoad，走通管理员（教练列表/详情定价/添加/批量发券）、
// 教练中心（发卡分享/领取情况/学员消费/券）、学员领取页（各状态、授权手机号后领取、别人再点显示已被领取）
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const api = require('../pages/coach/common/api.js')
const { loadPage } = require('./reception_harness.js')

const PREFIX = 'https://x/api/'
const OK = data => ({ code: 0, message: '', data })
const ERR = (code, message, data) => ({ code, message, data: data === undefined ? null : data })

const COACH = (over) => Object.assign({
  id: 1, memberId: 2, name: '张教练', valid: true, phoneTail: '1002', rentalRate: 0.9,
  carePrices: [
    { shop: '万龙服务中心', tier: '单项', mode: 'rate', value: 0.8 }, { shop: '万龙服务中心', tier: '双项', mode: 'rate', value: 0.8 },
    { shop: '崇礼旗舰店', tier: '单项', mode: 'fixed', value: 68 }, { shop: '崇礼旗舰店', tier: '双项', mode: 'fixed', value: 128 }
  ],
  cards: { total: 3, issued: 1, claimed: 2, revoked: 0 }
}, over)

// handler(controller, action, params, body) → 服务端信封；记录所有调用
function setup(t, { handler, staff, globals }) {
  const previous = { wx: global.wx, getApp: global.getApp }
  const calls = [], toasts = [], modals = [], nav = [], extra = globals || {}
  api.setTransport(options => {
    const [pathPart, query] = options.url.replace(PREFIX, '').split('?')
    const [controller, action] = pathPart.split('/')
    const params = {}
    ;(query || '').split('&').filter(Boolean).forEach(kv => { const [k, val] = kv.split('='); params[k] = decodeURIComponent(val) })
    calls.push({ controller, action, method: options.method, params, body: options.data, url: options.url })
    setImmediate(() => options.success({ statusCode: 200, data: handler(controller, action, params, options.data) }))
  })
  global.wx = {
    showToast(o) { toasts.push(o.title) }, setNavigationBarTitle() {}, stopPullDownRefresh() {}, hideShareMenu() {},
    navigateTo(o) { nav.push(o.url) }, redirectTo(o) { nav.push('redirect:' + o.url) },
    showModal(o) { modals.push(o.title); setImmediate(() => o.success && o.success({ confirm: true })) }
  }
  global.getApp = () => Object.assign({
    loginPromiseNew: Promise.resolve(), retryLogin: () => Promise.resolve({ authenticated: true }),
    globalData: { staff, sessionKey: 'sk%2B1', requestPrefix: PREFIX }
  }, extra)
  t.after(() => {
    api.setTransport(function (options) { wx.request(options) })
    if (previous.wx === undefined) delete global.wx; else global.wx = previous.wx
    if (previous.getApp === undefined) delete global.getApp; else global.getApp = previous.getApp
  })
  const load = (file, fake) => loadPage(file, fake || {})
  return { calls, toasts, modals, nav, load }
}
const settle = () => new Promise(r => setTimeout(r, 30))
const tap = dataset => ({ currentTarget: { dataset } })
const ADMIN = { valid: 1, title_level: 300 }

test('api：拼接 sessionKey 原样 + 参数编码，保留服务端 code 和 data', async t => {
  const { calls } = setup(t, { staff: ADMIN, handler: (c, a) => a === 'LookupMember' ? OK({ exists: false }) : ERR(5, '请先授权手机号', { state: 'x' }) })
  await api.lookupMember('138 0000')
  // 会话密钥已是 encodeURIComponent 过的，原样拼接；其余参数逐个编码
  assert.equal(calls[0].url, PREFIX + 'CoachAdmin/LookupMember?sessionKey=sk%2B1&cell=138%200000')
  assert.deepEqual([calls[0].controller, calls[0].action, calls[0].method, calls[0].params.cell], ['CoachAdmin', 'LookupMember', 'GET', '138 0000'])
  await assert.rejects(api.claimShareCard('abc'), err => err.code === 5 && err.message === '请先授权手机号' && err.data.state === 'x')
})

test('管理员列表：非管理员被拦；管理员看到统计和价格摘要，停用的教练不能勾选，批量发券带上已勾选', async t => {
  const handler = (c, a) => OK({
    stats: { coaches: 2, cardsIssued: 20, cardsClaimed: 15, consumption: 6280 },
    coaches: [
      { coach: COACH(), students: 18, seasonAmount: 6280, couponsGranted: 5 },
      { coach: COACH({ id: 2, name: '李教练', valid: false, phoneTail: '6612', carePrices: [], rentalRate: null }), students: 0, seasonAmount: 0, couponsGranted: 0 }
    ]
  })
  const denied = setup(t, { staff: { valid: 1, title_level: 100 }, handler })
  const p0 = denied.load('pages/coach/admin/list/list.js'); p0.onLoad(); await settle()
  assert.equal(p0.data.blocked, '只有系统管理员可以管理教练'); assert.equal(denied.calls.length, 0)

  const s = setup(t, { staff: ADMIN, handler })
  const page = s.load('pages/coach/admin/list/list.js'); page.onLoad(); await settle()
  assert.equal(page.data.stats.cardsClaimed, 15)
  assert.deepEqual(page.data.rows.map(r => r.name), ['张教练', '李教练'])
  assert.deepEqual(page.data.rows[0].chips, ['万龙 单8折 双8折', '崇礼 单¥68 双¥128', '租赁 9折'])
  page.onToggle(tap({ id: 2 }))
  assert.equal(page.data.selectedCount, 0); assert.match(s.toasts.at(-1), /已停用/)
  page.onIssue(); assert.match(s.toasts.at(-1), /请先勾选/)
  page.onToggle(tap({ id: 1 })); assert.equal(page.data.selectedCount, 1)
  page.onIssue(); assert.equal(s.nav.at(-1), '../issue/issue?ids=1')
  page.onSearch({ detail: { value: '李' } }); assert.deepEqual(page.data.rows.map(r => r.name), ['李教练'])
  page.onSearch({ detail: { value: '1002' } }); assert.deepEqual(page.data.rows.map(r => r.name), ['张教练'])
})

const WL = '万龙服务中心', CL = '崇礼旗舰店'
const FLOORS = () => ({ care: [
  { shop: WL, tier: '单项', minFixed: null, minRate: null, maxOff: 50 }, { shop: WL, tier: '双项', minFixed: null, minRate: null, maxOff: null },
  { shop: CL, tier: '单项', minFixed: 80, minRate: 0.8, maxOff: null }, { shop: CL, tier: '双项', minFixed: null, minRate: null, maxOff: null }] })

test('分销商详情：「优惠券底价」每格三种方式各自可空；校验不过不发请求；没改动不保存；他的卡、停用仍可用', async t => {
  let floors = FLOORS()
  const s = setup(t, {
    staff: ADMIN,
    handler: (c, a, p, body) => {
      if (a === 'GetCoach') return OK(COACH())
      if (a === 'GetCouponFloors') return OK(floors)
      if (a === 'SetCouponFloors') {
        floors = { care: body.care.map(x => ({ shop: x.shop, tier: x.tier, minFixed: x.min_fixed, minRate: x.min_rate, maxOff: x.max_off })) }
        return OK(floors)
      }
      if (a === 'ListCoachCards') return OK({ counts: { total: 2, issued: 1, claimed: 1, revoked: 0 }, cards: [
        { id: 9, tokenTail: 'A1B2', status: 'claimed', createDate: '2026-10-08T09:00:00', memberId: 3, studentName: '学员A', phoneTail: '1003', claimedAt: '2026-10-08T14:20:00', validUntil: '2027-04-30T23:59:59', useCount: 3, carePrices: [], rentalRate: null },
        { id: 10, tokenTail: 'C7D9', status: 'issued', createDate: '2026-10-30T09:12:00', carePrices: [], rentalRate: null, useCount: 0 }
      ] })
      return OK({})
    }
  })
  const page = s.load('pages/coach/admin/detail/detail.js'); page.onLoad({ id: '1' }); await settle()
  assert.equal(page.data.tab, 'coupon')
  assert.equal(page.data.couponCells.length, 4)
  assert.deepEqual(page.data.couponCells.map(c => [c.fixedText, c.rateText, c.offText]), [['', '', '50'], ['', '', ''], ['80', '8', ''], ['', '', '']])
  page.onCouponSave(); await settle(); assert.ok(!s.calls.some(c => c.action === 'SetCouponFloors'))                 // 没改动
  page.onCouponRate({ currentTarget: { dataset: { i: 0 } }, detail: { value: '15' } })
  page.onCouponSave(); await settle()
  assert.match(s.toasts.at(-1), /万龙单项：最低折扣填 0.1～10/); assert.ok(!s.calls.some(c => c.action === 'SetCouponFloors'))   // 校验不过不发请求
  page.onCouponRate({ currentTarget: { dataset: { i: 0 } }, detail: { value: '7' } })
  page.onCouponFixed({ currentTarget: { dataset: { i: 0 } }, detail: { value: '60' } })
  page.onCouponOff({ currentTarget: { dataset: { i: 1 } }, detail: { value: '20.5' } })
  page.onCouponSave(); await settle()
  const sent = s.calls.find(c => c.action === 'SetCouponFloors').body
  assert.equal(sent.coachId, 1); assert.equal(sent.care.length, 4)
  assert.deepEqual(sent.care[0], { shop: WL, tier: '单项', min_fixed: 60, min_rate: 0.7, max_off: 50 })
  assert.deepEqual(sent.care[1], { shop: WL, tier: '双项', min_fixed: null, min_rate: null, max_off: 20.5 })     // 空的方式传 null = 没开放
  assert.deepEqual(sent.care[3], { shop: CL, tier: '双项', min_fixed: null, min_rate: null, max_off: null })
  assert.equal(page.data.couponDirty, false)
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/coach/admin/detail/detail.wxml'), 'utf8')
  assert.match(wxml, />优惠券底价</); assert.match(wxml, />会籍卡底价</); assert.doesNotMatch(wxml, />价格设置</)
  // 他的卡：列表、撤销
  page.onTab(tap({ tab: 'cards' })); await settle()
  assert.equal(page.data.cards.length, 2); assert.equal(page.data.cards[0].tag.text, '已领取'); assert.equal(page.data.cards[0].until, '2027-04-30')
  page.onRevoke(tap({ id: 10 })); await settle()
  assert.ok(s.calls.some(c => c.action === 'RevokeCard' && c.body.cardId === 10))
  page.onToggleValid(); await settle()
  assert.ok(s.calls.some(c => c.action === 'UpdateCoach' && c.body.valid === false && c.body.coachId === 1))
})

test('添加教练：先查找会员；已是教练不能再加；新手机号同时创建会员', async t => {
  let found = { exists: true, memberId: 5, name: '王明', phoneTail: '6612', isCoach: false }
  const s = setup(t, { staff: ADMIN, handler: (c, a) => a === 'LookupMember' ? OK(found) : OK(COACH({ id: 7 })) })
  const page = s.load('pages/coach/admin/add/add.js'); page.onLoad(); await settle()
  page.onSave(); assert.match(s.toasts.at(-1), /先点「查找会员」/)
  page.onCell({ detail: { value: '138' } }); page.onLookup(); assert.match(s.toasts.at(-1), /完整的手机号/)
  page.onCell({ detail: { value: '13800006612' } }); page.onLookup(); await settle()
  assert.equal(page.data.name, '王明')
  found.isCoach = true; page.onCell({ detail: { value: '13800006612' } }); page.onLookup(); await settle()
  page.onSave(); assert.match(s.toasts.at(-1), /已经是教练/)
  found = { exists: false, cell: '13911112222' }
  page.onCell({ detail: { value: '13911112222' } }); page.onLookup(); await settle()
  page.setData({ name: '' }); page.onSave(); assert.match(s.toasts.at(-1), /教练显示名/)
  page.onName({ detail: { value: '赵教练' } }); page.onSave(); await settle()
  assert.deepEqual(s.calls.find(c => c.action === 'AddCoach').body, { cell: '13911112222', name: '赵教练' })
  assert.equal(s.nav.at(-1), 'redirect:../detail/detail?id=7')
})

test('批量发券：二次确认后提交，requestId 页面内固定（重试不重复发），已发的提示跳过', async t => {
  const s = setup(t, {
    staff: ADMIN,
    handler: (c, a) => a === 'ListCoaches' ? OK({ coaches: [{ coach: COACH() }, { coach: COACH({ id: 2, name: '李教练' }) }, { coach: COACH({ id: 3, name: '赵教练' }) }] })
      : a === 'ListCouponTemplates' ? OK({ templates: [{ id: 16, name: '老顾客券' }, { id: 12, name: '免费打蜡券' }] })
      : OK({ granted: 8, skipped: 2, perCoach: [] })
  })
  const page = s.load('pages/coach/admin/issue/issue.js'); page.onLoad({ ids: '1,2' }); await settle()
  assert.deepEqual(page.data.coaches.map(c => c.name), ['张教练', '李教练'])
  page.onSend(); assert.match(s.toasts.at(-1), /请选择券模板/)
  page.onTemplate({ detail: { value: '0' } }); page.onPlus(); page.onPlus(); page.onMinus()
  page.onRemove(tap({ id: 2 })); assert.equal(page.data.coaches.length, 1)
  page.onSend(); await settle()
  const first = s.calls.find(c => c.action === 'GrantCoupons').body
  assert.deepEqual([first.coachIds, first.templateId, first.countEach], [[1], 16, 6])
  assert.match(page.data.doneText, /已发放 8 张.*2 张之前已发过/)
  page.onSend(); await settle()
  const grants = s.calls.filter(c => c.action === 'GrantCoupons')
  assert.equal(grants[1].body.requestId, grants[0].body.requestId)                    // 同一次填写的重复提交不会重复发放
  assert.ok(s.modals.includes('确认发放'))
})

function homeSetup(t, getCoach) {
  const cardRows = [
    { card: { id: 1, tokenTail: 'C7D9', status: 'issued', createDate: '2026-10-30T09:12:00' }, sharePath: '/pages/coach/claim/claim?t=aaaaaaaaaaaaaaaaaaaaaaaa' },
    { card: { id: 2, tokenTail: 'A1B2', status: 'claimed', createDate: '2026-10-08T09:00:00', studentName: '王同学', phoneTail: '0231', claimedAt: '2026-10-08T14:20:00' } }
  ]
  return setup(t, {
    staff: null,
    handler: (c, a) => ({
      GetMyCoach: () => { const co = getCoach(); return OK(co ? { isCoach: true, coach: Object.assign(COACH(), { validUntil: '2027-04-30T23:59:59' }, co), cards: { total: 2, issued: 1, claimed: 1, revoked: 0 } } : { isCoach: false }) },
      ListMyCards: () => OK({ counts: { total: 2, issued: 1, claimed: 1, revoked: 0 }, cards: cardRows }),
      RevokeMyCard: () => OK({}),
      GetStudents: () => OK({ summary: { students: 2, amount: 1300, cardDiscount: 33.6 }, students: [
        { memberId: 3, name: '王同学', phoneTail: '0231', sources: ['card'], since: '2026-10-08T14:20:00', orderCount: 3, amount: 1240, cardDiscount: 33.6, lastOrderDate: '2026-10-28T10:00:00' },
        { memberId: 5, name: '刘同学', phoneTail: '5518', sources: ['coupon'], since: '2026-10-20T10:00:00', orderCount: 1, amount: 60, cardDiscount: 0, lastOrderDate: null }] }),
      GetMyCoupons: () => OK({ summary: { granted: 3, held: 1, pending: 1, accepted: 1, used: 0 }, items: [
        { code: 'A', name: '老顾客券', state: 'accepted', acceptedName: '张同学', acceptedPhoneTail: '3306', acceptedAt: '2026-10-27T10:00:00' },
        { code: 'B', name: '老顾客券', state: 'pending' }, { code: 'C', name: '老顾客券', state: 'held', expireDate: '2027-04-30T23:59:59' }] })
    }[a] || (() => OK({})))()
  })
}

test('分销商中心（教练 / KOL）：不是分销商被挡；没有发卡和领取情况，落到「我的券」；顾客消费、券照常', async t => {
  let who = null
  const s = homeSetup(t, () => who)
  const page = s.load('pages/coach/home/home.js'); page.onLoad(); await settle()
  assert.match(page.data.blocked, /还不是分销商/)

  for (const type of ['教练', 'KOL']) {
    who = { introducerType: type }
    const p = s.load('pages/coach/home/home.js'); p.onLoad({ tab: 'share' }); await settle()      // 旧入口带 tab=share 进来
    assert.equal(p.data.blocked, ''); assert.equal(p.data.coach.name, '张教练')
    assert.equal(p.data.tab, 'coupons', type + '没有发卡，落到我的券')
    assert.equal(p.data.pending.length, 0)
    assert.equal(p.data.coupons.length, 3)
    p.onTab(tap({ tab: 'students' })); await settle()
    assert.deepEqual(p.data.students.map(x => [x.name, x.sourceText]), [['王同学', '学员卡'], ['刘同学', '优惠券']])
    p.onGoTickets(); assert.equal(s.nav.at(-1), '/pages/mine/ticket/ticket_list')
  }
  assert.ok(!s.calls.some(c => c.action === 'ListMyCards' || c.action === 'CreateCard'), '教练和 KOL 不查卡、不发卡')
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/coach/home/home.wxml'), 'utf8')
  assert.match(wxml, /wx:if="\{\{coach\.introducerType === '机构'\}\}" class="tab[^"]*" data-tab="share"/)
  assert.match(wxml, /wx:if="\{\{coach\.introducerType === '机构'\}\}" class="tab[^"]*" data-tab="status"/)
  assert.doesNotMatch(wxml, /生成学员卡/)
})

test('分销商中心（机构）：发卡分享路径来自服务端；撤销；领取情况 / 顾客 / 券各 Tab', async t => {
  const s = homeSetup(t, () => ({ introducerType: '机构' }))
  const page = s.load('pages/coach/home/home.js'); page.onLoad(); await settle()
  assert.equal(page.data.blocked, ''); assert.equal(page.data.tab, 'share')
  assert.equal(page.data.pending.length, 1)
  // 分享：用卡片按钮上的路径，不分享分销商中心
  assert.deepEqual(page.onShareAppMessage({ from: 'button', target: { dataset: { path: '/pages/coach/claim/claim?t=aaaaaaaaaaaaaaaaaaaaaaaa' } } }),
    { title: '张教练送你一张学员卡', path: '/pages/coach/claim/claim?t=aaaaaaaaaaaaaaaaaaaaaaaa', imageUrl: '/pages/coach/assets/membership-share-cover.jpg' })
  page.onRevoke(tap({ id: 1 })); await settle(); assert.ok(s.calls.some(c => c.action === 'RevokeMyCard' && c.body.cardId === 1))
  page.onTab(tap({ tab: 'status' })); await settle()
  assert.equal(page.data.statusRows[1].studentName, '王同学')
  page.onTab(tap({ tab: 'students' })); await settle()
  assert.equal(page.data.studentSummary.cardDiscount, 33.6)
  page.onStudent(tap({ id: 3 })); assert.equal(s.nav.at(-1), '../student/student?id=3')
  page.onTab(tap({ tab: 'coupons' })); await settle()
  assert.deepEqual(page.data.coupons.map(x => x.tag.text), ['已被接受', '待接受', '在手'])
  assert.equal(page.data.coupons[0].acceptedPhoneTail, '3306')
})

test('学员订单明细：起算日、来源、用卡标记', async t => {
  const s = setup(t, { staff: null, handler: () => OK({
    student: { memberId: 3, name: '王同学', phoneTail: '0231', sources: ['card', 'coupon'], since: '2026-10-08T14:20:00', orderCount: 2, amount: 620.4 },
    orders: [{ orderId: 1, date: '2026-10-28T10:00:00', type: '养护', itemName: '养护 · 双项 双板', amount: 134.4, usedCoachCard: true, cardDiscount: 33.6 }, { orderId: 2, date: '2026-10-20T10:00:00', type: '零售', itemName: '零售 · 手套', amount: 486, usedCoachCard: false, cardDiscount: 0 }]
  }) })
  const page = s.load('pages/coach/student/student.js'); page.onLoad({ id: '3' }); await settle()
  assert.equal(page.data.student.sourceText, '学员卡 · 优惠券'); assert.equal(page.data.student.since, '2026-10-08')
  assert.deepEqual(page.data.orders.map(o => [o.day, o.usedCoachCard]), [['2026-10-28', true], ['2026-10-20', false]])
  assert.equal(s.calls[0].params.memberId, '3')
})

// ---------- 学员领取页 ----------
const TOKEN = 'abcdef0123456789abcdef01'
const VIEW = (state, over) => ({ view: Object.assign({ state, message: '', coachName: '张教练', carePrices: COACH().carePrices, rentalRate: 0.9, validUntil: '2027-04-30T23:59:59' }, over), needMember: false })

test('领取页：解析 token（t / scene / q），格式不对不请求', async t => {
  const s = setup(t, { staff: null, handler: () => OK(VIEW('claimable')) })
  const ok = s.load('pages/coach/claim/claim.js'); ok.onLoad({ t: TOKEN }); await settle()
  assert.equal(ok.data.token, TOKEN); assert.equal(s.calls[0].params.t, TOKEN)
  const viaScene = s.load('pages/coach/claim/claim.js'); viaScene.onLoad({ scene: encodeURIComponent('t=' + TOKEN) }); await settle()
  assert.equal(viaScene.data.token, TOKEN)
  const before = s.calls.length
  const bad = s.load('pages/coach/claim/claim.js'); bad.onLoad({ t: 'x' }); await settle()
  assert.equal(bad.data.errMsg, '分享链接不完整'); assert.equal(s.calls.length, before)
})

test('领取页：可领取 → 领取成功；别人再点同一张显示「已被领取」', async t => {
  let claimed = false
  const s = setup(t, {
    staff: null,
    handler: (c, a) => a === 'GetShareCard' ? OK(claimed ? VIEW('taken', { message: '这张学员卡已被领取' }) : VIEW('claimable'))
      : OK(Object.assign({ state: 'claimed_by_me', claimed: true }, VIEW('claimed_by_me')))
  })
  const mine = s.load('pages/coach/claim/claim.js'); mine.onLoad({ t: TOKEN }); await settle()
  assert.equal(mine.data.state, 'claimable'); assert.equal(mine.data.benefit.lines[0].two, '8折'); assert.equal(mine.data.validUntil, '2027-04-30')
  await mine.onClaim(); claimed = true
  assert.equal(mine.data.state, 'claimed_by_me'); assert.match(s.toasts.at(-1), /领取成功/)
  const other = s.load('pages/coach/claim/claim.js'); other.onLoad({ t: TOKEN }); await settle()
  assert.equal(other.data.state, 'taken')
  // 领取接口返回「已被别人领走」（竞争失败）也显示对应画面，不是通用错误
  claimed = false
  const racer = s.load('pages/coach/claim/claim.js'); racer.onLoad({ t: TOKEN }); await settle()
  api.setTransport(o => setImmediate(() => o.success({ statusCode: 200, data: o.url.includes('ClaimShareCard') ? ERR(1, '这张学员卡已被领取', { state: 'taken' }) : OK(VIEW('claimable')) })))
  await racer.onClaim()
  assert.equal(racer.data.state, 'taken'); assert.equal(racer.data.message, '这张学员卡已被领取')
})

test('领取页：还不是会员 → 授权手机号 → 成为会员后自动领取；拒绝授权给出提示', async t => {
  let member = false; const bound = []
  const s = setup(t, {
    staff: null,
    handler: (c, a) => a === 'GetShareCard' ? OK(Object.assign(VIEW('claimable'), { needMember: !member }))
      : (member ? OK(Object.assign({ state: 'claimed_by_me', claimed: true }, VIEW('claimed_by_me'))) : ERR(5, '请先授权手机号'))
  })
  const fake = { bindWechatCellPromise: (enc, iv, sk) => { bound.push([enc, iv, sk]); member = true; return Promise.resolve({ id: 9 }) } }
  const page = s.load('pages/coach/claim/claim.js', fake); page.onLoad({ t: TOKEN }); await settle()
  assert.equal(page.data.needMember, true)
  await page.onPhone({ detail: {} }); assert.match(page.data.errMsg, /需要授权手机号/); assert.equal(bound.length, 0)
  await page.onPhone({ detail: { encryptedData: 'ENC', iv: 'IV' } })
  assert.deepEqual(bound, [['ENC', 'IV', 'sk%2B1']])
  assert.equal(page.data.state, 'claimed_by_me'); assert.equal(page.data.needMember, false)
})

test('领取页：已失效 / 教练本人 / 已有该教练的卡 / 登录失败可重试', async t => {
  let state = 'invalid'
  const s = setup(t, { staff: null, handler: () => OK(VIEW(state, { message: '提示' })) })
  for (const st of ['invalid', 'self', 'already_has']) {
    state = st
    const p = s.load('pages/coach/claim/claim.js'); p.onLoad({ t: TOKEN }); await settle()
    assert.equal(p.data.state, st); assert.equal(p.data.coachName, '张教练')
  }
  const failing = setup(t, { staff: null, handler: () => OK(VIEW('claimable')), globals: { loginPromiseNew: Promise.resolve({ authenticated: false }) } })
  const p = failing.load('pages/coach/claim/claim.js'); p.onLoad({ t: TOKEN }); await settle()
  assert.equal(p.data.loginError, true); assert.equal(failing.calls.length, 0)
})

test('我的学员卡：已领取的卡、有效期与各店价格', async t => {
  const s = setup(t, { staff: null, handler: () => OK({ cards: [{ id: 1, coachName: '张教练', validUntil: '2027-04-30T23:59:59', expired: false, carePrices: COACH().carePrices, rentalRate: 0.9 }] }) })
  const page = s.load('pages/coach/card/card.js'); page.onLoad(); await settle()
  assert.equal(page.data.cards.length, 1); assert.equal(page.data.cards[0].until, '2027-04-30'); assert.equal(page.data.cards[0].benefit.lines[1].one, '¥68')
})

test('机构中心每次生成独立卡并分享服务端单卡链接', async t => {
  const template = { id: 8, name: '教练卡', carePrices: [], rentalRate: 0.8 }
  let sequence = 0
  const s = setup(t, { handler: (c, a) => {
    if (a === 'GetMyCoach') return OK({ isCoach: true, coach: COACH({ introducerType: '机构' }), cards: {} })
    if (a === 'ListMyCards') return OK({ cards: [], counts: {} })
    if (a === 'ListMyCardTemplates') return OK({ templates: [template] })
    if (a === 'CreateCard') { sequence++; return OK({ cardId: sequence, cardName: '教练卡', tokenTail: '000' + sequence, sharePath: '/pages/coach/claim/claim?t=unique000' + sequence }) }
    return OK({})
  } })
  const home = s.load('pages/coach/home/home.js'); home.onLoad({}); await settle()
  await home.onCreateForTemplate({ currentTarget: { dataset: { id: 8 } } })
  await home.onCreateForTemplate({ currentTarget: { dataset: { id: 8 } } })
  assert.equal(home.data.pending.length, 2)
  assert.notEqual(home.data.pending[0].sharePath, home.data.pending[1].sharePath)
  assert.deepEqual(s.calls.filter(c => c.action === 'CreateCard').map(c => c.body.templateId), [8, 8])
})

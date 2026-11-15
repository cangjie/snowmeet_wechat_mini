// 机构自己生成优惠券（小程序）：按管理员设的底价生成，表单模型 / 本地校验 / 页面流程 / 重复提交保护。
// 设计：snowmeet_ai_doc/docs/superpowers/specs/2026-11-15-distributor-backend-design.md「四」
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const api = require('../pages/coach/common/api.js')
const view = require('../pages/coach/common/coach-view.js')
const { loadPage } = require('./reception_harness.js')

const ROOT = path.join(__dirname, '..')
const PREFIX = 'https://x/api/'
const WL = '万龙服务中心', CL = '崇礼旗舰店'
const settle = () => new Promise(r => setTimeout(r, 60))
const OK = data => ({ code: 0, message: '', data })

const MAKER = over => Object.assign({
  canMake: true, reason: '', name: '某机构', validUntil: '2027-04-30T00:00:00', maxPerRequest: 50, maxOutstanding: 500, outstanding: 3,
  cells: [
    { shop: WL, tier: '单项', open: true, productReady: true, minRate: 0.7, minFixed: 60 },
    { shop: WL, tier: '双项', open: true, productReady: true, minRate: 0.7, minFixed: null },
    { shop: CL, tier: '单项', open: true, productReady: false, minRate: null, minFixed: 100 },
    { shop: CL, tier: '双项', open: false, productReady: false, minRate: null, minFixed: null }],
  recent: [{ templateId: 7, name: '某机构 万龙单项68元一口价券', count: 3, used: 1, created: '2026-11-15T10:00:00' }]
}, over)

test('选择项：每格可用的方式来自底价；没开放 / 没配价目的不可选并说明原因', () => {
  const cells = view.couponCells(MAKER().cells)
  assert.deepEqual(cells.map(c => [c.label, c.available, c.modes.map(m => m.key)]), [
    ['万龙单项', true, ['rate', 'fixed']], ['万龙双项', true, ['rate']], ['崇礼单项', false, ['fixed']], ['崇礼双项', false, []]])
  assert.equal(cells[0].hint, '折扣不低于 7 折，一口价不低于 ¥60')
  assert.equal(cells[2].hint, '这家店还没有配置养护价目')
  assert.equal(cells[3].hint, '管理员未开放')
})

test('本地校验：不能低于底价、方式要对、张数 1～50；刚好等于底价可以', () => {
  const cells = view.couponCells(MAKER().cells)
  const [wl1, wl2, cl1] = cells
  assert.deepEqual(view.couponPayload(wl1, 'fixed', '68', '10'), { shop: WL, tier: '单项', mode: 'fixed', value: 68, count: 10 })
  assert.deepEqual(view.couponPayload(wl1, 'fixed', '60', '1'), { shop: WL, tier: '单项', mode: 'fixed', value: 60, count: 1 })
  assert.deepEqual(view.couponPayload(wl2, 'rate', '7', '50'), { shop: WL, tier: '双项', mode: 'rate', value: 0.7, count: 50 })
  assert.equal(view.couponPayload(wl2, 'rate', '7.5', '5').value, 0.75)
  assert.match(view.couponPayload(wl1, 'fixed', '59.9', '5').error, /一口价不能低于 ¥60/)
  assert.match(view.couponPayload(wl2, 'rate', '6.9', '5').error, /折扣不能低于 7 折/)
  assert.match(view.couponPayload(wl2, 'fixed', '100', '5').error, /一口价不能低于/)     // 这一格没开放一口价
  assert.match(view.couponPayload(cl1, 'fixed', '100', '5').error, /请选择一个已开放的项目/)
  assert.match(view.couponPayload(null, 'fixed', '100', '5').error, /请选择一个已开放的项目/)
  assert.match(view.couponPayload(wl1, '', '68', '5').error, /折扣或一口价/)
  assert.match(view.couponPayload(wl1, 'fixed', '', '5').error, /请填写一口价/)
  assert.match(view.couponPayload(wl2, 'rate', '11', '5').error, /折扣填 0.1～10/)
  for (const n of ['0', '51', '1.5', 'abc', '']) assert.match(view.couponPayload(wl1, 'fixed', '68', n).error, /张数填 1～50/)
})

function env(t, handler) {
  const calls = { api: [], toasts: [], nav: [] }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk', requestPrefix: PREFIX } })
  global.wx = { showToast: o => calls.toasts.push(o.title), showModal() {}, stopPullDownRefresh() {}, navigateTo: o => calls.nav.push(o.url) }
  api.setTransport(options => {
    const [pathPart] = options.url.replace(PREFIX, '').split('?')
    calls.api.push({ path: pathPart, method: options.method, body: options.data })
    setImmediate(() => options.success({ statusCode: 200, data: handler(pathPart, options.data, calls) }))
  })
  t.after(() => { delete global.getApp; delete global.wx; api.setTransport(function (o) { wx.request(o) }) })
  return calls
}
const tapCell = (page, i) => page.onCell({ currentTarget: { dataset: { i } } })

test('制作优惠券页：加载、选项目、定价格、生成；入参正确，成功后刷新最近生成并提示', async t => {
  let state = MAKER()
  const calls = env(t, (p, body) => {
    if (p === 'Distributor/GetMyCouponMaker') return OK(state)
    if (p === 'Distributor/MakeMyCoupons') {
      state = MAKER({ outstanding: 13, recent: [{ templateId: 8, name: '某机构 万龙单项68元一口价券', count: 10, used: 0, created: '2026-11-15T11:00:00' }].concat(MAKER().recent) })
      return OK({ made: { templateId: 8, name: 'x', memo: '', created: 10, repeated: false }, maker: state })
    }
    throw new Error(p)
  })
  const page = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  page.onLoad(); await settle()
  assert.equal(page.data.canMake, true)
  assert.equal(page.data.validUntil, '2027-04-30')
  assert.equal(page.data.outstanding, 3)
  tapCell(page, 3)                                                    // 没开放：点不了，提示原因
  assert.equal(page.data.sel, -1)
  assert.ok(calls.toasts.includes('管理员未开放'))
  tapCell(page, 0)
  assert.equal(page.data.sel, 0)
  assert.equal(page.data.mode, '')                                    // 两种方式都开放：让机构自己选
  page.onSubmit()                                                     // 没选方式：本地拦下，不发请求
  assert.match(calls.toasts[calls.toasts.length - 1], /折扣或一口价/)
  page.onMode({ currentTarget: { dataset: { mode: 'fixed' } } })
  page.onValue({ detail: { value: '50' } })
  page.onSubmit()                                                     // 低于底价：本地拦下
  assert.match(calls.toasts[calls.toasts.length - 1], /一口价不能低于 ¥60/)
  assert.equal(calls.api.filter(c => c.path.endsWith('MakeMyCoupons')).length, 0)
  page.onValue({ detail: { value: '68' } })
  page.onSubmit(); await settle()
  const make = calls.api.find(c => c.path.endsWith('MakeMyCoupons'))
  assert.equal(make.method, 'POST')
  assert.deepEqual([make.body.shop, make.body.tier, make.body.mode, make.body.value, make.body.count], [WL, '单项', 'fixed', 68, 10])
  assert.match(make.body.requestId, /^c\d+/)
  assert.equal(page.data.outstanding, 13)
  assert.equal(page.data.recent[0].count, 10)
  assert.equal(page.data.submitting, false)
  assert.ok(calls.toasts.includes('已生成 10 张，放进了你的券包'))
  page.onGoCoupons()
  assert.deepEqual(calls.nav, ['/pages/coach/home/home?tab=coupons'])
})

test('制作优惠券页：只开放一种方式的格子自动选好；同一份表单重试用同一个请求编号，改了表单才换', async t => {
  let attempts = 0
  const calls = env(t, (p) => {
    if (p === 'Distributor/GetMyCouponMaker') return OK(MAKER())
    attempts++
    return attempts === 1 ? { code: 1, message: '服务暂时繁忙' } : OK({ made: { templateId: 8, created: 5, repeated: attempts === 3 }, maker: MAKER() })
  })
  const page = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  page.onLoad(); await settle()
  tapCell(page, 1)                                                    // 万龙双项只开放折扣
  assert.equal(page.data.mode, 'rate')
  page.onValue({ detail: { value: '8' } })
  page.onCount({ detail: { value: '5' } })
  page.onSubmit(); await settle()                                     // 第一次失败：填的内容还在
  assert.equal(page.data.submitting, false)
  assert.equal(page.data.valueText, '8')
  page.onSubmit(); await settle()                                     // 重试：同一个请求编号
  const ids = calls.api.filter(c => c.path.endsWith('MakeMyCoupons')).map(c => c.body.requestId)
  assert.equal(ids.length, 2)
  assert.equal(ids[0], ids[1])
  page.onValue({ detail: { value: '7.5' } })                          // 改了表单：换新编号
  page.onSubmit(); await settle()
  const ids2 = calls.api.filter(c => c.path.endsWith('MakeMyCoupons')).map(c => c.body.requestId)
  assert.notEqual(ids2[2], ids[0])
  assert.ok(calls.toasts.includes('这批券之前已经生成过了'))          // 服务端说是重复提交
})

test('制作优惠券页：教练（canMake=false）不能生成；不是分销商显示拦截；提交中不重复提交', async t => {
  let mode = 'coach'
  const calls = env(t, (p) => {
    if (mode === 'none') return { code: 3, message: '你还不是教练或机构' }
    if (p.endsWith('GetMyCouponMaker')) return OK(mode === 'coach' ? MAKER({ canMake: false, reason: '只有机构可以自己生成优惠券' }) : MAKER())
    return OK({ made: { created: 1, repeated: false }, maker: MAKER() })
  })
  const coach = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  coach.onLoad(); await settle()
  assert.equal(coach.data.canMake, false)
  assert.equal(coach.data.reason, '只有机构可以自己生成优惠券')
  tapCell(coach, 0)
  coach.onSubmit()
  assert.equal(calls.api.filter(c => c.path.endsWith('MakeMyCoupons')).length, 0)

  mode = 'none'
  const none = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  none.onLoad(); await settle()
  assert.equal(none.data.blocked, '你还不是教练或机构')

  mode = 'org'
  const org = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  org.onLoad(); await settle()
  tapCell(org, 0); org.onMode({ currentTarget: { dataset: { mode: 'fixed' } } }); org.onValue({ detail: { value: '68' } })
  org.onSubmit(); org.onSubmit()                                      // 连点两下
  await settle()
  assert.equal(calls.api.filter(c => c.path.endsWith('MakeMyCoupons')).length, 1)
})

test('制作优惠券页的文件齐全，wxml 里的事件处理函数都在页面里', () => {
  const dir = 'pages/coach/coupon_maker/coupon_maker'
  for (const ext of ['js', 'wxml', 'json', 'wxss']) assert.ok(fs.existsSync(path.join(ROOT, dir + '.' + ext)), ext)
  JSON.parse(fs.readFileSync(path.join(ROOT, dir + '.json'), 'utf8'))
  const wxml = fs.readFileSync(path.join(ROOT, dir + '.wxml'), 'utf8')
  const js = fs.readFileSync(path.join(ROOT, dir + '.js'), 'utf8')
  for (const m of wxml.matchAll(/bind(?:tap|input)="(\w+)"/g)) assert.match(js, new RegExp('\\b' + m[1] + '\\s*\\('), m[1])
})

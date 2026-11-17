// 分销商（教练 / KOL / 机构）自己生成单张优惠券（小程序）：按管理员设的「优惠券底价」生成，一口价 / 折扣 / 减免三种方式，
// 管理员没设置的项目和方式一律不显示（用户 2026-11-17：免得误导）。表单模型 / 本地校验 / 页面流程 / 重复提交保护 / 管理员设底价的表单。
// 设计：snowmeet_ai_doc/docs/superpowers/specs/2026-11-15-distributor-backend-design.md
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
// 页面里是 请求 → setImmediate → 多层 promise；机器忙时 10ms 不稳，这里等久一点
const settle = () => new Promise(r => setTimeout(r, 60))
const OK = data => ({ code: 0, message: '', data })

const cell = (shop, tier, over) => Object.assign({ shop, tier, open: false, productReady: false, modes: [], minFixed: null, minRate: null, maxOff: null }, over)
const MAKER = over => Object.assign({
  canMake: true, reason: '', name: '某教练', validUntil: '2027-04-30T00:00:00', maxPerRequest: 50, maxOutstanding: 500, outstanding: 3,
  cells: [
    cell(WL, '单项', { open: true, productReady: true, modes: ['fixed', 'rate', 'off'], minFixed: 60, minRate: 0.7, maxOff: 30 }),
    cell(WL, '双项', { open: true, productReady: true, modes: ['rate'], minRate: 0.7 }),
    cell(CL, '单项', { open: true, productReady: false, modes: ['fixed'], minFixed: 100 }),     // 开放了，但这家店没配养护价目
    cell(CL, '双项')],                                                                          // 没开放
  recent: [{ templateId: 7, name: '某教练 万龙单项68元一口价券', count: 3, used: 1, created: '2026-11-15T10:00:00' }]
}, over)

test('选择项：只保留管理员开放了的项目，每格只保留设置了的方式；没开放 / 没配价目的不出现', () => {
  const cells = view.couponCells(MAKER().cells)
  assert.deepEqual(cells.map(c => [c.label, c.modes.map(m => m.key)]), [['万龙单项', ['fixed', 'rate', 'off']], ['万龙双项', ['rate']]])
  assert.deepEqual(cells[0].modes.map(m => m.label), ['一口价', '折扣', '减免'])
  assert.equal(cells[0].hint, '一口价不低于 ¥60，折扣不低于 7 折，减免不超过 ¥30')
  assert.equal(cells[1].hint, '折扣不低于 7 折')                       // 没设置的一口价、减免不会出现在提示里
  // 只开放减免的格子
  assert.deepEqual(view.couponCells([cell(WL, '单项', { open: true, productReady: true, modes: ['off'], maxOff: 50 })]).map(c => c.modes.map(m => m.key)), [['off']])
  // 什么都没开放：一个格子都没有（页面显示「管理员还没有给你开放优惠券」）
  assert.deepEqual(view.couponCells([cell(WL, '单项'), cell(CL, '双项')]), [])
  assert.deepEqual(view.couponCells(null), [])
})

test('本地校验：一口价不能低于、折扣不能低于、减免不能超过；没开放的方式不能选；张数 1～50；刚好等于底价可以', () => {
  const [wl1, wl2] = view.couponCells(MAKER().cells)
  assert.deepEqual(view.couponPayload(wl1, 'fixed', '68', '10'), { shop: WL, tier: '单项', mode: 'fixed', value: 68, count: 10 })
  assert.deepEqual(view.couponPayload(wl1, 'fixed', '60', '1'), { shop: WL, tier: '单项', mode: 'fixed', value: 60, count: 1 })
  assert.deepEqual(view.couponPayload(wl1, 'rate', '7.5', '5'), { shop: WL, tier: '单项', mode: 'rate', value: 0.75, count: 5 })
  assert.deepEqual(view.couponPayload(wl1, 'off', '30', '50'), { shop: WL, tier: '单项', mode: 'off', value: 30, count: 50 })
  assert.deepEqual(view.couponPayload(wl1, 'off', '20.5', '2'), { shop: WL, tier: '单项', mode: 'off', value: 20.5, count: 2 })
  assert.match(view.couponPayload(wl1, 'fixed', '59.9', '5').error, /一口价不能低于 ¥60/)
  assert.match(view.couponPayload(wl1, 'rate', '6.9', '5').error, /折扣不能低于 7 折/)
  assert.match(view.couponPayload(wl1, 'off', '30.01', '5').error, /减免不能超过 ¥30/)
  assert.match(view.couponPayload(wl1, 'off', '0', '5').error, /减免金额要大于 0/)
  assert.match(view.couponPayload(wl2, 'fixed', '100', '5').error, /请选择优惠方式/)      // 万龙双项只开放折扣
  assert.match(view.couponPayload(wl2, 'off', '10', '5').error, /请选择优惠方式/)
  assert.match(view.couponPayload(null, 'fixed', '100', '5').error, /请选择一个项目/)
  assert.match(view.couponPayload(wl1, '', '68', '5').error, /请选择优惠方式/)
  assert.match(view.couponPayload(wl1, 'fixed', '', '5').error, /请填写一口价/)
  assert.match(view.couponPayload(wl1, 'off', '', '5').error, /请填写减免/)
  assert.match(view.couponPayload(wl1, 'rate', '11', '5').error, /折扣填 0.1～10/)
  for (const n of ['0', '51', '1.5', 'abc', '']) assert.match(view.couponPayload(wl1, 'fixed', '68', n).error, /张数填 1～50/)
})

test('管理员设优惠券底价（原来的价格设置）：三种方式各自可空，空 = 没开放；填错给出原因', () => {
  const f = { care: [{ shop: WL, tier: '单项', minFixed: 60, minRate: 0.7, maxOff: 30 }, { shop: CL, tier: '双项', minFixed: 0, minRate: null, maxOff: null }] }
  const cells = view.couponFloorEditCells(f)
  assert.equal(cells.length, 4)
  assert.deepEqual([cells[0].fixedText, cells[0].rateText, cells[0].offText], ['60', '7', '30'])
  assert.deepEqual([cells[3].fixedText, cells[3].rateText, cells[3].offText], ['0', '', ''])     // 一口价 0 是有效的底价，不能当成空
  assert.deepEqual([cells[1].fixedText, cells[1].rateText, cells[1].offText], ['', '', ''])
  const ok = view.couponFloorsPayload(cells)
  assert.deepEqual(ok.care[0], { shop: WL, tier: '单项', min_fixed: 60, min_rate: 0.7, max_off: 30 })
  assert.deepEqual(ok.care[1], { shop: WL, tier: '双项', min_fixed: null, min_rate: null, max_off: null })
  assert.deepEqual(ok.care[3], { shop: CL, tier: '双项', min_fixed: 0, min_rate: null, max_off: null })
  const bad = patch => view.couponFloorsPayload([Object.assign({}, cells[0], patch)])
  assert.match(bad({ rateText: '0' }).error, /最低折扣填 0.1～10/)
  assert.match(bad({ rateText: '11' }).error, /最低折扣填 0.1～10/)
  assert.match(bad({ fixedText: '-5' }).error, /最低一口价不能为负数/)
  assert.match(bad({ offText: '0' }).error, /最高减免要大于 0/)
  assert.match(bad({ offText: 'abc' }).error, /最高减免要大于 0/)
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

test('制作优惠券页：只显示开放的项目；选项目、选方式、定价格、生成；入参正确，成功后刷新最近生成并提示', async t => {
  let state = MAKER()
  const calls = env(t, (p, body) => {
    if (p === 'Distributor/GetMyCouponMaker') return OK(state)
    if (p === 'Distributor/MakeMyCoupons') {
      state = MAKER({ outstanding: 13, recent: [{ templateId: 8, name: '某教练 万龙单项减20元券', count: 10, used: 0, created: '2026-11-15T11:00:00' }].concat(MAKER().recent) })
      return OK({ made: { templateId: 8, name: 'x', memo: '', created: 10, repeated: false }, maker: state })
    }
    throw new Error(p)
  })
  const page = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  page.onLoad(); await settle()
  assert.equal(page.data.canMake, true)
  assert.equal(page.data.validUntil, '2027-04-30')
  assert.deepEqual(page.data.cells.map(c => c.label), ['万龙单项', '万龙双项'])      // 没开放的崇礼格子压根不在列表里
  tapCell(page, 0)
  assert.equal(page.data.sel, 0)
  assert.equal(page.data.mode, '')                                    // 三种方式都开放：让分销商自己选
  assert.deepEqual(page.data.selModes.map(m => m.key), ['fixed', 'rate', 'off'])
  assert.equal(page.data.selHint, '一口价不低于 ¥60，折扣不低于 7 折，减免不超过 ¥30')
  page.onSubmit()                                                     // 没选方式：本地拦下，不发请求
  assert.match(calls.toasts[calls.toasts.length - 1], /优惠方式/)
  page.onMode({ currentTarget: { dataset: { mode: 'off' } } })
  page.onValue({ detail: { value: '40' } })
  page.onSubmit()                                                     // 减免超过上限：本地拦下
  assert.match(calls.toasts[calls.toasts.length - 1], /减免不能超过 ¥30/)
  assert.equal(calls.api.filter(c => c.path.endsWith('MakeMyCoupons')).length, 0)
  page.onValue({ detail: { value: '20' } })
  page.onSubmit(); await settle()
  const make = calls.api.find(c => c.path.endsWith('MakeMyCoupons'))
  assert.equal(make.method, 'POST')
  assert.deepEqual([make.body.shop, make.body.tier, make.body.mode, make.body.value, make.body.count], [WL, '单项', 'off', 20, 10])
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
  assert.equal(page.data.selModes.length, 1)
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

test('制作优惠券页：不是分销商显示拦截；提交中不重复提交；管理员什么都没开放时不显示任何选项', async t => {
  let mode = 'none'
  const calls = env(t, (p) => {
    if (mode === 'none') return { code: 3, message: '你还不是教练或机构' }
    if (p.endsWith('GetMyCouponMaker')) return OK(mode === 'closed' ? MAKER({ cells: [cell(WL, '单项'), cell(WL, '双项'), cell(CL, '单项'), cell(CL, '双项')] }) : MAKER())
    return OK({ made: { created: 1, repeated: false }, maker: MAKER() })
  })
  const none = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  none.onLoad(); await settle()
  assert.equal(none.data.blocked, '你还不是教练或机构')

  mode = 'closed'
  const closed = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  closed.onLoad(); await settle()
  assert.deepEqual(closed.data.cells, [])
  assert.match(fs.readFileSync(path.join(ROOT, 'pages/coach/coupon_maker/coupon_maker.wxml'), 'utf8'), /管理员还没有给你开放优惠券的项目/)
  closed.onSubmit()
  assert.equal(calls.api.filter(c => c.path.endsWith('MakeMyCoupons')).length, 0)

  mode = 'org'
  const org = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  org.onLoad(); await settle()
  tapCell(org, 0); org.onMode({ currentTarget: { dataset: { mode: 'fixed' } } }); org.onValue({ detail: { value: '68' } })
  org.onSubmit(); org.onSubmit()                                      // 连点两下
  await settle()
  assert.equal(calls.api.filter(c => c.path.endsWith('MakeMyCoupons')).length, 1)
})

test('制作优惠券页的文件齐全，wxml 里的事件处理函数都在页面里；页面不再有「灰色」的未开放项', () => {
  const dir = 'pages/coach/coupon_maker/coupon_maker'
  for (const ext of ['js', 'wxml', 'json', 'wxss']) assert.ok(fs.existsSync(path.join(ROOT, dir + '.' + ext)), ext)
  JSON.parse(fs.readFileSync(path.join(ROOT, dir + '.json'), 'utf8'))
  const wxml = fs.readFileSync(path.join(ROOT, dir + '.wxml'), 'utf8')
  const js = fs.readFileSync(path.join(ROOT, dir + '.js'), 'utf8')
  for (const m of wxml.matchAll(/bind(?:tap|input)="(\w+)"/g)) assert.match(js, new RegExp('\\b' + m[1] + '\\s*\\('), m[1])
  assert.doesNotMatch(wxml, /灰色|item\.available/)
})

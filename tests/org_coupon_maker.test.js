// 分销商（教练 / KOL / 机构）制作优惠券（小程序）：按管理员设的「优惠券底价」做分享批次（用户 2026-11-18：每做一次 = 一个批次，规定张数，
// 创建时不生成券，二维码 / 小程序卡片分享，领取时才生成），一口价 / 折扣 / 减免三种方式，
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
  canMake: true, reason: '', name: '某教练', validUntil: '2027-04-30T00:00:00', maxBatchSize: 500, maxOpenCapacity: 1000,
  cells: [
    cell(WL, '单项', { open: true, productReady: true, modes: ['fixed', 'rate', 'off'], minFixed: 60, minRate: 0.7, maxOff: 30 }),
    cell(WL, '双项', { open: true, productReady: true, modes: ['rate'], minRate: 0.7 }),
    cell(CL, '单项', { open: true, productReady: false, modes: ['fixed'], minFixed: 100 }),     // 开放了，但这家店没配养护价目
    cell(CL, '双项')],                                                                          // 没开放
  batches: []
}, over)
const BATCH = over => Object.assign({
  id: 5, templateId: 7, name: '某教练 万龙单项68元一口价券', memo: '凭券做养护', total: 10, claimed: 0, remaining: 10, soldOut: false, canDelete: true,
  sharePath: '/pages/coach/coupon_claim/coupon_claim?c=aaaaaaaaaaaaaaaaaaaaaaaa', createDate: '2026-11-18T10:00:00', claimers: []
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

test('本地校验：一口价不能低于、折扣不能低于、减免不能超过；没开放的方式不能选；张数 1～上限；刚好等于底价可以', () => {
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
  // 批次的张数上限来自服务端（500）
  assert.deepEqual(view.couponPayload(wl1, 'fixed', '68', '500', 500), { shop: WL, tier: '单项', mode: 'fixed', value: 68, count: 500 })
  assert.match(view.couponPayload(wl1, 'fixed', '68', '501', 500).error, /张数填 1～500/)
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
  const calls = { api: [], toasts: [], nav: [], modals: [], downloads: [] }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk', requestPrefix: PREFIX } })
  global.wx = {
    showToast: o => calls.toasts.push(o.title), showModal: o => { calls.modals.push([o.title, o.content]); o.success({ confirm: true }) },
    stopPullDownRefresh() {}, navigateTo: o => calls.nav.push(o.url), hideShareMenu() {},
    createCanvasContext: () => ({ drawImage() {}, setTextAlign() {}, setTextBaseline() {}, setFillStyle() {}, setFontSize() {}, measureText: t => ({ width: t.length * 30 }), fillText() {}, draw(_, done) { setImmediate(done) } }),
    canvasToTempFilePath: o => setImmediate(() => o.success({ tempFilePath: 'wxfile://cover.jpg' }))
  }
  api.setTransport(options => {
    const [pathPart] = options.url.replace(PREFIX, '').split('?')
    calls.api.push({ path: pathPart, method: options.method, body: options.data })
    setImmediate(() => options.success({ statusCode: 200, data: handler(pathPart, options.data, calls) }))
  })
  t.after(() => { delete global.getApp; delete global.wx; api.setTransport(function (o) { wx.request(o) }) })
  return calls
}
const tapCell = (page, i) => page.onCell({ currentTarget: { dataset: { i } } })
const CREATE = 'Distributor/CreateMyCouponBatch'

test('制作优惠券页：只显示开放的项目；选项目、选方式、定价格、定张数、创建批次；入参正确，成功后刷新批次并提示（不生成券）', async t => {
  let state = MAKER()
  const calls = env(t, (p, body) => {
    if (p === 'Distributor/GetMyCouponMaker') return OK(state)
    if (p === CREATE) {
      state = MAKER({ batches: [BATCH({ id: 6, total: 20, remaining: 20, name: '某教练 万龙单项减20元券' })] })
      return OK({ made: { id: 6, total: 20, repeated: false, sharePath: '/pages/coach/coupon_claim/coupon_claim?c=bbbbbbbbbbbbbbbbbbbbbbbb' }, maker: state })
    }
    throw new Error(p)
  })
  const page = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  page.onLoad(); await settle()
  assert.equal(page.data.canMake, true)
  assert.equal(page.data.validUntil, '2027-04-30')
  assert.deepEqual(page.data.cells.map(c => c.label), ['万龙单项', '万龙双项'])      // 没开放的崇礼格子压根不在列表里
  assert.equal(page.data.maxBatchSize, 500)
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
  page.onValue({ detail: { value: '20' } })
  page.onCount({ detail: { value: '501' } })
  page.onSubmit()                                                     // 张数超过批次上限
  assert.match(calls.toasts[calls.toasts.length - 1], /张数填 1～500/)
  assert.equal(calls.api.filter(c => c.path === CREATE).length, 0)
  page.onCount({ detail: { value: '20' } })
  page.onSubmit(); await settle()
  const make = calls.api.find(c => c.path === CREATE)
  assert.equal(make.method, 'POST')
  assert.deepEqual([make.body.shop, make.body.tier, make.body.mode, make.body.value, make.body.count], [WL, '单项', 'off', 20, 20])
  assert.match(make.body.requestId, /^c\d+/)
  assert.ok(!calls.api.some(c => c.path.endsWith('MakeMyCoupons')), '不再一次性生成券')
  assert.deepEqual(page.data.batches.map(b => [b.id, b.total]), [[6, 20]])
  assert.equal(page.data.submitting, false)
  assert.ok(calls.toasts.includes('已创建批次，在下面分享二维码或小程序卡片'))
  page.onGoCoupons()
  assert.deepEqual(calls.nav, ['/pages/coach/home/home?tab=coupons'])
})

test('制作优惠券页：只开放一种方式的格子自动选好；同一份表单重试用同一个请求编号，改了表单才换', async t => {
  let attempts = 0
  const calls = env(t, (p) => {
    if (p === 'Distributor/GetMyCouponMaker') return OK(MAKER())
    attempts++
    return attempts === 1 ? { code: 1, message: '服务暂时繁忙' } : OK({ made: { id: 6, total: 5, repeated: attempts === 3 }, maker: MAKER() })
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
  const ids = calls.api.filter(c => c.path === CREATE).map(c => c.body.requestId)
  assert.equal(ids.length, 2)
  assert.equal(ids[0], ids[1])
  page.onValue({ detail: { value: '7.5' } })                          // 改了表单：换新编号
  page.onSubmit(); await settle()
  const ids2 = calls.api.filter(c => c.path === CREATE).map(c => c.body.requestId)
  assert.notEqual(ids2[2], ids[0])
  assert.ok(calls.toasts.includes('这个批次之前已经创建过了'))          // 服务端说是重复提交
})

test('只设置了一口价底价（0 元起）的分销商：优惠券页只有一口价，自动选好，没有折扣和减免；一口价 0 元可以', async t => {
  const onlyFixed = (shop, tier) => cell(shop, tier, { open: true, productReady: true, modes: ['fixed'], minFixed: 0 })
  const state = MAKER({ cells: [onlyFixed(WL, '单项'), onlyFixed(WL, '双项'), onlyFixed(CL, '单项'), onlyFixed(CL, '双项')] })
  const calls = env(t, (p) => p === 'Distributor/GetMyCouponMaker' ? OK(state) : OK({ made: { id: 6, total: 10, repeated: false }, maker: state }))
  const page = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  page.onLoad(); await settle()
  assert.equal(page.data.cells.length, 4)
  assert.ok(page.data.cells.every(c => c.modes.length === 1 && c.modes[0].key === 'fixed'))
  tapCell(page, 0)
  assert.equal(page.data.mode, 'fixed')                               // 只有一种方式：自动选好
  assert.deepEqual(page.data.selModes.map(m => m.label), ['一口价'])  // 页面不会出现折扣、减免
  assert.equal(page.data.selHint, '一口价不低于 ¥0')
  page.onValue({ detail: { value: '0' } })
  page.onSubmit(); await settle()
  const make = calls.api.find(c => c.path === CREATE)
  assert.deepEqual([make.body.mode, make.body.value], ['fixed', 0])
})

test('制作优惠券页：不是分销商显示拦截；提交中不重复提交；管理员什么都没开放时不显示任何选项', async t => {
  let mode = 'none'
  const calls = env(t, (p) => {
    if (mode === 'none') return { code: 3, message: '你还不是教练或机构' }
    if (p.endsWith('GetMyCouponMaker')) return OK(mode === 'closed' ? MAKER({ cells: [cell(WL, '单项'), cell(WL, '双项'), cell(CL, '单项'), cell(CL, '双项')] }) : MAKER())
    return OK({ made: { id: 6, total: 10, repeated: false }, maker: MAKER() })
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
  assert.equal(calls.api.filter(c => c.path === CREATE).length, 0)

  mode = 'org'
  const org = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  org.onLoad(); await settle()
  tapCell(org, 0); org.onMode({ currentTarget: { dataset: { mode: 'fixed' } } }); org.onValue({ detail: { value: '68' } })
  org.onSubmit(); org.onSubmit()                                      // 连点两下
  await settle()
  assert.equal(calls.api.filter(c => c.path === CREATE).length, 1)
})

// ---------- 批次：进度、领取记录、二维码、小程序卡片、删除 ----------

test('批次列表：领取进度、状态、默认折叠的领取记录（领取人头像昵称、券码、有没有用）', async t => {
  const claimed = BATCH({ id: 4, name: '某教练 万龙单项减20元券', total: 2, claimed: 2, remaining: 0, soldOut: true, canDelete: false, createDate: '2026-11-17T09:00:00', claimers: [
    { memberId: 3, ticketCode: 'AB12CD34E', claimedAt: '2026-11-18T10:30:00', used: true, nickName: '雪友小A', avatarUrl: 'https://img.snowmeet.top/upload/20261118/a.jpg', name: '学员A', phoneTail: '1003' },
    { memberId: 4, ticketCode: 'ZZ99YY88X', claimedAt: '2026-11-18T10:20:00', used: false, nickName: null, avatarUrl: null, name: '学员B', phoneTail: '1004' }
  ] })
  env(t, (p) => p === 'Distributor/GetMyCouponMaker' ? OK(MAKER({ batches: [BATCH({ id: 5, total: 10, claimed: 3, remaining: 7, claimers: [] }), claimed] })) : null)
  const page = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  page.onLoad(); page.onReady(); await settle()
  const [open, done] = page.data.batches
  assert.deepEqual([open.statusText, open.tone, open.progress, open.canDelete], ['领取中', 'ok', '已领 3 / 10 张', true])
  assert.deepEqual([done.statusText, done.tone, done.progress, done.canDelete], ['已领完', 'muted', '已领 2 / 2 张', false])
  assert.equal(open.created, '11-18 10:00')
  assert.deepEqual(page.data.expanded, {}, '领取记录默认折叠')
  assert.deepEqual(done.claimers.map(c => [c.nickName, c.avatarUrl, c.codeTail, c.used, c.claimed]),
    [['雪友小A', 'https://img.snowmeet.top/upload/20261118/a.jpg', 'D34E', true, '11-18 10:30'], ['学员B', '', 'Y88X', false, '11-18 10:20']])
  assert.equal(done.claimers[1].initial, '学')                                   // 没有昵称头像：用真实姓名首字
  page.onToggleClaimers({ currentTarget: { dataset: { id: 4 } } }); assert.equal(page.data.expanded.c4, true)
  page.onToggleClaimers({ currentTarget: { dataset: { id: 4 } } }); assert.equal(page.data.expanded.c4, false)
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/coach/coupon_maker/coupon_maker.wxml'), 'utf8')
  assert.match(wxml, /bindtap="onToggleClaimers"/); assert.match(wxml, /wx:if="\{\{expanded\['c' \+ item\.id\]\}\}"/, '展开了才渲染记录')
  assert.match(wxml, /rec\.avatarUrl/); assert.match(wxml, /rec\.nickName/)
})

test('批次：分享二维码是这个批次自己的码（带登录态和小程序版本）；分享小程序卡片用批次的领取路径，不新建任何东西', async t => {
  const calls = env(t, (p) => p === 'Distributor/GetMyCouponMaker' ? OK(MAKER({ batches: [BATCH()] })) : null)
  const page = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  page.onLoad(); page.onReady(); await settle()
  const row = page.data.batches[0]
  assert.equal(row.coverPath, 'wxfile://cover.jpg')                               // 封面按券名生成
  page.onViewQr({ currentTarget: { dataset: { id: row.id, name: row.name } } })
  assert.equal(page.data.qr.show, true); assert.equal(page.data.qr.batchId, 5); assert.equal(page.data.qr.name, row.name)
  assert.match(page.data.qr.url, /^https:\/\/x\/api\/Distributor\/GetCouponBatchQr\?sessionKey=sk&batchId=5&envVersion=release&_=\d+$/)
  page.onQrError(); assert.match(page.data.qr.error, /重试/)
  page.onQrRetry(); assert.equal(page.data.qr.error, ''); assert.equal(page.data.qr.loading, true); assert.match(page.data.qr.url, /batchId=5/)
  page.onQrLoad(); assert.equal(page.data.qr.loading, false)
  page.onQrClose(); assert.equal(page.data.qr.show, false)
  // 小程序卡片：路径就是这个批次的领取路径；每次转发都是同一个批次，不调任何建批次的接口
  const share = page.onShareAppMessage({ target: { dataset: { path: row.sharePath, name: row.name, cover: row.coverPath } } })
  assert.deepEqual(share, { title: '送你一张' + row.name, path: '/pages/coach/coupon_claim/coupon_claim?c=aaaaaaaaaaaaaaaaaaaaaaaa', imageUrl: 'wxfile://cover.jpg' })
  assert.equal(share.promise, undefined)
  assert.equal(page.onShareAppMessage({}).path, '/pages/coach/coupon_claim/coupon_claim', '没有批次路径时不带 token，领取页会提示链接不完整')
  assert.ok(!calls.api.some(c => c.path === CREATE))
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/coach/coupon_maker/coupon_maker.wxml'), 'utf8')
  assert.match(wxml, /bindtap="onViewQr"[^>]*>分享二维码</); assert.match(wxml, /open-type="share"[^>]*>分享小程序卡片</)
})

test('批次：没人领取过的有「删除」，确认后调接口并刷新；领取过的没有；服务端拒绝时提示原因', async t => {
  let batches = [BATCH({ id: 5 }), BATCH({ id: 4, claimed: 1, remaining: 9, canDelete: false, claimers: [{ memberId: 3, ticketCode: 'AB12CD34E', claimedAt: '2026-11-18T10:30:00', used: false, name: '学员A' }] })]
  let refuse = false
  const calls = env(t, (p, body) => {
    if (p === 'Distributor/GetMyCouponMaker') return OK(MAKER({ batches }))
    if (p === 'Distributor/DeleteMyCouponBatch') {
      if (refuse) return { code: 1, message: '这个批次已经有 1 位顾客领取过，不能删除' }
      batches = batches.filter(b => b.id !== body.id); return OK({ id: body.id })
    }
    throw new Error(p)
  })
  const page = loadPage('pages/coach/coupon_maker/coupon_maker.js', {})
  page.onLoad(); page.onReady(); await settle()
  assert.deepEqual(page.data.batches.map(b => [b.id, b.canDelete]), [[5, true], [4, false]])
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/coach/coupon_maker/coupon_maker.wxml'), 'utf8')
  assert.match(wxml, /wx:if="\{\{item\.canDelete\}\}"[^>]*bindtap="onDeleteBatch"[^>]*>删除</)
  await page.onDeleteBatch({ currentTarget: { dataset: { id: 5 } } }); await settle()
  assert.deepEqual(calls.modals[0], ['删除这个批次', '删除后，这个批次的二维码和小程序卡片都不能再领取，不能恢复。'])
  assert.deepEqual(calls.api.filter(c => c.path === 'Distributor/DeleteMyCouponBatch').map(c => [c.method, c.body]), [['POST', { id: 5 }]])
  assert.deepEqual(page.data.batches.map(b => b.id), [4])
  assert.ok(calls.toasts.includes('已删除'))
  // 被拒绝（刚好有人领取了）：提示原因并刷新
  refuse = true
  const before = calls.api.filter(c => c.path === 'Distributor/GetMyCouponMaker').length
  await page.onDeleteBatch({ currentTarget: { dataset: { id: 4 } } }); await settle()
  assert.match(calls.toasts.at(-1), /已经有 1 位顾客领取过/)
  assert.equal(calls.api.filter(c => c.path === 'Distributor/GetMyCouponMaker').length, before + 1)
})

test('制作优惠券页的文件齐全，wxml 里的事件处理函数都在页面里；页面不再有「灰色」的未开放项，也不再一次性生成券', () => {
  const dir = 'pages/coach/coupon_maker/coupon_maker'
  for (const ext of ['js', 'wxml', 'json', 'wxss']) assert.ok(fs.existsSync(path.join(ROOT, dir + '.' + ext)), ext)
  JSON.parse(fs.readFileSync(path.join(ROOT, dir + '.json'), 'utf8'))
  const wxml = fs.readFileSync(path.join(ROOT, dir + '.wxml'), 'utf8')
  const js = fs.readFileSync(path.join(ROOT, dir + '.js'), 'utf8')
  for (const m of wxml.matchAll(/bind(?:tap|input)="(\w+)"/g)) assert.match(js, new RegExp('\\b' + m[1] + '\\s*\\('), m[1])
  assert.doesNotMatch(wxml, /灰色|item\.available|生成并放进我的券包|最近生成的券/)
  assert.doesNotMatch(js, /makeMyCoupons/)
})

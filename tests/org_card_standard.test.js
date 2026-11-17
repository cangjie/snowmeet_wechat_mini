// 机构自己制作会员卡（小程序）：表单模型 / 底价提示 / 保存前本地校验、「制作会员卡」页、管理员「底价」标签。
// 设计：snowmeet_ai_doc/docs/superpowers/specs/2026-11-15-distributor-backend-design.md「三」
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const api = require('../pages/coach/common/api.js')
const view = require('../pages/coach/common/coach-view.js')
const { loadPage } = require('./reception_harness.js')
// 页面里是 请求 → setImmediate → 多层 promise；机器忙时 10ms 不稳，这里等久一点
const settle = () => new Promise(r => setTimeout(r, 60))

const ROOT = path.join(__dirname, '..')
const PREFIX = 'https://x/api/'
const WL = '万龙服务中心', CL = '崇礼旗舰店'

const cell = (shop, tier, extra) => Object.assign({ shop, tier, mode: 'none', value: 0, open: false, minRate: null, minFixed: null, belowFloor: false }, extra)
const STANDARD = over => Object.assign({
  canEdit: true, reason: '', name: '某某机构', validUntil: '2027-04-30T00:00:00',
  cells: [cell(WL, '单项', { open: true, minRate: 0.7, mode: 'rate', value: 0.8 }), cell(WL, '双项'),
    cell(CL, '单项', { open: true, minFixed: 60 }), cell(CL, '双项')],
  rental: { rate: 0.9, open: true, minRate: 0.8, belowFloor: false }
}, over)

test('底价提示：未开放 / 只折扣 / 只一口价 / 两者都有', () => {
  assert.equal(view.floorHint(cell(WL, '双项')), '管理员未开放')
  assert.equal(view.floorHint({ open: true, minRate: 0.7, minFixed: null }), '折扣不低于 7 折')
  assert.equal(view.floorHint({ open: true, minRate: null, minFixed: 60 }), '一口价不低于 ¥60')
  assert.equal(view.floorHint({ open: true, minRate: 0.75, minFixed: 59.5 }), '折扣不低于 7.5 折，一口价不低于 ¥59.5')
})

test('编辑模型：固定 4 格带底价；租赁带底价提示', () => {
  const cells = view.standardCells(STANDARD().cells)
  assert.deepEqual(cells.map(c => c.key), [WL + '单项', WL + '双项', CL + '单项', CL + '双项'])
  assert.deepEqual([cells[0].mode, cells[0].text, cells[0].open, cells[0].hint], ['rate', '8', true, '折扣不低于 7 折'])
  assert.deepEqual([cells[1].open, cells[1].hint], [false, '管理员未开放'])
  assert.equal(view.rentalStandard(STANDARD().rental).hint, '折扣不低于 8 折')
  assert.equal(view.rentalStandard(STANDARD().rental).text, '9')
  assert.equal(view.rentalStandard({ rate: null, open: false, minRate: null }).hint, '管理员未开放')
})

test('保存前本地校验：不能低于底价、不能设没开放的格子、方式要对；刚好等于底价可以', () => {
  const rental = view.rentalStandard(STANDARD().rental)
  const edit = (patch) => {
    const cells = view.standardCells(STANDARD().cells).map(c => Object.assign({}, c))
    Object.keys(patch).forEach(k => Object.assign(cells.find(c => c.key === k), patch[k]))
    return cells
  }
  const ok = view.standardPayload(edit({ [WL + '单项']: { mode: 'rate', text: '7' }, [CL + '单项']: { mode: 'fixed', text: '60' } }), '8', rental)
  assert.equal(ok.error, undefined)
  assert.deepEqual(ok.care.map(c => [c.mode, c.value]), [['rate', 0.7], ['none', 0], ['fixed', 60], ['none', 0]])
  assert.equal(ok.rate, 0.8)
  assert.match(view.standardPayload(edit({ [WL + '单项']: { mode: 'rate', text: '6.9' } }), '', rental).error, /万龙单项：折扣不能低于 7 折/)
  assert.match(view.standardPayload(edit({ [WL + '双项']: { mode: 'rate', text: '9' } }), '', rental).error, /万龙双项：管理员还没有开放/)
  // 崇礼单项只开放了一口价：填的数一律按一口价算（没有折扣可选），低于底价被拦
  assert.match(view.standardPayload(edit({ [CL + '单项']: { mode: 'rate', text: '9' } }), '', rental).error, /崇礼单项：一口价不能低于 ¥60/)
  assert.match(view.standardPayload(edit({ [CL + '单项']: { mode: 'fixed', text: '59' } }), '', rental).error, /崇礼单项：一口价不能低于 ¥60/)
  assert.match(view.standardPayload(edit({}), '7.5', rental).error, /租赁：折扣不能低于 8 折/)
  assert.match(view.standardPayload(edit({}), '9', view.rentalStandard({ rate: null, open: false })).error, /租赁：管理员还没有开放/)
  assert.equal(view.standardPayload(edit({}), '', view.rentalStandard({ rate: null, open: false })).rate, null)   // 不优惠总可以
  // 留空 = 不优惠（不再有「无」按钮，也不再提示「请填写」）
  const blank = view.standardPayload(edit({ [WL + '单项']: { mode: 'rate', text: '' } }), '', rental)
  assert.equal(blank.error, undefined)
  assert.equal(blank.care[0].mode, 'none')
  // 一个格子开放了不止一种方式却没选：要求先选
  const both = edit({}); both[0] = Object.assign({}, both[0], { modes: [{ key: 'fixed', label: '一口价' }, { key: 'rate', label: '折扣' }], minFixed: 100, mode: 'none', text: '120' })
  assert.match(view.standardPayload(both, '', rental).error, /万龙单项：请选择一口价或折扣/)
})

test('管理员底价：空 = 不开放；折扣按折填、一口价按元；填错给出原因', () => {
  const f = { care: [{ shop: WL, tier: '单项', minRate: 0.7, minFixed: null }, { shop: CL, tier: '双项', minRate: null, minFixed: 100 }], rentalMinRate: 0.8 }
  const cells = view.floorEditCells(f)
  assert.equal(cells.length, 4)
  assert.deepEqual([cells[0].rateText, cells[0].fixedText, cells[3].rateText, cells[3].fixedText], ['7', '', '', '100'])
  assert.equal(view.floorRentalText(f), '8')
  assert.equal(view.floorRentalText({}), '')
  const ok = view.floorsPayload(cells, '8')
  assert.deepEqual(ok.care[0], { shop: WL, tier: '单项', min_rate: 0.7, min_fixed: null })
  assert.deepEqual(ok.care[1], { shop: WL, tier: '双项', min_rate: null, min_fixed: null })
  assert.deepEqual(ok.care[3], { shop: CL, tier: '双项', min_rate: null, min_fixed: 100 })
  assert.equal(ok.rentalMinRate, 0.8)
  assert.equal(view.floorsPayload(cells, '').rentalMinRate, null)
  const bad = rate => view.floorsPayload([Object.assign({}, cells[0], { rateText: rate })], '')
  assert.match(bad('0').error, /最低折扣填 0.1～10/)
  assert.match(bad('11').error, /最低折扣填 0.1～10/)
  assert.match(view.floorsPayload([Object.assign({}, cells[0], { fixedText: '-5' })], '').error, /最低一口价不能为负数/)
  assert.match(view.floorsPayload(cells, '12').error, /租赁：最低折扣/)
})

function env(t, handler) {
  const calls = { api: [], toasts: [] }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk', requestPrefix: PREFIX, staff: { valid: 1, title_level: 300 } } })
  global.wx = { showToast: o => calls.toasts.push(o.title), showModal() {}, stopPullDownRefresh() {}, setNavigationBarTitle() {}, hideShareMenu() {} }
  api.setTransport(options => {
    const [pathPart, query] = options.url.replace(PREFIX, '').split('?')
    calls.api.push({ path: pathPart, method: options.method, body: options.data, query })
    setImmediate(() => options.success({ statusCode: 200, data: handler(pathPart, options.data) }))
  })
  t.after(() => { delete global.getApp; delete global.wx; api.setTransport(function (o) { wx.request(o) }) })
  return calls
}
const OK = data => ({ code: 0, message: '', data })

test('机构创建具名卡种并按底价校验，保存后显示在卡种列表', async t => {
  let templates = []
  const calls = env(t, (p, body) => {
    if (p === 'Coach/ListMyCards') return OK({ cards: [] })
    if (p === 'Distributor/ListMyCardTemplates') return OK({ templates })
    if (p === 'Distributor/GetMyCardTemplate') return OK(STANDARD({ name: '' }))
    if (p === 'Distributor/SaveMyCardTemplate') {
      templates = [{ id: 1, name: body.name, carePrices: body.care, rentalRate: body.rental_rate }]
      return OK({ id: 1 })
    }
    throw new Error(p)
  })
  const page = loadPage('pages/coach/card_standard/card_standard.js', {})
  page.onLoad(); await settle()
  assert.equal(page.data.templates.length, 0)
  await page.onNew()
  assert.equal(page.data.cells[0].hint, '折扣不低于 7 折')
  // 管理员没开放的格子根本不显示；开放的格子只显示底价里设置了的方式
  assert.deepEqual(page.data.cells.map(c => c.visible), [true, false, true, false])
  assert.deepEqual(page.data.cells[0].modes.map(m => m.key), ['rate'])
  page.onMode({ currentTarget: { dataset: { i: 1, mode: 'rate' } } })
  assert.equal(page.data.cells[1].mode, 'none')
  assert.equal(page.data.dirty, false)
  page.onName({ detail: { value: '学员卡' } })
  page.onCellText({ currentTarget: { dataset: { i: 0 } }, detail: { value: '6' } })
  page.onSave()
  assert.match(calls.toasts.at(-1), /折扣不能低于 7 折/)
  assert.equal(calls.api.filter(c => c.path.endsWith('SaveMyCardTemplate')).length, 0)
  page.onCellText({ currentTarget: { dataset: { i: 0 } }, detail: { value: '7.5' } })
  page.onRentalText({ detail: { value: '8.5' } })
  page.onSave(); await settle()
  const save = calls.api.find(c => c.path.endsWith('SaveMyCardTemplate'))
  assert.equal(save.method, 'POST'); assert.equal(save.body.name, '学员卡')
  assert.equal(save.body.care[0].value, 0.75); assert.equal(save.body.rental_rate, 0.85)
  assert.equal(page.data.editing, false); assert.equal(page.data.templates[0].name, '学员卡')
})

test('无机构身份被拦；保存被服务端拒绝后保留编辑内容', async t => {
  let mode = 'none'
  const calls = env(t, p => {
    if (mode === 'none') return { code: 3, message: '你还不是教练或机构' }
    if (p.endsWith('ListMyCardTemplates')) return OK({ templates: [] })
    if (p.endsWith('GetMyCardTemplate')) return OK(STANDARD({ name: '教练卡' }))
    return { code: 1, message: '万龙服务中心 单项：折扣不能低于 7 折' }
  })
  const page = loadPage('pages/coach/card_standard/card_standard.js', {})
  page.onLoad(); await settle(); assert.equal(page.data.blocked, '你还不是教练或机构')
  mode = 'reject'; await page.load(); await page.onNew()
  page.onCellText({ currentTarget: { dataset: { i: 0 } }, detail: { value: '7' } })
  page.onSave(); await settle()
  assert.equal(page.data.saving, false); assert.equal(page.data.dirty, true)
  assert.match(calls.toasts.at(-1), /折扣不能低于 7 折/)
})

test('管理员分销商详情：机构才有「会籍卡底价」标签；加载、改、保存带正确入参', async t => {
  let floor = { care: [{ shop: WL, tier: '单项', minRate: 0.7, minFixed: null }, { shop: WL, tier: '双项', minRate: null, minFixed: null },
    { shop: CL, tier: '单项', minRate: null, minFixed: 60 }, { shop: CL, tier: '双项', minRate: null, minFixed: null }], rentalMinRate: 0.8 }
  const COACH = introducerType => ({ id: 9, memberId: 6, name: '某机构', valid: true, phoneTail: '1006', introducerType, rentalRate: null, carePrices: [], cards: { total: 0, issued: 0, claimed: 0, revoked: 0 } })
  const calls = env(t, (p, body) => {
    if (p === 'CoachAdmin/GetCoach') return OK(COACH('机构'))
    if (p === 'CoachAdmin/GetCouponFloors') return OK({ care: [] })           // 默认先开「优惠券底价」标签
    if (p === 'CoachAdmin/GetCoachFloors') return OK(floor)
    if (p === 'CoachAdmin/SetCoachFloors') { floor = { care: body.care.map(c => ({ shop: c.shop, tier: c.tier, minRate: c.min_rate, minFixed: c.min_fixed })), rentalMinRate: body.rental_min_rate }; return OK(floor) }
    throw new Error(p)
  })
  const page = loadPage('pages/coach/admin/detail/detail.js', {})
  page.onLoad({ id: '9' }); await settle()
  page.onTab({ currentTarget: { dataset: { tab: 'floor' } } }); await settle()
  assert.deepEqual(page.data.floorCells.map(c => [c.rateText, c.fixedText]), [['7', ''], ['', ''], ['', '60'], ['', '']])
  assert.equal(page.data.floorRentalText, '8')
  page.onFloorRate({ currentTarget: { dataset: { i: 1 } }, detail: { value: '8' } })
  page.onFloorFixed({ currentTarget: { dataset: { i: 3 } }, detail: { value: '120' } })
  page.onFloorRental({ detail: { value: '' } })
  assert.equal(page.data.floorDirty, true)
  page.onFloorSave(); await settle()
  const save = calls.api.find(c => c.path === 'CoachAdmin/SetCoachFloors')
  assert.equal(save.body.coachId, 9)
  assert.deepEqual(save.body.care.map(c => [c.min_rate, c.min_fixed]), [[0.7, null], [0.8, null], [null, 60], [null, 120]])
  assert.equal(save.body.rental_min_rate, null)
  assert.equal(page.data.floorDirty, false)
  // 填错不发请求
  page.onFloorRate({ currentTarget: { dataset: { i: 0 } }, detail: { value: '15' } })
  page.onFloorSave()
  assert.equal(calls.api.filter(c => c.path === 'CoachAdmin/SetCoachFloors').length, 1)
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/coach/admin/detail/detail.wxml'), 'utf8')
  assert.match(wxml, /wx:if="\{\{coach\.introducerType === '机构'\}\}"[^>]*data-tab="floor"/)
})

test('制作会员卡页的 wxml / json / wxss 齐全，事件处理函数都在页面里', () => {
  const dir = 'pages/coach/card_standard/card_standard'
  for (const ext of ['js', 'wxml', 'json', 'wxss']) assert.ok(fs.existsSync(path.join(ROOT, dir + '.' + ext)), ext)
  JSON.parse(fs.readFileSync(path.join(ROOT, dir + '.json'), 'utf8'))
  const wxml = fs.readFileSync(path.join(ROOT, dir + '.wxml'), 'utf8')
  const js = fs.readFileSync(path.join(ROOT, dir + '.js'), 'utf8')
  for (const m of wxml.matchAll(/bind(?:tap|input)="(\w+)"/g)) assert.match(js, new RegExp('\\b' + m[1] + '\\s*\\('), m[1])
})

// ---------- 卡种列表：分享二维码 / 分享小程序卡片（用户 2026-11-17），每次分享记一条 ----------
const SHARE_CARD = { id: 9, name: '教练卡', carePrices: [], rentalRate: null }
function shareEnv(t, over) {
  const state = { cards: [], seq: 0 }
  const calls = env(t, (p, body) => {
    if (over && over[p]) return over[p](body, state)
    if (p === 'Distributor/ListMyCardTemplates') return OK({ templates: [SHARE_CARD] })
    if (p === 'Coach/ListMyCards') return OK({ cards: state.cards.filter(c => c.status !== 'revoked' || c.memberId).map(card => ({ card, sharePath: card.status === 'issued' ? '/pages/coach/claim/claim?t=tok' + card.id : null })), counts: {} })
    if (p === 'Coach/CreateCard') {
      state.seq++
      state.cards.unshift({ id: state.seq, status: 'issued', templateId: body.templateId, cardName: body.templateId === 9 ? '教练卡' : '', channel: body.channel, createDate: '2026-11-17T10:0' + state.seq + ':00' })
      return OK({ cardId: state.seq, cardName: '教练卡', tokenTail: 'AB0' + state.seq, sharePath: '/pages/coach/claim/claim?t=unique000' + state.seq, channel: body.channel })
    }
    if (p === 'Coach/RevokeMyCard') { state.cards.find(c => c.id === body.cardId).status = 'revoked'; return OK({ cardId: body.cardId }) }
    throw new Error(p)
  })
  global.wx.showModal = o => o.success({ confirm: true })
  global.wx.createCanvasContext = () => {
    let words = ''
    return { drawImage() {}, setTextAlign() {}, setTextBaseline() {}, setFillStyle() {}, setFontSize() {},
      measureText(text) { return { width: text.length * 30 } }, fillText(text) { words += text },
      draw(_, done) { state.drawn = words; setImmediate(done) } }
  }
  global.wx.canvasToTempFilePath = o => setImmediate(() => o.success({ tempFilePath: 'wxfile://' + state.drawn }))
  return { calls, state }
}

test('卡种列表：每个卡种只有「分享二维码」和「分享小程序卡片」两个按钮，没有「生成分享卡」，也没有旧的待分享列表', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/coach/card_standard/card_standard.wxml'), 'utf8')
  assert.match(wxml, /bindtap="onShareQr"[^>]*>分享二维码</)
  assert.match(wxml, /open-type="share"[^>]*>分享小程序卡片</)
  assert.doesNotMatch(wxml, /生成分享卡|onCreateShare|onRevokePending|待分享 \/ 待领取/)
  const js = fs.readFileSync(path.join(ROOT, 'pages/coach/card_standard/card_standard.js'), 'utf8')
  assert.doesNotMatch(js, /onCreateShare|onRevokePending|loadPending/)
})

test('分享小程序卡片：选好转发对象时才记一次分享，路径来自服务端；每次都是新的一张；封面使用卡种名', async t => {
  const { calls, state } = shareEnv(t)
  const page = loadPage('pages/coach/card_standard/card_standard.js', {})
  page.onLoad(); page.onReady(); await settle()
  const row = page.data.templates[0]
  assert.equal(row.coverPath, 'wxfile://教练卡')
  assert.equal(calls.api.filter(c => c.path === 'Coach/CreateCard').length, 0, '只是列出卡种，不记分享')
  const target = { target: { dataset: { id: row.id, name: row.name, cover: row.coverPath } } }

  const first = page.onShareAppMessage(target)
  assert.equal(first.title, '送你一张教练卡'); assert.equal(first.imageUrl, 'wxfile://教练卡')
  assert.equal(first.path, '/pages/coach/claim/claim', '服务端没回之前（或超时）的兜底路径没有 token，不会被人领走')
  assert.deepEqual(await first.promise, { title: '送你一张教练卡', path: '/pages/coach/claim/claim?t=unique0001', imageUrl: 'wxfile://教练卡' })
  const second = await page.onShareAppMessage(target).promise
  assert.equal(second.path, '/pages/coach/claim/claim?t=unique0002')
  assert.deepEqual(calls.api.filter(c => c.path === 'Coach/CreateCard').map(c => [c.body.templateId, c.body.channel]), [[9, 'card'], [9, 'card']])
  await settle()
  assert.deepEqual(page.data.shareRows[9].map(r => [r.id, r.channelText, r.statusText]), [[2, '小程序卡片', '待领取'], [1, '小程序卡片', '待领取']])

  // 右上角菜单之类没有卡种的分享：不记录、不带 token
  const before = calls.api.length
  assert.deepEqual(page.onShareAppMessage({}), { title: '送你一张会籍卡', path: '/pages/coach/claim/claim', imageUrl: '/pages/coach/assets/membership-share-cover.jpg' })
  assert.equal(calls.api.length, before)
  assert.equal(state.cards.length, 2)
})

test('分享小程序卡片：服务端拒绝建卡（比如待领取已满）时提示原因，转发出去的卡片不带 token', async t => {
  const { calls } = shareEnv(t, { 'Coach/CreateCard': () => ({ code: 1, message: '待领取的学员卡已有 50 张，请等学员领取或撤销一些再生成' }) })
  const page = loadPage('pages/coach/card_standard/card_standard.js', {})
  page.onLoad(); page.onReady(); await settle()
  const row = page.data.templates[0]
  const result = await page.onShareAppMessage({ target: { dataset: { id: row.id, name: row.name, cover: row.coverPath } } }).promise
  assert.equal(result.path, '/pages/coach/claim/claim')
  assert.match(calls.toasts.at(-1), /待领取的学员卡已有 50 张/)
})

test('分享二维码：点一下记一次分享，显示这张卡的二维码（来自服务端、带登录态和小程序版本）；关闭后刷新记录', async t => {
  const { calls, state } = shareEnv(t)
  const page = loadPage('pages/coach/card_standard/card_standard.js', {})
  page.onLoad(); page.onReady(); await settle()
  assert.equal(page.data.qr.show, false)
  await page.onShareQr({ currentTarget: { dataset: { id: 9 } } }); await settle()
  assert.deepEqual(calls.api.filter(c => c.path === 'Coach/CreateCard').map(c => [c.body.templateId, c.body.channel]), [[9, 'qr']])
  assert.equal(page.data.qr.show, true); assert.equal(page.data.qr.name, '教练卡'); assert.equal(page.data.qr.cardId, 1)
  assert.match(page.data.qr.url, /^https:\/\/x\/api\/Coach\/GetCardQr\?sessionKey=sk&cardId=1&envVersion=release&_=\d+$/)
  assert.deepEqual(page.data.shareRows[9].map(r => [r.channelText, r.statusText]), [['二维码', '待领取']], '点的时候就已经记了')
  // 二维码没出来：给出重试，重试是同一张卡的码，不会再记一次分享
  page.onQrError(); assert.match(page.data.qr.error, /重试/)
  page.onQrRetry(); assert.equal(page.data.qr.error, ''); assert.equal(page.data.qr.loading, true)
  assert.match(page.data.qr.url, /cardId=1/)
  assert.equal(calls.api.filter(c => c.path === 'Coach/CreateCard').length, 1)
  page.onQrLoad(); assert.equal(page.data.qr.loading, false)
  await page.onQrClose(); assert.equal(page.data.qr.show, false); assert.equal(state.cards.length, 1)
  // 再点一次 = 再记一次、新的二维码
  await page.onShareQr({ currentTarget: { dataset: { id: 9 } } }); await settle()
  assert.equal(page.data.qr.cardId, 2); assert.equal(page.data.shareStats[9].total, 2)
})

test('分享记录按卡种分组、默认折叠；已领取的显示领取人头像昵称和卡号', async t => {
  const { state } = shareEnv(t)
  state.cards = [
    { id: 3, status: 'issued', templateId: 9, cardName: '教练卡', channel: 'qr', createDate: '2026-11-17T10:30:00' },
    { id: 2, status: 'claimed', templateId: 9, cardName: '教练卡', channel: 'card', createDate: '2026-11-17T10:00:00', claimedAt: '2026-11-17T10:05:00', nickName: '雪友小A', avatarUrl: 'https://img.snowmeet.top/upload/20261117/avatar_a.jpg', cardNo: 'HJ000002', memberId: 7 },
    { id: 1, status: 'issued', templateId: 77, cardName: '旧卡种', channel: 'qr', createDate: '2026-11-10T09:00:00' }
  ]
  const page = loadPage('pages/coach/card_standard/card_standard.js', {})
  page.onLoad(); await settle()
  assert.deepEqual(page.data.expanded, {}, '默认全部折叠')
  assert.deepEqual(page.data.shareStats[9], { total: 2, pending: 1, claimed: 1 })
  const rows = page.data.shareRows[9]
  assert.deepEqual(rows.map(r => [r.statusText, r.tone, r.canDelete]), [['待领取', 'warn', true], ['已领取', 'ok', false]])
  assert.deepEqual([rows[1].nickName, rows[1].avatarUrl, rows[1].cardNo, rows[1].claimed, rows[1].channelText], ['雪友小A', 'https://img.snowmeet.top/upload/20261117/avatar_a.jpg', 'HJ000002', '11-17 10:05', '小程序卡片'])
  assert.equal(rows[0].created, '11-17 10:30')
  // 卡种已不在列表里的记录单独归到「其他」
  assert.deepEqual(page.data.otherShares.map(r => r.id), [1]); assert.deepEqual(page.data.otherStats, { total: 1, pending: 1, claimed: 0 })
  // 展开 / 折叠
  page.onToggleShares({ currentTarget: { dataset: { id: 9 } } }); assert.equal(page.data.expanded[9], true)
  page.onToggleShares({ currentTarget: { dataset: { id: 9 } } }); assert.equal(page.data.expanded[9], false)
  page.onToggleShares({ currentTarget: { dataset: { id: 'other' } } }); assert.equal(page.data.expanded.other, true)

  const wxml = fs.readFileSync(path.join(ROOT, 'pages/coach/card_standard/card_standard.wxml'), 'utf8')
  assert.match(wxml, /bindtap="onToggleShares"/)
  assert.match(wxml, /wx:if="\{\{expanded\[item\.id\]\}\}"/, '展开了才渲染记录')
  assert.match(wxml, /src="\{\{rec\.avatarUrl\}\}"/); assert.match(wxml, /rec\.nickName/)
  assert.doesNotMatch(wxml, /onCancelShare|取消分享/)
})

test('没领取的分享：再次查看二维码、再次分享小程序卡片都是同一张卡，不新记一次；可以直接删除（删后不再列出）', async t => {
  const { calls, state } = shareEnv(t)
  state.cards = [
    { id: 3, status: 'issued', templateId: 9, cardName: '教练卡', channel: 'qr', createDate: '2026-11-17T10:30:00' },
    { id: 2, status: 'claimed', templateId: 9, cardName: '教练卡', channel: 'card', createDate: '2026-11-17T10:00:00', claimedAt: '2026-11-17T10:05:00', nickName: '雪友小A', cardNo: 'HJ000002', memberId: 7 }
  ]
  const page = loadPage('pages/coach/card_standard/card_standard.js', {})
  page.onLoad(); page.onReady(); await settle()
  const rec = page.data.shareRows[9][0]
  assert.equal(rec.sharePath, '/pages/coach/claim/claim?t=tok3')
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/coach/card_standard/card_standard.wxml'), 'utf8')
  // 只有待领取的记录有这三个按钮（claimed 的没有）
  assert.match(wxml, /wx:if="\{\{rec\.canDelete\}\}"[\s\S]*?bindtap="onViewQr"[\s\S]*?open-type="share"[\s\S]*?bindtap="onDeleteShare"/)
  assert.deepEqual(page.data.shareRows[9].map(r => r.canDelete), [true, false])

  const writes = () => calls.api.filter(c => c.path === 'Coach/CreateCard').length
  // 再次查看二维码：同一张卡的码，没有新建
  page.onViewQr({ currentTarget: { dataset: { cardId: rec.id, name: rec.name } } })
  assert.equal(page.data.qr.show, true); assert.equal(page.data.qr.cardId, 3)
  assert.match(page.data.qr.url, /Coach\/GetCardQr\?sessionKey=sk&cardId=3&envVersion=release/)
  assert.equal(writes(), 0)
  await page.onQrClose()
  // 再次分享小程序卡片：路径就是这张卡的，用卡种封面，没有 promise、不新建
  const cover = page.data.templates[0].coverPath
  const again = page.onShareAppMessage({ target: { dataset: { path: rec.sharePath, name: rec.name, cover } } })
  assert.deepEqual(again, { title: '送你一张教练卡', path: '/pages/coach/claim/claim?t=tok3', imageUrl: cover })
  assert.equal(again.promise, undefined); assert.equal(writes(), 0)

  // 直接删除：确认后撤销，列表里这条消失，已领取的那条还在
  await page.onDeleteShare({ currentTarget: { dataset: { id: 3 } } }); await settle()
  assert.deepEqual(calls.api.filter(c => c.path === 'Coach/RevokeMyCard').map(c => c.body.cardId), [3])
  assert.deepEqual(page.data.shareRows[9].map(r => r.id), [2])
  assert.deepEqual(page.data.shareStats[9], { total: 1, pending: 0, claimed: 1 })
  assert.match(calls.toasts.at(-1), /已删除/)
  // 不确认就不删
  global.wx.showModal = o => o.success({ confirm: false })
  const n = calls.api.length
  await page.onDeleteShare({ currentTarget: { dataset: { id: 2 } } }); await settle()
  assert.equal(calls.api.length, n)
})

test('删除时对方刚好领走了：服务端拒绝，提示原因并刷新成最新状态', async t => {
  const { calls, state } = shareEnv(t, { 'Coach/RevokeMyCard': () => ({ code: 1, message: '学员已领取的卡不能自行撤销，请联系管理员' }) })
  state.cards = [{ id: 1, status: 'issued', templateId: 9, cardName: '教练卡', channel: 'qr', createDate: '2026-11-17T10:00:00' }]
  const page = loadPage('pages/coach/card_standard/card_standard.js', {})
  page.onLoad(); await settle()
  const before = calls.api.filter(c => c.path === 'Coach/ListMyCards').length
  await page.onDeleteShare({ currentTarget: { dataset: { id: 1 } } }); await settle()
  assert.match(calls.toasts.at(-1), /已领取的卡不能自行撤销/)
  assert.equal(calls.api.filter(c => c.path === 'Coach/ListMyCards').length, before + 1)
})

test('分享记录：领取人没有昵称时用真实姓名；分组统计；分享记录加载失败有提示', async t => {
  assert.equal(view.shareRow({ id: 1, status: 'claimed', studentName: '王同学' }).nickName, '王同学')
  assert.equal(view.shareRow({ id: 1, status: 'claimed', nickName: '雪友', studentName: '王同学' }).nickName, '雪友')
  assert.equal(view.shareRow({ id: 1, status: 'claimed', nickName: '雪友' }).initial, '雪')
  assert.equal(view.shareRow({ id: 1, status: 'issued' }).canDelete, true)
  assert.equal(view.shareRow({ id: 1, status: 'claimed' }).canDelete, false)
  assert.equal(view.shareRow({ id: 1, status: 'issued' }).channelText, '', '旧版小程序发的卡没有分享方式')
  assert.equal(view.shareRow({ id: 1, status: 'revoked', memberId: 8 }).statusText, '已撤销')
  const g = view.groupShares([
    view.shareRow({ id: 5, status: 'issued', templateId: 1 }), view.shareRow({ id: 4, status: 'claimed', templateId: 1 }),
    view.shareRow({ id: 3, status: 'issued', templateId: 2 }), view.shareRow({ id: 2, status: 'issued' }), view.shareRow({ id: 1, status: 'issued', templateId: 99 })
  ], [1, 2, 3])
  assert.deepEqual(g.stats, { 1: { total: 2, pending: 1, claimed: 1 }, 2: { total: 1, pending: 1, claimed: 0 }, 3: { total: 0, pending: 0, claimed: 0 } })
  assert.deepEqual(g.byTemplate[1].map(r => r.id), [5, 4]); assert.deepEqual(g.other.map(r => r.id), [2, 1])
  shareEnv(t, { 'Coach/ListMyCards': () => ({ code: 3, message: 'x' }) })
  const page = loadPage('pages/coach/card_standard/card_standard.js', {})
  page.onLoad(); await settle()
  assert.equal(page.data.sharesError, true)
})

test('只设置了一口价底价的分销商：会籍卡页只有一口价，没有折扣和「无」，没开放的租赁整块不出现（用户 2026-11-17）', async t => {
  const onlyFixed = (shop, tier, min) => cell(shop, tier, { open: true, minFixed: min, minRate: null })
  const state = STANDARD({
    cells: [onlyFixed(WL, '单项', 50), onlyFixed(WL, '双项', 100), onlyFixed(CL, '单项', 40), onlyFixed(CL, '双项', 80)],
    rental: { rate: null, open: false, minRate: null, belowFloor: false }
  })
  const calls = env(t, (p, body) => {
    if (p === 'Coach/ListMyCards') return OK({ cards: [] })
    if (p === 'Distributor/ListMyCardTemplates') return OK({ templates: [] })
    if (p === 'Distributor/GetMyCardTemplate') return OK(Object.assign({ name: '' }, state))
    if (p === 'Distributor/SaveMyCardTemplate') return OK({ id: 1 })
    throw new Error(p)
  })
  const page = loadPage('pages/coach/card_standard/card_standard.js', {})
  page.onLoad(); await settle()
  await page.onNew()
  // 四格都开放，但每格只有「一口价」这一种方式：不出方式按钮，也没有折扣
  assert.deepEqual(page.data.cells.map(c => c.visible), [true, true, true, true])
  assert.ok(page.data.cells.every(c => c.modes.length === 1 && c.modes[0].key === 'fixed'))
  assert.ok(page.data.cells.every(c => c.unit === '元' && /一口价/.test(c.placeholder) && !/折/.test(c.placeholder)))
  assert.deepEqual(page.data.cells.map(c => c.hint), ['一口价不低于 ¥50', '一口价不低于 ¥100', '一口价不低于 ¥40', '一口价不低于 ¥80'])
  assert.equal(page.data.showRental, false)                      // 租赁底价没设置：整块不出现
  assert.equal(page.data.nothingOpen, false)
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/coach/card_standard/card_standard.wxml'), 'utf8')
  assert.match(wxml, /wx:if="\{\{item\.modes\.length > 1\}\}"/)           // 方式按钮只在设置了不止一种方式时才有
  assert.doesNotMatch(wxml, /wx:for="\{\{modes\}\}"|>无</)                // 不再有写死的「无 / 折扣 / 一口价」按钮组
  assert.match(wxml, /wx:if="\{\{item\.visible\}\}"/)
  assert.match(wxml, /wx:if="\{\{showRental\}\}"/)
  // 填数就是一口价、留空就是不优惠；低于底价被拦；保存时租赁不优惠
  page.onName({ detail: { value: '学员卡' } })
  page.onCellText({ currentTarget: { dataset: { i: 0 } }, detail: { value: '30' } })
  assert.equal(page.data.cells[0].mode, 'fixed')
  page.onSave()
  assert.match(calls.toasts.at(-1), /万龙单项：一口价不能低于 ¥50/)
  page.onCellText({ currentTarget: { dataset: { i: 0 } }, detail: { value: '58' } })
  page.onCellText({ currentTarget: { dataset: { i: 1 } }, detail: { value: '120' } })
  page.onCellText({ currentTarget: { dataset: { i: 1 } }, detail: { value: '' } })       // 又清空：双项不优惠
  assert.equal(page.data.cells[1].mode, 'none')
  page.onSave(); await settle()
  const save = calls.api.find(c => c.path.endsWith('SaveMyCardTemplate'))
  assert.deepEqual(save.body.care.map(c => [c.mode, c.value]), [['fixed', 58], ['none', 0], ['none', 0], ['none', 0]])
  assert.equal(save.body.rental_rate, null)
})

test('管理员什么都没开放（养护格子和租赁都没有）：会籍卡页不显示任何选项，提示联系管理员', async t => {
  const closed = STANDARD({ cells: [cell(WL, '单项'), cell(WL, '双项'), cell(CL, '单项'), cell(CL, '双项')], rental: { rate: null, open: false, minRate: null } })
  env(t, (p) => {
    if (p === 'Coach/ListMyCards') return OK({ cards: [] })
    if (p === 'Distributor/ListMyCardTemplates') return OK({ templates: [] })
    if (p === 'Distributor/GetMyCardTemplate') return OK(Object.assign({ name: '' }, closed))
    throw new Error(p)
  })
  const page = loadPage('pages/coach/card_standard/card_standard.js', {})
  page.onLoad(); await settle()
  await page.onNew()
  assert.equal(page.data.nothingOpen, true)
  assert.ok(page.data.cells.every(c => !c.visible))
  assert.equal(page.data.showRental, false)
  assert.match(fs.readFileSync(path.join(ROOT, 'pages/coach/card_standard/card_standard.wxml'), 'utf8'), /管理员还没有给你开放会籍卡的项目/)
})

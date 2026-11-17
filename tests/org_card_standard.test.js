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
  assert.match(view.standardPayload(edit({ [CL + '单项']: { mode: 'rate', text: '9' } }), '', rental).error, /崇礼单项：这一项只开放了一口价/)
  assert.match(view.standardPayload(edit({ [CL + '单项']: { mode: 'fixed', text: '59' } }), '', rental).error, /崇礼单项：一口价不能低于 ¥60/)
  assert.match(view.standardPayload(edit({}), '7.5', rental).error, /租赁：折扣不能低于 8 折/)
  assert.match(view.standardPayload(edit({}), '9', view.rentalStandard({ rate: null, open: false })).error, /租赁：管理员还没有开放/)
  assert.equal(view.standardPayload(edit({}), '', view.rentalStandard({ rate: null, open: false })).rate, null)   // 不优惠总可以
  assert.match(view.standardPayload(edit({ [WL + '单项']: { mode: 'rate', text: '' } }), '', rental).error, /请填写/)
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
  page.onMode({ currentTarget: { dataset: { i: 1, mode: 'rate' } } })
  assert.equal(page.data.cells[1].mode, 'none')
  assert.ok(calls.toasts.includes('管理员还没有开放这一项'))
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
  assert.deepEqual(page.onShareAppMessage({ target: { dataset: { name: '学员卡', path: '/pages/coach/claim/claim?t=AbCd1234', cover: 'wxfile://student-card.jpg' } } }),
    { title: '送你一张学员卡', path: '/pages/coach/claim/claim?t=AbCd1234', imageUrl: 'wxfile://student-card.jpg' })
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

test('卡种生成独立分享卡，分享链接来自服务端且封面使用卡种名', async t => {
  const card = { id: 9, name: '教练卡', carePrices: [], rentalRate: null }
  const calls = env(t, (p, body) => {
    if (p === 'Distributor/ListMyCardTemplates') return OK({ templates: [card] })
    if (p === 'Coach/ListMyCards') return OK({ cards: [] })
    if (p === 'Coach/CreateCard') return OK({ cardId: 1, cardName: '教练卡', tokenTail: '1234', sharePath: '/pages/coach/claim/claim?t=unique1234' })
    throw new Error(p)
  })
  let drawn = ''
  global.wx.createCanvasContext = () => {
    let words = ''
    return { drawImage() {}, setTextAlign() {}, setTextBaseline() {}, setFillStyle() {}, setFontSize() {},
      measureText(text) { return { width: text.length * 30 } }, fillText(text) { words += text },
      draw(_, done) { drawn = words; setImmediate(done) } }
  }
  global.wx.canvasToTempFilePath = o => setImmediate(() => o.success({ tempFilePath: 'wxfile://' + drawn }))
  const page = loadPage('pages/coach/card_standard/card_standard.js', {})
  page.onLoad(); page.onReady(); await settle()
  await page.onCreateShare({ currentTarget: { dataset: { id: 9 } } }); await settle()
  assert.equal(calls.api.find(c => c.path === 'Coach/CreateCard').body.templateId, 9)
  const row = page.data.pending[0]
  assert.equal(row.coverPath, 'wxfile://教练卡')
  assert.deepEqual(page.onShareAppMessage({ target: { dataset: { name: row.name, path: row.sharePath, cover: row.coverPath } } }),
    { title: '送你一张教练卡', path: '/pages/coach/claim/claim?t=unique1234', imageUrl: 'wxfile://教练卡' })
})

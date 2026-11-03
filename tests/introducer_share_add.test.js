// 「添加分账记录」页（pages/introducer/share/add）：从订单页的分账卡片进入，带 orderId。
// 分账请求 = 收款人（从介绍人里选，可按 教练 / KOL / 机构 筛选，也能用关键词、手机号搜）+ 金额 + 预计分账日期 + 是否自动分账 + 备注。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const api = require('../utils/introducer_api.js')
const { loadPage, settle, tap } = require('./reception_harness.js')

const PREFIX = 'https://x/api/'
const OK = data => ({ code: 0, message: '', data })
const ERR = (code, message) => ({ code, message, data: null })
const FILE = 'pages/introducer/share/add/add.js'
const MANAGER = { valid: 1, title_level: 200 }
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')

function ymd(offsetDays) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = n => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

const CHOICES = [
  { id: 7, name: '李教练', type: '教练', cellTail: '7006' },
  { id: 8, name: '小王', type: 'KOL', cellTail: '1111' },
  { id: 9, name: '雪山公司', type: '机构', cellTail: '' }
]
const ORDER_OK = over => OK(Object.assign({ canEdit: true, reason: null, suggested: 86, suggestedPlanDate: ymd(1), autoShareSupported: true, shares: [] }, over))

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
  global.wx = { showToast(o) { toasts.push(o.title) }, navigateBack() { nav.push('back') } }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { staff, sessionKey: 'sk%2B1', requestPrefix: PREFIX } })
  t.after(() => {
    global.wx = previous.wx
    global.getApp = previous.getApp
    api.setTransport(function (options) { wx.request(options) })
  })
  return { calls, toasts, nav }
}

// 默认假后端：订单可设置；候选按 type / keyword 过滤，和真后端同口径
function backend(overrides) {
  return (c, a, params, body) => {
    if (overrides && overrides[a]) return overrides[a](params, body)
    if (a === 'GetOrderShares') return ORDER_OK()
    if (a === 'ListChoices') {
      const key = params.keyword
      return OK({ choices: CHOICES.filter(x => (!params.type || x.type === params.type) && (!key || x.name.includes(key) || x.cellTail.includes(key))) })
    }
    return OK({ shares: [] })
  }
}

async function open(t, over) {
  const env = setup(t, { staff: MANAGER, handler: backend(over) })
  const page = loadPage(FILE, {})
  await page.onLoad({ orderId: '123' })
  await settle()
  return { env, page }
}

test('店员（职级 100）进来被挡，不发请求', async t => {
  const env = setup(t, { staff: { valid: 1, title_level: 100 }, handler: backend() })
  const page = loadPage(FILE, {})
  await page.onLoad({ orderId: '123' })
  await settle()
  assert.equal(page.data.blocked, '只有店长以上可以设置介绍人分账')
  assert.equal(env.calls.length, 0)
})

test('进来先读这一单：预填金额和最早能分的日期，同时拉出全部候选', async t => {
  const { env, page } = await open(t)
  assert.deepEqual(env.calls.map(c => c.action).sort(), ['GetOrderShares', 'ListChoices'])
  assert.equal(env.calls.find(c => c.action === 'GetOrderShares').params.orderId, '123')
  assert.equal(page.data.form.amount, '86')
  assert.equal(page.data.form.planDate, ymd(1))
  assert.equal(page.data.form.autoShare, true)
  assert.equal(page.data.supportsPlanDate, true)
  assert.equal(page.data.supportsAutoShare, true)
  assert.deepEqual(page.data.choices.map(c => c.name), ['李教练', '小王', '雪山公司'])
  assert.deepEqual(page.data.choices.map(c => c.tail), ['尾号 7006', '尾号 1111', ''])
})

test('这单不能设置：只显示原因，不请求候选', async t => {
  const { env, page } = await open(t, { GetOrderShares: () => ORDER_OK({ canEdit: false, reason: '该订单还没有关单' }) })
  assert.equal(page.data.canEdit, false)
  assert.equal(page.data.reason, '该订单还没有关单')
  assert.equal(env.calls.filter(c => c.action === 'ListChoices').length, 0)
})

test('按类型筛选：教练 / KOL / 机构 / 全部，请求带上 type；选「全部」不带', async t => {
  const { env, page } = await open(t)
  assert.deepEqual(page.data.types, ['全部', '教练', 'KOL', '机构'])
  const listCalls = () => env.calls.filter(c => c.action === 'ListChoices')

  await page.onType(tap({ type: '教练' }))
  assert.equal(listCalls().pop().params.type, '教练')
  assert.deepEqual(page.data.choices.map(c => c.name), ['李教练'])
  assert.equal(page.data.type, '教练')

  await page.onType(tap({ type: 'KOL' }))
  assert.deepEqual(page.data.choices.map(c => c.name), ['小王'])
  await page.onType(tap({ type: '机构' }))
  assert.deepEqual(page.data.choices.map(c => c.name), ['雪山公司'])

  await page.onType(tap({ type: '全部' }))
  assert.equal('type' in listCalls().pop().params, false)
  assert.equal(page.data.choices.length, 3)
})

test('关键词或手机号搜索：和类型一起生效；没找到显示空列表', async t => {
  const { env, page } = await open(t)
  const last = () => env.calls.filter(c => c.action === 'ListChoices').pop()

  page.onKeyword({ detail: { value: ' 7006 ' } })
  await page.onSearch()
  assert.equal(last().params.keyword, '7006')
  assert.deepEqual(page.data.choices.map(c => c.name), ['李教练'])

  await page.onType(tap({ type: 'KOL' }))
  assert.equal(last().params.type, 'KOL')
  assert.equal(last().params.keyword, '7006')
  assert.deepEqual(page.data.choices, [])

  page.onKeyword({ detail: { value: '' } })
  await page.onSearch()
  assert.equal('keyword' in last().params, false)
})

test('选收款人：记下 id 和名称；换筛选后已选的不丢；再点一次别人就换人', async t => {
  const { page } = await open(t)
  page.onPick(tap({ id: 8 }))
  assert.equal(page.data.pickedId, 8)
  assert.equal(page.data.pickedLabel, '小王 · KOL')

  await page.onType(tap({ type: '教练' }))   // 列表里已经没有小王，但选中的还在
  assert.equal(page.data.pickedId, 8)
  page.onPick(tap({ id: 7 }))
  assert.equal(page.data.pickedLabel, '李教练 · 教练')
})

test('保存：请求体带 收款人、金额、预计分账日期、是否自动分账、备注；成功后返回订单页', async t => {
  const { env, page } = await open(t, { SetShare: (p, body) => OK({ shares: [{ orderShareId: 1, amount: body.amount }] }) })
  page.onPick(tap({ id: 7 }))
  page.onAmount({ detail: { value: '60' } })
  page.onPlanDate({ detail: { date: ymd(5) } })
  page.onAutoShare({ detail: { value: false } })
  page.onMemo({ detail: { value: ' 月底统一转 ' } })
  await page.onSave()

  assert.deepEqual(env.calls.find(c => c.action === 'SetShare').body,
    { orderId: 123, introducerId: 7, amount: 60, memo: '月底统一转', planDate: ymd(5), autoShare: false })
  assert.deepEqual(env.toasts, ['已保存'])
  assert.deepEqual(env.nav, ['back'])
})

test('保存前的检查：没选收款人 / 金额不对 / 日期没选或早于今天，都不请求', async t => {
  const { env, page } = await open(t)
  const saves = () => env.calls.filter(c => c.action === 'SetShare').length

  await page.onSave()
  assert.equal(env.toasts.pop(), '请先选择收款人')
  page.onPick(tap({ id: 7 }))
  page.onAmount({ detail: { value: '0' } })
  await page.onSave()
  assert.equal(env.toasts.pop(), '请填写大于 0 的金额')
  page.onAmount({ detail: { value: '60' } })
  page.onPlanDate({ detail: { date: '' } })
  await page.onSave()
  assert.equal(env.toasts.pop(), '请选择预计分账日期')
  page.onPlanDate({ detail: { date: ymd(-1) } })
  await page.onSave()
  assert.equal(env.toasts.pop(), '预计分账日期不能早于今天')
  assert.equal(saves(), 0)
  assert.deepEqual(env.nav, [])
})

test('服务端拒绝（比如合计超过实收）：显示原因，留在这一页', async t => {
  const { env, page } = await open(t, { SetShare: () => ERR(1, '分账合计不能超过实收扣掉已退款') })
  page.onPick(tap({ id: 7 }))
  await page.onSave()
  assert.equal(env.toasts.pop(), '分账合计不能超过实收扣掉已退款')
  assert.deepEqual(env.nav, [])
  assert.equal(page.data.saving, false)
})

test('后端还不认预计分账日期和自动分账：不显示、也不发', async t => {
  const { env, page } = await open(t, { GetOrderShares: () => OK({ canEdit: true, reason: null, suggested: 86, shares: [] }) })
  assert.equal(page.data.supportsPlanDate, false)
  assert.equal(page.data.supportsAutoShare, false)
  page.onPick(tap({ id: 7 }))
  await page.onSave()
  const body = env.calls.find(c => c.action === 'SetShare').body
  assert.equal('planDate' in body, false)
  assert.equal('autoShare' in body, false)
})

test('界面结构：三类筛选 + 全部、搜索框、候选列表、日期用统一控件、自动分账是开关，顺序是 金额 → 日期 → 自动分账 → 备注', () => {
  const wxml = read('pages/introducer/share/add/add.wxml')
  const json = JSON.parse(read('pages/introducer/share/add/add.json'))
  assert.equal(json.usingComponents['date-range-picker'], '/components/date-range-picker/index')
  assert.match(wxml, /wx:for="\{\{types\}\}"[^>]*data-type="\{\{item\}\}"[^>]*bindtap="onType"/)
  assert.match(wxml, /<input[^>]*bindinput="onKeyword"[^>]*bindconfirm="onSearch"|<input[^>]*bindconfirm="onSearch"[^>]*bindinput="onKeyword"/)
  assert.match(wxml, /wx:for="\{\{choices\}\}"[^>]*bindtap="onPick"/)
  assert.match(wxml, /<date-range-picker[^>]*mode="single"[^>]*allow-future[^>]*bind:change="onPlanDate"/)
  assert.match(wxml, /<switch[^>]*bindchange="onAutoShare"/)
  assert.doesNotMatch(wxml, /mode="date"/)
  const at = s => wxml.indexOf(s)
  assert.ok(at('onAmount') < at('onPlanDate') && at('onPlanDate') < at('onAutoShare') && at('onAutoShare') < at('onMemo') && at('onMemo') < at('onSave'))
})

// 分账列表页（pages/introducer/share/list）：店长以上；筛选、分页、勾选「未分 + 手动」、批次号弹窗、记账；点条目跳订单详情。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const api = require('../utils/introducer_api.js')
const shareList = require('../utils/share_list.js')
const { loadPage, settle, tap } = require('./reception_harness.js')

const PREFIX = 'https://x/api/'
const OK = data => ({ code: 0, message: '', data })
const ERR = (code, message) => ({ code, message, data: null })
const FILE = 'pages/introducer/share/list/list.js'
const MANAGER = { valid: 1, title_level: 200 }
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')

function ymd(offsetDays) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = n => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

const ITEM = over => Object.assign({
  orderShareId: 1, orderId: 11, orderCode: 'WT_ZL_261031_00001', shop: '万龙体验中心', orderType: '租赁', payee: '李教练', amount: 40, applicant: '苍杰',
  mode: '手动', manualReason: '设为手动', status: '未分', planDate: ymd(2), sharedTime: null, batch: null, selectable: true, skipassId: null, listDate: ymd(0)
}, over)

const ITEMS = [
  ITEM({ orderShareId: 1, orderId: 11, amount: 40 }),
  ITEM({ orderShareId: 2, orderId: 12, orderType: '养护', amount: 10, listDate: ymd(-40) }),            // 40 天前
  ITEM({ orderShareId: 3, orderId: 13, orderType: '雪票', amount: 1, skipassId: 21, mode: '自动', manualReason: null, selectable: false }),
  ITEM({ orderShareId: 4, orderId: 14, orderType: '零售', amount: 5 })
]

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
  global.wx = { showToast(o) { toasts.push(o.title) }, navigateTo(o) { nav.push(o.url) }, stopPullDownRefresh() {} }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { staff, sessionKey: 'sk%2B1', requestPrefix: PREFIX } })
  t.after(() => {
    global.wx = previous.wx
    global.getApp = previous.getApp
    api.setTransport(function (options) { wx.request(options) })
  })
  return { calls, toasts, nav }
}

// 默认假后端：按页大小切片，合计和可勾选数按全集给
function backend(all, overrides) {
  return (c, a, params, body) => {
    if (overrides && overrides[a]) return overrides[a](params, body)
    if (a === 'List') {
      const size = Number(params.pageSize), index = Number(params.pageIndex)
      return OK({ items: all.slice((index - 1) * size, index * size), total: all.length, totalAmount: all.reduce((s, i) => s + i.amount, 0), selectableCount: all.filter(i => i.selectable).length })
    }
    if (a === 'NextBatchNo') return OK({ batchNo: 'MS-TEST-01' })
    if (a === 'CompleteManual') return OK({ batchNo: body.batchNo, count: body.orderShareIds.length, total: 50 })
    return OK({})
  }
}

async function open(t, all = ITEMS, overrides) {
  const env = setup(t, { staff: MANAGER, handler: backend(all, overrides) })
  const page = loadPage(FILE, {})
  await page.onLoad({})
  await settle()
  return { env, page, lists: () => env.calls.filter(c => c.action === 'List') }
}

test('店员（职级 100）进来被挡，不发请求', async t => {
  const env = setup(t, { staff: { valid: 1, title_level: 100 }, handler: backend(ITEMS) })
  const page = loadPage(FILE, {})
  await page.onLoad({})
  await settle()
  assert.equal(page.data.blocked, '只有店长以上可以查看和处理分账')
  assert.equal(env.calls.length, 0)
})

test('进来默认：未分 + 近 30 天 + 第 1 页，列表和合计显示出来', async t => {
  const { page, lists } = await open(t)
  const range = shareList.defaultRange(ymd(0))
  assert.deepEqual([lists()[0].params.status, lists()[0].params.startDate, lists()[0].params.endDate, lists()[0].params.pageIndex, lists()[0].params.pageSize],
    ['未分', range.startDate, range.endDate, '1', '20'])
  assert.equal('type' in lists()[0].params, false)
  assert.equal(page.data.items.length, 4)
  assert.equal(page.data.total, 4)
  assert.equal(page.data.totalAmount, 56)
  assert.equal(page.data.selectableCount, 3)
})

test('筛选：状态 / 类型 / 自动手动 / 日期 / 关键字，每次从第 1 页重来并清空勾选；「全部」不带参数', async t => {
  const { page, lists } = await open(t)
  const last = () => lists()[lists().length - 1].params
  page.onToggle(tap({ id: 1 }))
  assert.equal(page.data.selectedCount, 1)

  await page.onStatus(tap({ value: '已分' }))
  assert.equal(last().status, '已分')
  assert.equal(last().pageIndex, '1')
  assert.equal(page.data.selectedCount, 0)                       // 筛选一变，勾选清空

  await page.onStatus(tap({ value: '' }))
  assert.equal('status' in last(), false)
  await page.onType(tap({ value: '租赁' }))
  assert.equal(last().type, '租赁')
  await page.onType(tap({ value: '' }))
  assert.equal('type' in last(), false)
  await page.onMode(tap({ value: '手动' }))
  assert.equal(last().mode, '手动')

  await page.onRange(tap({ value: 'all' }))
  assert.equal('startDate' in last() || 'endDate' in last(), false)
  await page.onRange(tap({ value: '30' }))
  assert.equal(last().startDate, shareList.defaultRange(ymd(0)).startDate)
  await page.onRangeChange({ detail: { startDate: '2026-10-01', endDate: '2026-10-31' } })
  assert.deepEqual([last().startDate, last().endDate, page.data.rangeKey], ['2026-10-01', '2026-10-31', 'custom'])

  page.onKeyword({ detail: { value: ' 李教练 ' } })
  await page.onSearch()
  assert.equal(last().keyword, '李教练')
})

test('分页：滑到底加载下一页并追加；加载完了不再请求', async t => {
  const many = Array.from({ length: 25 }, (_, i) => ITEM({ orderShareId: i + 1, orderId: 100 + i, amount: 1 }))
  const { page, lists } = await open(t, many)
  assert.equal(page.data.items.length, 20)
  assert.equal(page.data.hasMore, true)

  await page.onReachBottom()
  assert.equal(lists()[1].params.pageIndex, '2')
  assert.equal(page.data.items.length, 25)
  assert.equal(page.data.hasMore, false)

  await page.onReachBottom()
  assert.equal(lists().length, 2)
})

test('勾选：只有可勾选的能勾；笔数合计跟着变；全选可选项再点取消', async t => {
  const { page } = await open(t)
  page.onToggle(tap({ id: 3 }))                                   // 自动、不可勾选
  assert.equal(page.data.selectedCount, 0)
  page.onToggle(tap({ id: 1 }))
  page.onToggle(tap({ id: 4 }))
  assert.deepEqual([page.data.selectedCount, page.data.selectedTotal], [2, 45])
  assert.deepEqual(page.data.items.map(i => i.checked), [true, false, false, true])
  page.onToggle(tap({ id: 1 }))
  assert.equal(page.data.selectedCount, 1)

  page.onSelectAll()
  assert.deepEqual([page.data.selectedCount, page.data.selectedTotal], [3, 55])
  page.onSelectAll()
  assert.equal(page.data.selectedCount, 0)
})

test('点条目：租赁、养护、零售、雪票各跳自己的详情页；雪票没有雪票 id 时提示不跳', async t => {
  const noSki = ITEM({ orderShareId: 9, orderType: '雪票', skipassId: null, selectable: false })
  const { env, page } = await open(t, [...ITEMS, noSki])
  page.onItem(tap({ id: 1 }))
  page.onItem(tap({ id: 2 }))
  page.onItem(tap({ id: 3 }))
  page.onItem(tap({ id: 4 }))
  assert.deepEqual(env.nav, [
    '/pages/admin/rent/rent_order_detail/rent_order_detail?id=11',
    '/pages/admin/care/care_order_detail/care_order_detail?id=12',
    '/pages/admin/ski_pass/common_skipass_detail?id=21',
    '/pages/admin/retail/retail_order_detail?id=14'
  ])
  page.onItem(tap({ id: 9 }))
  assert.equal(env.nav.length, 4)
  assert.equal(env.toasts.pop(), '没有找到对应的雪票')
})

test('点「分账」：没勾选提示；勾选后弹窗显示笔数、合计、30 天前的条数，并预填默认批次号', async t => {
  const { env, page } = await open(t)
  await page.onOpenModal()
  assert.equal(env.toasts.pop(), '请先勾选要分账的条目')
  assert.equal(page.data.modal.show, false)

  page.onToggle(tap({ id: 1 }))
  page.onToggle(tap({ id: 2 }))                                   // 2 号是 40 天前的
  await page.onOpenModal()
  assert.deepEqual(page.data.modal, { show: true, count: 2, total: 50, oldCount: 1, batchNo: 'MS-TEST-01' })
  page.onBatchNo({ detail: { value: 'MS-MINE-1' } })
  assert.equal(page.data.modal.batchNo, 'MS-MINE-1')
  page.onCancelModal()
  assert.equal(page.data.modal.show, false)
  assert.equal(page.data.selectedCount, 2)                        // 取消不清勾选
})

test('确定：发 CompleteManual，成功后关弹窗、清勾选、重新加载第 1 页并提示', async t => {
  const { env, page, lists } = await open(t)
  page.onToggle(tap({ id: 1 }))
  page.onToggle(tap({ id: 4 }))
  await page.onOpenModal()
  page.onBatchNo({ detail: { value: ' MS-MINE-1 ' } })
  await page.onConfirm()
  await settle()

  const call = env.calls.find(c => c.action === 'CompleteManual')
  assert.equal(call.method, 'POST')
  assert.deepEqual(call.body, { orderShareIds: [1, 4], batchNo: 'MS-MINE-1' })
  assert.equal(page.data.modal.show, false)
  assert.equal(page.data.selectedCount, 0)
  assert.equal(page.data.submitting, false)
  assert.equal(env.toasts.pop(), '已记账 2 笔，批次 MS-MINE-1')
  assert.equal(lists().length, 2)                                  // 记完重新读了一次第 1 页
  assert.equal(lists()[1].params.pageIndex, '1')
})

test('确定的各种失败：批次号为空不发请求；服务端拒绝（批次号已存在）弹窗保持打开；提交中不能重复点', async t => {
  const { env, page } = await open(t, ITEMS, { CompleteManual: () => ERR(1, '批次号已存在') })
  page.onToggle(tap({ id: 1 }))
  await page.onOpenModal()

  page.onBatchNo({ detail: { value: '   ' } })
  await page.onConfirm()
  assert.equal(env.toasts.pop(), '请填写批次号')
  assert.equal(env.calls.filter(c => c.action === 'CompleteManual').length, 0)

  page.onBatchNo({ detail: { value: 'MS-DUP' } })
  const first = page.onConfirm()
  const second = page.onConfirm()                                   // 第一次还没回来，第二次被忽略
  await Promise.all([first, second])
  assert.equal(env.calls.filter(c => c.action === 'CompleteManual').length, 1)
  assert.equal(env.toasts.pop(), '批次号已存在')
  assert.equal(page.data.modal.show, true)                          // 弹窗还在，让用户改批次号
  assert.equal(page.data.submitting, false)
  assert.equal(page.data.selectedCount, 1)
})

test('界面结构：筛选条、搜索、列表项可点、可勾选项有复选框（勾选不触发跳转）、底部分账栏、批次号弹窗', () => {
  const wxml = read('pages/introducer/share/list/list.wxml')
  const json = JSON.parse(read('pages/introducer/share/list/list.json'))
  assert.equal(json.usingComponents['date-range-picker'], '/components/date-range-picker/index')
  for (const handler of ['onStatus', 'onType', 'onMode', 'onRange']) assert.match(wxml, new RegExp('data-value="\\{\\{[^}]*\\}\\}"[^>]*bindtap="' + handler + '"'))
  assert.match(wxml, /<input[^>]*bindinput="onKeyword"[^>]*bindconfirm="onSearch"|<input[^>]*bindconfirm="onSearch"[^>]*bindinput="onKeyword"/)
  assert.match(wxml, /<date-range-picker[^>]*bind:change="onRangeChange"/)
  assert.match(wxml, /wx:for="\{\{items\}\}"[^>]*bindtap="onItem"/)
  assert.match(wxml, /catchtap="onToggle"/)
  assert.match(wxml, /bindtap="onSelectAll"/)
  assert.match(wxml, /bindtap="onOpenModal"[^>]*>分账/)
  assert.match(wxml, /<input[^>]*value="\{\{modal\.batchNo\}\}"[^>]*bindinput="onBatchNo"/)
  assert.match(wxml, /bindtap="onCancelModal"/)
  assert.match(wxml, /bindtap="onConfirm"/)
  assert.doesNotMatch(wxml, /mode="date"/)
  const app = JSON.parse(read('app.json'))
  assert.ok(app.subPackages.find(s => s.root === 'pages/introducer').pages.includes('share/list/list'))
})

test('管理员菜单有「【分账】分账列表」入口：店长以上可见，点了去列表页', () => {
  const wxml = read('pages/admin/admin.wxml')
  const js = read('pages/admin/admin.js')
  assert.match(wxml, /<mp-cell id="share_list" value="【分账】分账列表"[^>]*bindtap="nav"/)
  // 和同一页「接待授权」一样的「店长以上」写法；整个分组按这个条件显示，普通店员看不到
  assert.match(wxml, /<mp-cells[^>]*wx:if="\{\{isManager \|\| isAdmin\}\}"[^>]*>\s*<mp-cell id="share_list"/)
  assert.match(js, /case 'share_list':\s*path = '\/pages\/introducer\/share\/list\/list'/)
})

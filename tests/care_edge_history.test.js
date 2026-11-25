// 养护订单详情页：修刃角度「修改历史」（用户 2026-11-25 要求）。
// 修刃任务旁有「角度记录」入口，点开弹窗列出这件装备角度改过几次、谁什么时候从几度改成几度、重新打印过几次标签存根（新的在前）。
// 数据来自后端 Care/GetEdgeHistory，规则见后端 Helpers/CareEdgeHistoryRules.cs。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, settle, tap } = require('./reception_harness.js')
const edge = require('../utils/care_edge_label.js')

const PAGE = 'pages/admin/care/care_order_detail/care_order_detail.js'
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const wxml = read('pages/admin/care/care_order_detail/care_order_detail.wxml')

const ANGLE = { kind: 'angle', time: '2026-11-25T10:05:00', staffId: 9, staffName: '管理员', from: '88', to: '87', scene: '养护订单详情页修改修刃角度' }
const PRINT = { kind: 'print', time: '2026-11-25T10:02:00', staffId: 9, staffName: '管理员', from: '89', to: '88', scene: '重新打印标签存根' }
const FIRST = { kind: 'angle', time: '2026-11-25T10:00:00', staffId: 10, staffName: '店员', from: '89', to: '88', scene: '' }

// ---------------- 纯函数 ----------------
test('historyRow：改角度显示「89° → 88°」，重新打印显示打在标签上的角度', () => {
  assert.deepEqual(edge.historyRow(ANGLE), { kind: 'angle', title: '改角度', detail: '88° → 87°' })
  assert.deepEqual(edge.historyRow(PRINT), { kind: 'print', title: '重新打印标签存根', detail: '标签上是 88°' })
})

test('historyRow：角度缺失按 89；不认识的类型返回 null', () => {
  assert.equal(edge.historyRow({ kind: 'angle', from: null, to: '88' }).detail, '89° → 88°')
  assert.equal(edge.historyRow({ kind: 'print', to: '' }).detail, '标签上是 89°')
  assert.equal(edge.historyRow({ kind: 'other' }), null)
  assert.equal(edge.historyRow(null), null)
})

test('historyRows：保持服务器给的顺序（新的在前），跳过不认识的行；不是数组按空处理', () => {
  assert.deepEqual(edge.historyRows([ANGLE, { kind: 'x' }, PRINT, FIRST]).map(r => r.kind), ['angle', 'print', 'angle'])
  assert.deepEqual(edge.historyRows(null), [])
  assert.deepEqual(edge.historyRows(undefined), [])
  assert.deepEqual(edge.historyRows('oops'), [])
})

// ---------------- 详情页 ----------------
const tasks = (edgeStatus = '未开始') => [
  { id: 11, care_id: 7, task_name: '安全检查', status: '已完成', sort: 10, valid: 1 },
  { id: 21, care_id: 7, task_name: '修刃', status: edgeStatus, sort: 20, valid: 1 },
  { id: 61, care_id: 7, task_name: '发板', status: '未开始', sort: 60, valid: 1 }
]

function detail(options = {}) {
  const calls = { history: [], toasts: [] }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk', staff: { id: 5, title_level: 100 } } })
  global.wx = { showToast(o) { calls.toasts.push(o.title) }, showModal() {} }
  const page = loadPage(PAGE, {
    IMAGE_HOST: 'https://img.example',
    getCareEdgeHistoryPromise(careId, sessionKey) {
      calls.history.push([careId, sessionKey])
      return options.history ? options.history(careId) : Promise.resolve([ANGLE, PRINT, FIRST])
    }
  })
  delete global.getApp
  page._uiState = { expanded: {}, veriType: {}, safeCheck: {}, cancelReason: {} }
  page.loadOrder = () => {}
  return { page, calls, done() { delete global.wx } }
}
const render = (page, extra) => page._renderCare(Object.assign({
  id: 7, order_id: 11, equipment: '双板', brand: 'ATOMIC', scale: '170', need_edge: 1, edge_degree: '87',
  careImages: [], tasks: tasks(), valid: 1
}, extra || {}))
const withCares = (page, ...cares) => { page.setData({ cares }); return cares }

test('点「角度记录」：先弹窗显示加载中，调接口拉这件装备的记录，拉到后按顺序列出时间、操作人和内容', async () => {
  const { page, calls, done } = detail()
  withCares(page, render(page))
  page.onShowEdgeHistory(tap({ cidx: 0 }))
  assert.equal(page.data.edgeHistory.show, true)
  assert.equal(page.data.edgeHistory.loading, true)
  assert.deepEqual(calls.history, [[7, 'sk']])
  await settle()
  const h = page.data.edgeHistory
  assert.equal(h.loading, false)
  assert.equal(h.failed, false)
  assert.deepEqual(h.rows.map(r => [r.kind, r.title, r.detail, r.staffName]), [
    ['angle', '改角度', '88° → 87°', '管理员'],
    ['print', '重新打印标签存根', '标签上是 88°', '管理员'],
    ['angle', '改角度', '89° → 88°', '店员']
  ])
  assert.match(h.rows[0].timeStr, /2026-11-25 10:05/)
  assert.match(h.rows[2].timeStr, /10:00/)
  done()
})

test('弹窗抬头：当前角度；角度改过、标签还没重打时说明标签上还是几度', async () => {
  const { page, done } = detail()
  withCares(page, render(page, { edge_degree: '87', label_edge_degree: '89' }))
  page.onShowEdgeHistory(tap({ cidx: 0 }))
  assert.equal(page.data.edgeHistory.current, '87')
  assert.match(page.data.edgeHistory.pendingNote, /标签上还是 89°/)
  assert.match(page.data.edgeHistory.pendingNote, /重新打印/)
  await settle()
  page.onCloseEdgeHistory()
  // 已经重打过 / 没改过：没有提示
  page.setData({ cares: [render(page, { edge_degree: '87', label_edge_degree: null })] })
  page.onShowEdgeHistory(tap({ cidx: 0 }))
  assert.equal(page.data.edgeHistory.current, '87')
  assert.equal(page.data.edgeHistory.pendingNote, '')
  await settle()
  done()
})

test('弹窗抬头：edge_degree 为空按 89', () => {
  const { page, done } = detail()
  withCares(page, render(page, { edge_degree: null }))
  page.onShowEdgeHistory(tap({ cidx: 0 }))
  assert.equal(page.data.edgeHistory.current, '89')
  done()
})

test('一次都没改过：记录是空的，弹窗显示「还没有修改记录」', async () => {
  const { page, done } = detail({ history: () => Promise.resolve([]) })
  withCares(page, render(page))
  page.onShowEdgeHistory(tap({ cidx: 0 }))
  await settle()
  assert.deepEqual(page.data.edgeHistory.rows, [])
  assert.equal(page.data.edgeHistory.loading, false)
  assert.equal(page.data.edgeHistory.failed, false)
  assert.match(wxml, /还没有修改记录/)
  done()
})

test('拉记录失败（没权限、断网）：不留加载中，标记失败；接口层已经提示了原因，页面不再重复', async () => {
  const { page, calls, done } = detail({ history: () => Promise.reject('没有权限') })
  withCares(page, render(page))
  page.onShowEdgeHistory(tap({ cidx: 0 }))
  await settle()
  assert.equal(page.data.edgeHistory.loading, false)
  assert.equal(page.data.edgeHistory.failed, true)
  assert.deepEqual(page.data.edgeHistory.rows, [])
  assert.deepEqual(calls.toasts, [])
  assert.match(wxml, /记录加载失败/)
  done()
})

test('关闭弹窗；再点开重新拉，不留上次的内容', async () => {
  const { page, calls, done } = detail()
  withCares(page, render(page))
  page.onShowEdgeHistory(tap({ cidx: 0 }))
  await settle()
  page.onCloseEdgeHistory()
  assert.equal(page.data.edgeHistory.show, false)
  page.onShowEdgeHistory(tap({ cidx: 0 }))
  assert.equal(page.data.edgeHistory.show, true)
  assert.equal(page.data.edgeHistory.loading, true)
  assert.deepEqual(page.data.edgeHistory.rows, [])
  assert.equal(calls.history.length, 2)
  await settle()
  done()
})

test('上一次的慢响应不能盖掉这一次：先开 A 再关、再开 B，A 的响应后到也不显示', async () => {
  const waiting = {}
  const { page, done } = detail({
    history: careId => new Promise(resolve => { waiting[careId] = resolve })
  })
  withCares(page, render(page, { id: 7 }), render(page, { id: 8, tasks: tasks().map(t => Object.assign({}, t, { care_id: 8, id: t.id + 100 })) }))
  page.onShowEdgeHistory(tap({ cidx: 0 }))
  page.onCloseEdgeHistory()
  page.onShowEdgeHistory(tap({ cidx: 1 }))
  waiting[8]([FIRST])
  await settle()
  waiting[7]([ANGLE, PRINT])
  await settle()
  assert.deepEqual(page.data.edgeHistory.rows.map(r => r.detail), ['89° → 88°'])
  assert.equal(page.data.edgeHistory.loading, false)
  done()
})

test('关掉弹窗之后才到的响应不再改弹窗数据', async () => {
  let resolve
  const { page, done } = detail({ history: () => new Promise(r => { resolve = r }) })
  withCares(page, render(page))
  page.onShowEdgeHistory(tap({ cidx: 0 }))
  page.onCloseEdgeHistory()
  resolve([ANGLE])
  await settle()
  assert.equal(page.data.edgeHistory.show, false)
  assert.deepEqual(page.data.edgeHistory.rows, [])
  done()
})

test('不认识的装备（下标越界）：什么都不做', () => {
  const { page, calls, done } = detail()
  withCares(page, render(page))
  page.onShowEdgeHistory(tap({ cidx: 5 }))
  assert.equal(page.data.edgeHistory.show, false)
  assert.deepEqual(calls.history, [])
  done()
})

// ---------------- 页面结构 ----------------
test('模板：修刃任务有「角度记录」入口 —— 未完成的行、已完成的行各一处，别的任务没有', () => {
  const links = wxml.match(/<[^>]*onShowEdgeHistory[^>]*>[^<]*</g) || []
  assert.equal(links.length, 2, links.join('\n'))
  for (const link of links) {
    assert.match(link, /catchtap="onShowEdgeHistory"/)
    assert.match(link, /data-cidx="\{\{cidx\}\}"/)
    assert.match(link, /角度记录</)
    assert.match(link, /wx:if="\{\{task\.task_name === '修刃'\}\}"/)
  }
  // 一处在已完成的单行里，一处在未完成任务的名字旁
  const doneRow = wxml.slice(wxml.indexOf('task-row--done'), wxml.indexOf('<!-- 未完成任务 -->'))
  assert.match(doneRow, /onShowEdgeHistory/)
  const openRow = wxml.slice(wxml.indexOf('<!-- 未完成任务 -->'), wxml.indexOf('task-meta'))
  assert.match(openRow, /onShowEdgeHistory/)
})

test('模板：弹窗用 van-popup，关闭走 onCloseEdgeHistory；列表按行显示时间、操作人、标题和内容', () => {
  assert.match(wxml, /<van-popup show="\{\{edgeHistory\.show\}\}"[^>]*bind:close="onCloseEdgeHistory"/)
  assert.match(wxml, /wx:for="\{\{edgeHistory\.rows\}\}"/)
  for (const field of ['timeStr', 'staffName', 'title', 'detail']) {
    assert.ok(wxml.includes('{{row.' + field + '}}') || wxml.includes('{{item.' + field + '}}'), '行里显示 ' + field)
  }
  assert.match(wxml, /加载中/)
})

test('样式：角度记录入口和记录列表都有样式', () => {
  const wxss = read('pages/admin/care/care_order_detail/care_order_detail.wxss')
  assert.match(wxss, /\.edge-log-link\s*\{/)
  assert.match(wxss, /\.edge-log-row\s*\{/)
  assert.match(wxss, /\.edge-log-modal\s*\{/)
})

// ---------------- 接口地址 ----------------
test('data.js：getCareEdgeHistoryPromise 的地址和参数', async () => {
  const previousApp = global.getApp
  const previousWx = global.wx
  const urls = []
  global.getApp = () => ({ globalData: { requestPrefix: 'https://x.example/api/' } })
  global.wx = {
    request(o) { urls.push([o.method, o.url]); o.success({ statusCode: 200, data: { code: 0, message: '', data: [] } }) },
    showToast() {}
  }
  const dataPath = require.resolve('../utils/data.js')
  const utilPath = require.resolve('../utils/util.js')
  delete require.cache[dataPath]
  delete require.cache[utilPath]
  try {
    const realData = require('../utils/data.js')
    assert.deepEqual(await realData.getCareEdgeHistoryPromise(7, 'SK'), [])
  } finally {
    delete require.cache[dataPath]
    delete require.cache[utilPath]
    global.getApp = previousApp
    global.wx = previousWx
  }
  assert.deepEqual(urls, [['GET', 'https://x.example/api/Care/GetEdgeHistory?careId=7&sessionKey=SK']])
})

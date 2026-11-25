// 养护：修刃开始之前角度都可以改，改了就必须重新打印标签存根，不重新打印不能点「开始修刃」（用户 2026-11-25 要求）。
//   · 状态记在服务器：care.label_edge_degree = 标签上印的角度（NULL = 没有待重打的改动）；
//     「待重打」= 它不是 NULL 且和当前角度（edge_degree，空按 89）不一致，改回标签上的角度就不用重打；
//   · 后端接口：Care/SetEdgeDegree（改角度）、Care/MarkEdgeLabelPrinted（重打成功后清状态）、SetTaskStatus 拦「开始修刃」；
//   · 小程序：修刃任务（还没开始）旁有「改角度」；待重打时「开始 修刃」置灰并说明原因，打印标签的按钮变成「重新打印标签存根」；
//     标签真正打完（print-care 组件发 printed 事件）后调接口清状态，再刷新订单。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, loadComponent, settle, tap } = require('./reception_harness.js')
const edge = require('../utils/care_edge_label.js')

const PAGE = 'pages/admin/care/care_order_detail/care_order_detail.js'
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const wxml = read('pages/admin/care/care_order_detail/care_order_detail.wxml')

// ---------------- 规则（和后端 Helpers/CareEdgeLabelRules.cs 同口径） ----------------
test('parseAngle：0～90、最多一位小数；写法规范化（89.0 → 89）；空、超范围、非数字都给原因', () => {
  assert.deepEqual(edge.parseAngle('89'), { ok: true, value: '89' })
  assert.deepEqual(edge.parseAngle(' 87 '), { ok: true, value: '87' })
  assert.deepEqual(edge.parseAngle('88.5'), { ok: true, value: '88.5' })
  assert.deepEqual(edge.parseAngle('89.0'), { ok: true, value: '89' })
  assert.deepEqual(edge.parseAngle('90'), { ok: true, value: '90' })
  assert.deepEqual(edge.parseAngle(''), { ok: false, error: '请输入修刃角度' })
  assert.deepEqual(edge.parseAngle(null), { ok: false, error: '请输入修刃角度' })
  for (const bad of ['0', '91', '100', '-3', 'abc', '88.55', '8 9', '88.']) {
    assert.deepEqual(edge.parseAngle(bad), { ok: false, error: '修刃角度要在 0～90 之间，最多一位小数' }, bad)
  }
})

test('printedDegree：标签上印的角度，edge_degree 为空按 89', () => {
  assert.equal(edge.printedDegree(null), '89')
  assert.equal(edge.printedDegree(undefined), '89')
  assert.equal(edge.printedDegree('87'), '87')
  assert.equal(edge.printedDegree(' 87 '), '87')
})

test('isPending：label_edge_degree 不是空且和当前角度不一致才是待重打；改回标签上的角度就不用重打', () => {
  assert.equal(edge.isPending({ label_edge_degree: null, edge_degree: '87' }), false)
  assert.equal(edge.isPending({ edge_degree: '87' }), false)
  assert.equal(edge.isPending({ label_edge_degree: '89', edge_degree: '87' }), true)
  assert.equal(edge.isPending({ label_edge_degree: '89', edge_degree: null }), false)
  assert.equal(edge.isPending({ label_edge_degree: '89', edge_degree: '89' }), false)
  assert.equal(edge.isPending({ label_edge_degree: '89', edge_degree: ' 89 ' }), false)
  assert.equal(edge.isPending({ label_edge_degree: '87', edge_degree: null }), true)
  assert.equal(edge.isPending(null), false)
})

const edgeTask = status => ({ id: 21, task_name: '修刃', status, valid: 1 })
test('canEdit：装备有效、没取消、要修刃、修刃任务还没开始才能改；返回不能改的原因', () => {
  const care = { valid: 1, need_edge: 1, is_cancel: false }
  assert.equal(edge.whyCannotEdit(care, edgeTask('未开始')), null)
  assert.equal(edge.whyCannotEdit(care, edgeTask('已开始')), '修刃已经开始，不能再修改角度')
  assert.equal(edge.whyCannotEdit(care, edgeTask('已完成')), '修刃已经开始，不能再修改角度')
  assert.equal(edge.whyCannotEdit(care, null), '这件装备没有修刃任务，不能修改角度')
  assert.equal(edge.whyCannotEdit({ valid: 1, need_edge: 0 }, edgeTask('未开始')), '这件装备没有修刃任务，不能修改角度')
  assert.equal(edge.whyCannotEdit({ valid: 1, need_edge: 1, is_cancel: true }, edgeTask('未开始')), '这件养护已取消，不能修改角度')
})

test('startBlockedMessage：待重打时说明现在的角度、标签上的角度和该怎么办；不用拦返回 null', () => {
  assert.equal(edge.startBlockedMessage({ label_edge_degree: null, edge_degree: '87' }), null)
  const msg = edge.startBlockedMessage({ label_edge_degree: '89', edge_degree: '87' })
  assert.match(msg, /修刃角度已改为 87°/)
  assert.match(msg, /标签上还是 89°/)
  assert.match(msg, /重新打印标签存根/)
})

// ---------------- 详情页 ----------------
const tasks = (edgeStatus = '未开始') => [
  { id: 11, care_id: 7, task_name: '安全检查', status: '已完成', sort: 10, valid: 1 },
  { id: 21, care_id: 7, task_name: '修刃', status: edgeStatus, sort: 20, valid: 1 },
  { id: 61, care_id: 7, task_name: '发板', status: '未开始', sort: 60, valid: 1 }
]

function detail(options = {}) {
  const calls = { setDegree: [], marked: [], toasts: [], modals: [], taskStatus: [], loads: 0 }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk', staff: { id: 5, title_level: 100 } } })
  global.wx = {
    showToast(o) { calls.toasts.push(o.title) },
    showModal(o) { calls.modals.push(o) }
  }
  const page = loadPage(PAGE, {
    IMAGE_HOST: 'https://img.example',
    setCareEdgeDegreePromise(careId, degree, sessionKey) {
      calls.setDegree.push([careId, degree, sessionKey])
      return options.setFails ? Promise.reject('修刃已经开始，不能再修改角度')
        : Promise.resolve(options.setResult || { id: careId, edge_degree: degree, label_edge_degree: '89', edgeLabelPending: true })
    },
    markCareEdgeLabelPrintedPromise(careId, degree, sessionKey) {
      calls.marked.push([careId, degree, sessionKey])
      return options.markFails ? Promise.reject('打印的标签角度不一致') : Promise.resolve({ id: careId, label_edge_degree: null })
    },
    updateCareTaskStatusPromise(...args) { calls.taskStatus.push(args); return Promise.resolve({}) }
  })
  delete global.getApp
  page._uiState = { expanded: {}, veriType: {}, safeCheck: {}, cancelReason: {} }
  page.loadOrder = () => { calls.loads++ }
  return { page, calls, done() { delete global.wx } }
}
const render = (page, extra, edgeStatus) => page._renderCare(Object.assign({
  id: 7, order_id: 11, equipment: '双板', brand: 'ATOMIC', scale: '170', need_edge: 1, edge_degree: '89',
  careImages: [], tasks: tasks(edgeStatus), valid: 1
}, extra || {}))
const withCare = (page, care) => { page.setData({ cares: [care] }); return care }
const edgeRow = care => care._tasks.find(t => t.task_name === '修刃')

test('渲染：修刃还没开始 → 能改角度；任务标题带当前角度', () => {
  const { page, done } = detail()
  const care = render(page, { edge_degree: '87' })
  assert.equal(care._edgeEditable, true)
  assert.equal(edgeRow(care)._title, '修刃 角度：87')
  assert.equal(care._edgeLabelPending, false)
  assert.equal(edgeRow(care)._startBlocked, false)
  done()
})

test('渲染：修刃已开始 / 已完成、没有修刃任务、已取消 → 不能改角度', () => {
  const { page, done } = detail()
  assert.equal(render(page, {}, '已开始')._edgeEditable, false)
  assert.equal(render(page, {}, '已完成')._edgeEditable, false)
  assert.equal(render(page, { need_edge: 0, tasks: tasks().filter(t => t.task_name !== '修刃') })._edgeEditable, false)
  assert.equal(render(page, { is_cancel: true })._edgeEditable, false)
  done()
})

test('渲染：角度改过、标签没重打 → 待重打；「开始 修刃」被拦，提示说明原因', () => {
  const { page, done } = detail()
  const care = render(page, { edge_degree: '87', label_edge_degree: '89', edgeLabelPending: true })
  assert.equal(care._edgeLabelPending, true)
  const row = edgeRow(care)
  assert.equal(row._startBlocked, true)
  assert.match(row._hint, /重新打印标签存根/)
  assert.match(row._hint, /87°/)
  done()
})

test('渲染：改回标签上的角度（label_edge_degree 和 edge_degree 一致）→ 不用重打，不拦', () => {
  const { page, done } = detail()
  const care = render(page, { edge_degree: '89', label_edge_degree: '89', edgeLabelPending: false })
  assert.equal(care._edgeLabelPending, false)
  assert.equal(edgeRow(care)._startBlocked, false)
  done()
})

test('渲染：旧后端没有 label_edge_degree 字段 → 一律不拦、不提示', () => {
  const { page, done } = detail()
  const care = render(page, { edge_degree: '87' })
  assert.equal(care.label_edge_degree, undefined)
  assert.equal(care._edgeLabelPending, false)
  assert.equal(edgeRow(care)._startBlocked, false)
  done()
})

test('渲染：修刃已经开始，就算还带着待重打标记也不再拦、不再提示（没有可拦的了）', () => {
  const { page, done } = detail()
  const care = render(page, { edge_degree: '87', label_edge_degree: '89' }, '已开始')
  assert.equal(care._edgeLabelPending, false)
  assert.equal(edgeRow(care)._startBlocked, false)
  done()
})

test('改角度：弹出输入框（默认当前角度）→ 合法输入调接口 → 刷新订单 → 提示重新打印', async () => {
  const { page, calls, done } = detail()
  withCare(page, render(page, { edge_degree: '89' }))
  page.onEditEdgeDegree(tap({ cidx: 0 }))
  assert.equal(calls.modals.length, 1)
  assert.equal(calls.modals[0].editable, true)
  assert.match(calls.modals[0].title, /修刃角度/)
  assert.equal(calls.modals[0].content, '89')
  calls.modals[0].success({ confirm: true, content: ' 87 ' })
  await settle()
  assert.deepEqual(calls.setDegree, [[7, '87', 'sk']])
  assert.equal(calls.loads, 1)
  assert.ok(calls.toasts.some(t => /重新打印标签/.test(t)), JSON.stringify(calls.toasts))
  done()
})

test('改角度：不合法的输入当场提示、不调接口；取消、没改动也不调接口', async () => {
  const { page, calls, done } = detail()
  withCare(page, render(page, { edge_degree: '89' }))
  const confirmWith = content => { page.onEditEdgeDegree(tap({ cidx: 0 })); calls.modals.at(-1).success({ confirm: true, content }) }
  confirmWith('95')
  confirmWith('')
  confirmWith('八十七')
  assert.deepEqual(calls.toasts, ['修刃角度要在 0～90 之间，最多一位小数', '请输入修刃角度', '修刃角度要在 0～90 之间，最多一位小数'])
  confirmWith('89')
  confirmWith('89.0')
  page.onEditEdgeDegree(tap({ cidx: 0 }))
  calls.modals.at(-1).success({ cancel: true })
  await settle()
  assert.deepEqual(calls.setDegree, [])
  assert.equal(calls.loads, 0)
  done()
})

test('改角度：修刃已经开始 → 不弹输入框，提示原因', () => {
  const { page, calls, done } = detail()
  withCare(page, render(page, {}, '已开始'))
  page.onEditEdgeDegree(tap({ cidx: 0 }))
  assert.equal(calls.modals.length, 0)
  assert.deepEqual(calls.toasts, ['修刃已经开始，不能再修改角度'])
  done()
})

test('改角度：服务器拒绝（比如别人刚开始了修刃）→ 也要刷新订单，页面和服务器对齐', async () => {
  const { page, calls, done } = detail({ setFails: true })
  withCare(page, render(page, { edge_degree: '89' }))
  page.onEditEdgeDegree(tap({ cidx: 0 }))
  calls.modals[0].success({ confirm: true, content: '87' })
  await settle()
  assert.equal(calls.loads, 1)
  done()
})

test('改角度：改回标签上的角度，服务器说不用重打 → 不再提示重新打印', async () => {
  const { page, calls, done } = detail({ setResult: { id: 7, edge_degree: '89', label_edge_degree: '89', edgeLabelPending: false } })
  withCare(page, render(page, { edge_degree: '87', label_edge_degree: '89', edgeLabelPending: true }))
  page.onEditEdgeDegree(tap({ cidx: 0 }))
  calls.modals[0].success({ confirm: true, content: '89' })
  await settle()
  assert.deepEqual(calls.setDegree, [[7, '89', 'sk']])
  assert.equal(calls.toasts.some(t => /重新打印/.test(t)), false)
  done()
})

test('开始修刃：待重打时只提示不弹确认、不调接口；不待重打照常弹确认', async () => {
  const { page, calls, done } = detail()
  withCare(page, render(page, { edge_degree: '87', label_edge_degree: '89', edgeLabelPending: true }))
  page.onTaskStart(tap({ cidx: 0, taskId: 21, taskName: '修刃' }))
  assert.equal(calls.modals.length, 0)
  assert.equal(calls.toasts.length, 1)
  assert.match(calls.toasts[0], /请先重新打印标签存根/)
  assert.deepEqual(calls.taskStatus, [])

  withCare(page, render(page, { edge_degree: '87', label_edge_degree: null }))
  page.onTaskStart(tap({ cidx: 0, taskId: 21, taskName: '修刃' }))
  assert.equal(calls.modals.length, 1)
  assert.equal(calls.modals[0].title, '开始任务')
  calls.modals[0].success({ confirm: true })
  await settle()
  assert.equal(calls.taskStatus.length, 1)
  assert.equal(calls.taskStatus[0][0], 21)
  assert.equal(calls.taskStatus[0][1], '已开始')
  done()
})

test('开始修刃以外的任务不受影响：待重打时开始热蜡照常弹确认', () => {
  const { page, calls, done } = detail()
  withCare(page, render(page, { edge_degree: '87', label_edge_degree: '89', edgeLabelPending: true }))
  page.onTaskStart(tap({ cidx: 0, taskId: 41, taskName: '热蜡' }))
  assert.equal(calls.modals.length, 1)
  done()
})

test('标签打完（printed 事件）：待重打的装备 → 带上打印的角度调接口清状态 → 刷新订单', async () => {
  const { page, calls, done } = detail()
  withCare(page, render(page, { edge_degree: '87', label_edge_degree: '89', edgeLabelPending: true }))
  page.onLabelPrinted({ detail: { type: '标签存根', careId: 7, degree: '87' } })
  await settle()
  assert.deepEqual(calls.marked, [[7, '87', 'sk']])
  assert.equal(calls.loads, 1)
  done()
})

test('标签打完：顾客小票、不待重打的装备、不认识的装备 → 什么都不调', async () => {
  const { page, calls, done } = detail()
  withCare(page, render(page, { edge_degree: '87', label_edge_degree: '89', edgeLabelPending: true }))
  page.onLabelPrinted({ detail: { type: '顾客小票', careId: 7, degree: '87' } })
  page.onLabelPrinted({ detail: { type: '标签存根', careId: 999, degree: '87' } })
  withCare(page, render(page, { edge_degree: '87' }))
  page.onLabelPrinted({ detail: { type: '标签存根', careId: 7, degree: '87' } })
  await settle()
  assert.deepEqual(calls.marked, [])
  assert.equal(calls.loads, 0)
  done()
})

test('标签打完：服务器说打印的角度和当前对不上 → 刷新订单，状态保留（还要重打）', async () => {
  const { page, calls, done } = detail({ markFails: true })
  withCare(page, render(page, { edge_degree: '87', label_edge_degree: '89', edgeLabelPending: true }))
  page.onLabelPrinted({ detail: { type: '标签存根', careId: 7, degree: '88' } })
  await settle()
  assert.equal(calls.marked.length, 1)
  assert.equal(calls.loads, 1)
  done()
})

// ---------------- 打印组件：标签真正打完才发 printed ----------------
function printer(t, careExtra, options = {}) {
  const previousApp = global.getApp
  const previousWx = global.wx
  global.getApp = () => ({ globalData: {} })
  const writes = []
  global.wx = {
    showToast() {},
    writeBLECharacteristicValue(o) {
      writes.push(o.value.byteLength)
      if (options.failAt === writes.length) { o.fail && o.fail({ errMsg: 'fail' }) } else { o.success && o.success({}) }
      o.complete && o.complete()
    }
  }
  t.after(() => { global.getApp = previousApp; global.wx = previousWx })
  const care = Object.assign({ id: 7, equipment: '双板', brand: '测试品牌', scale: '180', need_edge: 1, need_wax: 0, free_wax: 0,
    need_unwax: 0, task_flow_code: 'WF-261125-001', customerName: '测试顾客', customerCell: '', create_date: '2026-11-25T12:11:00', urgent: 0 }, careExtra)
  const order = { id: 72071, code: 'WF_YH_261125_00006', biz_date: '2026-11-25T12:11:00', paidAmount: 0 }
  const component = loadComponent('components/care/print_care_label.js', {}, { care, order, type: options.type || 'label' })
  Object.assign(component.data, {
    order, printType: options.printType || '标签存根', connectingIndex: 0,
    availablePrinters: [{ printer: { name: 'GP-3120TUC' } }],
    currentDevice: { deviceId: 'd', writeServiceId: 's', writeUUID: 'u' }
  })
  const writesAtEvent = []
  const trigger = component.triggerEvent
  component.triggerEvent = (name, detail) => { writesAtEvent.push(writes.length); trigger.call(component, name, detail) }
  return { component, writes, writesAtEvent }
}
const printedEvents = component => component.events.filter(e => e.name === 'printed')

test('打印标签存根成功：全部数据发完后发一次 printed，带类型、装备 id 和印在标签上的角度', t => {
  const { component, writes, writesAtEvent } = printer(t, { edge_degree: '87' })
  component.print({})
  assert.ok(writes.length > 1, '标签指令超过一包，分多次写')
  assert.deepEqual(printedEvents(component).map(e => e.detail), [{ type: '标签存根', careId: 7, degree: '87' }])
  assert.deepEqual(writesAtEvent, [writes.length], '数据全部发完才发事件')
})

test('打印标签存根：edge_degree 为空时标签印的是 89，事件里也是 89', t => {
  const { component } = printer(t, { edge_degree: null })
  component.print({})
  assert.deepEqual(printedEvents(component).map(e => e.detail.degree), ['89'])
})

test('含包的存根打两张：两张都发完才发一次 printed', t => {
  const { component, writes, writesAtEvent } = printer(t, { edge_degree: '87', with_bag: true })
  component.print({})
  assert.equal(printedEvents(component).length, 1)
  assert.equal(component.data.copies, 2)
  assert.deepEqual(writesAtEvent, [writes.length])
})

test('打印顾客小票：事件的类型是顾客小票（页面据此不动角度状态）', t => {
  const { component } = printer(t, { edge_degree: '87' }, { type: 'invoice', printType: '顾客小票' })
  component.print({})
  assert.deepEqual(printedEvents(component).map(e => e.detail.type), ['顾客小票'])
})

test('某一包写失败：不发 printed（标签没打全，状态不能清）', t => {
  const { component } = printer(t, { edge_degree: '87' }, { failAt: 2 })
  component.print({})
  assert.deepEqual(printedEvents(component), [])
})

test('失败后重新打印成功：这次发 printed（上次的失败标记不会一直挡着）', t => {
  const { component } = printer(t, { edge_degree: '87' }, { failAt: 1 })
  component.print({})
  assert.deepEqual(printedEvents(component), [])
  global.wx.writeBLECharacteristicValue = o => { o.success && o.success({}); o.complete && o.complete() }
  component.print({})
  assert.equal(printedEvents(component).length, 1)
})

// ---------------- 页面结构 ----------------
test('模板：只有修刃任务（未完成的那一行）旁有「改角度」，且只在 _edgeEditable 时出现', () => {
  assert.match(wxml, /wx:if="\{\{task\.task_name === '修刃' && care\._edgeEditable\}\}"[^>]*catchtap="onEditEdgeDegree"[^>]*>改角度</)
  assert.equal((wxml.match(/onEditEdgeDegree/g) || []).length, 1)
})

test('模板：「开始」按钮在待重打时置灰（btn--disabled）；打印标签的按钮待重打时改成「重新打印标签存根」', () => {
  assert.match(wxml, /class="btn btn--primary btn--block \{\{task\._startBlocked \? 'btn--disabled' : ''\}\}"/)
  assert.match(wxml, /\{\{care\._edgeLabelPending \? '重新打印标签存根' : '打印标签存根'\}\}/)
  assert.match(wxml, /btn--print \{\{care\._edgeLabelPending \? 'btn--print-attn' : ''\}\}/)
})

test('模板：打印弹窗里的 print-care 监听 printed 事件', () => {
  assert.match(wxml, /<print-care [^>]*bind:printed="onLabelPrinted"/)
})

test('样式：改角度链接、待重打时的标签按钮都有样式', () => {
  const wxss = read('pages/admin/care/care_order_detail/care_order_detail.wxss')
  assert.match(wxss, /\.edge-edit\s*\{/)
  assert.match(wxss, /\.btn--print-attn\s*\{/)
})

// ---------------- 接口地址 ----------------
test('data.js：两个接口的地址和参数', async () => {
  const previousApp = global.getApp
  const previousWx = global.wx
  const urls = []
  global.getApp = () => ({ globalData: { requestPrefix: 'https://x.example/api/' } })
  global.wx = {
    request(o) { urls.push([o.method, o.url]); o.success({ statusCode: 200, data: { code: 0, message: '', data: { id: 7 } } }) },
    showToast() {}
  }
  const dataPath = require.resolve('../utils/data.js')
  const utilPath = require.resolve('../utils/util.js')
  delete require.cache[dataPath]
  delete require.cache[utilPath]
  try {
    const realData = require('../utils/data.js')
    await realData.setCareEdgeDegreePromise(7, '87.5', 'SK')
    await realData.markCareEdgeLabelPrintedPromise(7, '87.5', 'SK')
    await realData.markCareEdgeLabelPrintedPromise(7, null, 'SK')
  } finally {
    delete require.cache[dataPath]
    delete require.cache[utilPath]
    global.getApp = previousApp
    global.wx = previousWx
  }
  assert.deepEqual(urls, [
    ['GET', 'https://x.example/api/Care/SetEdgeDegree?careId=7&degree=87.5&sessionKey=SK'],
    ['GET', 'https://x.example/api/Care/MarkEdgeLabelPrinted?careId=7&sessionKey=SK&degree=87.5'],
    ['GET', 'https://x.example/api/Care/MarkEdgeLabelPrinted?careId=7&sessionKey=SK']
  ])
})

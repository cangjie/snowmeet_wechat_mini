// 日养护工作列表（pages/careadmin/workload）：展示整理、页面行为、接口请求、分包登记和后台菜单入口。
// 统计规则本身（初始待完成 + 新增 − 完成 = 待完成、22:00 截止、补板底 / 维修……）在后端 CareWorkloadRulesTests。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, tap } = require('./reception_harness.js')
const view = require('../utils/care_workload_view.js')

const root = path.join(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

function stat(extra) {
  return Object.assign({
    date: '2026-11-10', asOf: '2026-11-10T22:00:00', shop: '万龙服务中心', source: 'live', computedAt: '2026-11-10T22:10:33.456',
    initialPending: 12, added: 5, completed: 8, completedCancelled: 1, pending: 9, idlePending: 3, worked: 11,
    process: { edge: 7, wax: 9, scrape: 6, patchBottom: 2, repair: 1 },
    staff: [
      { staffId: 3, name: '丙', process: { edge: 1 } },
      { staffId: 1, name: '甲', process: { edge: 4 } },
      { staffId: 0, name: '', process: { edge: 1 } },
      { staffId: 2, name: '乙', process: { edge: 1 } },
      { staffId: 4, name: '丁', process: { edge: 0, wax: 5 } }
    ]
  }, extra)
}

// ---- 展示整理 ----
test('整理：进出四个数和算式、取消角标、今日养护雪板数、无操作的待完成', () => {
  const v = view.buildWorkloadView(stat())
  assert.deepEqual(v.flow, { initialPending: 12, added: 5, completed: 8, canceled: 1, hasCanceled: true, pending: 9, equation: '12 + 5 − 8 = 9' })
  assert.deepEqual(v.activity, { worked: 11, idlePending: 3 })
  assert.equal(v.flow.initialPending + v.flow.added - v.flow.completed, v.flow.pending)
  assert.equal(v.date, '2026-11-10')
  assert.equal(v.weekday, '周二')
  assert.equal(v.shopLabel, '万龙服务中心')
  assert.equal(v.asOfLabel, '统计至 22:00')
  assert.equal(v.empty, false)
})

test('整理：没有取消就不显示取消角标；不传门店 = 全部门店；快照和实时分开标', () => {
  assert.equal(view.buildWorkloadView(stat({ completedCancelled: 0 })).flow.hasCanceled, false)
  assert.equal(view.buildWorkloadView(stat({ shop: null })).shopLabel, '全部门店')
  const live = view.buildWorkloadView(stat())
  assert.deepEqual([live.isSnapshot, live.sourceLabel, live.updatedLabel], [false, '实时', '11-10 22:10'])
  const snap = view.buildWorkloadView(stat({ source: 'snapshot', computedAt: '2026-11-10 22:10:00' }))
  assert.deepEqual([snap.isSnapshot, snap.sourceLabel, snap.updatedLabel], [true, '快照', '11-10 22:10'])
})

test('整理：工序按 修刃 打蜡 刮蜡 补板底 维修 的顺序，补板底和维修各是各的数', () => {
  const v = view.buildWorkloadView(stat())
  assert.deepEqual(v.processes.map(p => [p.key, p.label, p.count]),
    [['edge', '修刃', 7], ['wax', '打蜡', 9], ['scrape', '刮蜡', 6], ['patchBottom', '补板底', 2], ['repair', '维修', 1]])
})

test('整理：每个人的修刃数量，多的排前面，同样多的按名字，没记录完成人的排最后；没修过刃的人不列；只有修刃按人展开', () => {
  const v = view.buildWorkloadView(stat())
  assert.deepEqual(v.processes[0].staff, [
    { id: 1, name: '甲', count: 4 }, { id: 3, name: '丙', count: 1 }, { id: 2, name: '乙', count: 1 }, { id: 0, name: '未记录', count: 1 }
  ])
  assert.deepEqual(v.processes.slice(1).map(p => p.staff), [[], [], [], []])
})

test('整理：员工表里没有名字的人显示「员工 id」；没有数据的结果标 empty，不报错', () => {
  assert.deepEqual(view.staffCounts([{ staffId: 7, name: '', process: { edge: 2 } }], 'edge'), [{ id: 7, name: '员工7', count: 2 }])
  const empty = view.buildWorkloadView({ date: '2026-11-11', process: {}, staff: [] })
  assert.equal(empty.empty, true)
  assert.deepEqual(empty.processes.map(p => p.count), [0, 0, 0, 0, 0])
  const none = view.buildWorkloadView(null)
  assert.equal(none.empty, true)
  assert.equal(none.shopLabel, '全部门店')
})

test('日期：前一天 / 后一天、跨月跨年、星期', () => {
  assert.equal(view.shiftDate('2026-11-10', -1), '2026-11-09')
  assert.equal(view.shiftDate('2026-11-30', 1), '2026-12-01')
  assert.equal(view.shiftDate('2026-01-01', -1), '2025-12-31')
  assert.equal(view.shiftDate('不是日期', 1), '不是日期')
  assert.deepEqual(['2026-11-08', '2026-11-09', '2026-11-14'].map(view.weekdayOf), ['周日', '周一', '周六'])
})

// ---- 页面行为 ----
function setup(t, handler) {
  const calls = []
  global.getApp = () => ({ globalData: { sessionKey: 'sk', staff: { id: 1, title_level: 100 } }, loginPromiseNew: Promise.resolve() })
  global.wx = { stopPullDownRefresh() { calls.stopped = (calls.stopped || 0) + 1 } }
  t.after(() => { delete global.getApp; delete global.wx })
  const page = loadPage('pages/careadmin/workload/workload.js', {
    getCareDailyWorkloadPromise: (date, shop, sessionKey) => { calls.push({ date, shop, sessionKey }); return handler ? handler(date, shop) : Promise.resolve(stat({ date, shop })) }
  })
  return { page, calls }
}
const settle = () => new Promise(resolve => setTimeout(resolve, 5))
const today = () => {
  const d = new Date()
  const pad = n => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

test('进页面：默认今天、全部门店，登录后查一次并显示结果', async t => {
  const { page, calls } = setup(t)
  page.onLoad()
  assert.equal(page.data.date, today())
  assert.equal(page.data.isToday, true)
  page.onShow(); await settle()
  assert.deepEqual(calls, [{ date: today(), shop: null, sessionKey: 'sk' }])
  assert.equal(page.data.report.flow.pending, 9)
  assert.equal(page.data.querying, false)
  assert.equal(page.data.staff.title_level, 100)
})

test('换门店重新查；选「全部店铺」等于不限门店；同一家店不重复查', async t => {
  const { page, calls } = setup(t)
  page.onLoad(); page.onShow(); await settle()
  page.shopSelected({ detail: { shop: '崇礼旗舰店' } }); await settle()
  assert.deepEqual(calls.map(c => c.shop), [null, '崇礼旗舰店'])
  page.shopSelected({ detail: { shop: '崇礼旗舰店' } }); await settle()
  assert.equal(calls.length, 2)
  page.shopSelected({ detail: { shop: '全部店铺' } }); await settle()
  assert.deepEqual(calls.map(c => c.shop), [null, '崇礼旗舰店', null])
})

test('日期：前一天 / 后一天 / 回到今天；今天不能再往后；不能选还没到的日期', async t => {
  const { page, calls } = setup(t)
  page.onLoad(); page.onShow(); await settle()
  page.onNextDay(); await settle()                                  // 今天已经是最后一天
  assert.equal(calls.length, 1)
  page.onPrevDay(); await settle()
  assert.equal(page.data.date, view.shiftDate(today(), -1))
  assert.equal(page.data.isToday, false)
  page.onNextDay(); await settle()
  assert.deepEqual([page.data.date, page.data.isToday], [today(), true])
  page.onDateChange({ detail: { value: '2026-11-01' } }); await settle()
  assert.equal(calls.at(-1).date, '2026-11-01')
  page.onDateChange({ detail: { value: view.shiftDate(today(), 3) } }); await settle()
  assert.equal(page.data.date, '2026-11-01')                         // 将来的日期不接受
  page.onToday(); await settle()
  assert.equal(page.data.date, today())
})

test('连续切换时只认最后一次请求的结果（先发的后到也不覆盖）', async t => {
  const pending = []
  const { page } = setup(t, (date, shop) => new Promise(resolve => pending.push({ shop, resolve })))
  page.onLoad(); page.onShow(); await settle()
  page.shopSelected({ detail: { shop: '崇礼旗舰店' } }); await settle()
  pending[1].resolve(stat({ shop: '崇礼旗舰店', pending: 2 })); await settle()
  pending[0].resolve(stat({ shop: null, pending: 99 })); await settle()
  assert.equal(page.data.report.flow.pending, 2)
  assert.equal(page.data.report.shopLabel, '崇礼旗舰店')
})

test('查询失败：给提示、不留「加载中」；下拉刷新会重查并收起刷新动画', async t => {
  let fail = true
  const { page, calls } = setup(t, (date, shop) => fail ? Promise.reject('没有权限') : Promise.resolve(stat({ date, shop })))
  const log = console.log; console.log = () => {}; t.after(() => { console.log = log })
  page.onLoad(); page.onShow(); await settle()
  assert.match(page.data.errorText, /查询失败/)
  assert.equal(page.data.querying, false)
  fail = false
  await page.onPullDownRefresh()
  assert.equal(page.data.errorText, '')
  assert.equal(page.data.report.flow.pending, 9)
  assert.equal(calls.length, 2)
  assert.equal(calls.stopped, 1)   // 下拉刷新查完收起动画
})

// ---- 接口请求 ----
test('data.js：GET CareWorkload/GetDailyWorkloadByStaff，带会话、日期、门店（门店要编码）', async t => {
  const requests = []
  global.getApp = () => ({ globalData: { requestPrefix: 'https://api.test/api/', domainName: 'api.test', sessionKey: 'sk' } })
  global.wx = {
    request(o) { requests.push(o); o.success({ statusCode: 200, data: { code: 0, message: '', data: { pending: 5 } } }) },
    showToast() {}
  }
  t.after(() => { delete global.getApp; delete global.wx; delete require.cache[require.resolve('../utils/data.js')] })
  delete require.cache[require.resolve('../utils/data.js')]
  const data = require('../utils/data.js')
  assert.deepEqual(await data.getCareDailyWorkloadPromise('2026-11-10', '万龙服务中心', 'sk'), { pending: 5 })
  await data.getCareDailyWorkloadPromise(null, null, 'sk')
  assert.equal(requests[0].url, 'https://api.test/api/CareWorkload/GetDailyWorkloadByStaff?sessionKey=sk&date=2026-11-10&shop=' + encodeURIComponent('万龙服务中心'))
  assert.equal(requests[1].url, 'https://api.test/api/CareWorkload/GetDailyWorkloadByStaff?sessionKey=sk')
})

// ---- 登记与入口 ----
test('app.json：放在自己的分包里（主包体积紧张），四个文件齐全、JSON 合法', () => {
  const app = JSON.parse(read('app.json'))
  const sub = app.subPackages.find(s => s.root === 'pages/careadmin')
  assert.ok(sub, '缺少 pages/careadmin 分包')
  assert.deepEqual(sub.pages, ['workload/workload', 'workload_items/workload_items'])
  assert.ok(!app.pages.some(p => p.indexOf('pages/careadmin/') === 0), '不应同时出现在主包')
  for (const page of sub.pages) {
    for (const ext of ['js', 'json', 'wxml', 'wxss']) assert.ok(fs.existsSync(path.join(root, 'pages/careadmin', page + '.' + ext)), page + '.' + ext + ' 不存在')
    JSON.parse(read('pages/careadmin/' + page + '.json'))
  }
  const json = JSON.parse(read('pages/careadmin/workload/workload.json'))
  assert.equal(json.navigationBarTitleText, '日养护工作列表')
  assert.ok(fs.existsSync(path.join(root, 'components/shop_selector/shop_selector.js')))
  assert.equal(json.usingComponents['shop-selector'], '/components/shop_selector/shop_selector')
})

test('后台菜单有「【养护】日养护工作列表」，点了进新页面', () => {
  const menu = read('pages/admin/admin.wxml')
  assert.match(menu, /<mp-cell id="care_daily_workload" value="【养护】日养护工作列表" bindtap="nav"/)
  assert.match(read('pages/admin/admin.js'), /case 'care_daily_workload':\s*path = '\/pages\/careadmin\/workload\/workload'/)
})

test('模板：进出四个数、今日养护雪板数量、无操作的待完成、五个工序数量和每人修刃都在；事件处理函数都已定义', () => {
  const wxml = read('pages/careadmin/workload/workload.wxml')
  for (const text of ['初始待完成', '新增', '完成', '待完成', '今日养护雪板数量', '待完成里今天没有操作的', '{{item.label}}数量', 'person.name', 'report.flow.canceled', 'report.sourceLabel']) {
    assert.ok(wxml.includes(text), '模板缺少 ' + text)
  }
  const js = read('pages/careadmin/workload/workload.js')
  for (const m of wxml.matchAll(/bind(?:tap|change|ShopSelected)="(\w+)"/g)) {
    assert.match(js, new RegExp('\\n  ' + m[1] + '\\('), '页面里没有定义 ' + m[1])
  }
  assert.match(wxml, /<picker mode="date" value="\{\{date\}\}" end="\{\{today\}\}"/)   // 不能选将来的日期
  // 口径说明写在页面上：只差发板算完成；非雪季养护、老单、测试单不统计
  assert.ok(wxml.includes('只差发板就算完成'), '进出统计要说明「只差发板算完成」')
  assert.ok(wxml.includes('发板不算'), '今日养护雪板数量要说明发板不算养护操作')
  assert.ok(wxml.includes('不统计：非雪季养护、2026-04-30 以前开的单、测试单'), '要说明哪些装备不统计')
})

// ================= 点数字看明细 =================
const careOrderRows = require('../utils/care_order_rows.js')

test('明细页地址：带统计项、日期、门店；只看某个人时带人；参数都编码', () => {
  assert.equal(view.itemsUrl({ metric: 'pending', date: '2026-11-10', shop: null }),
    '/pages/careadmin/workload_items/workload_items?metric=pending&date=2026-11-10')
  assert.equal(view.itemsUrl({ metric: 'edge', date: '2026-11-10', shop: '万龙服务中心', staffId: 28, staffName: '王政-工作号' }),
    '/pages/careadmin/workload_items/workload_items?metric=edge&date=2026-11-10&shop=' + encodeURIComponent('万龙服务中心')
    + '&staffId=28&staffName=' + encodeURIComponent('王政-工作号'))
  // 没记录完成人的那一行 staffId 是 0，也要带上
  assert.match(view.itemsUrl({ metric: 'edge', date: '2026-11-10', staffId: 0, staffName: '未记录' }), /&staffId=0&staffName=/)
})

test('明细页标题：每个数各有名字；工序带「数量」，只看某个人时带上人名', () => {
  assert.deepEqual(['initialPending', 'added', 'completed', 'pending', 'idlePending', 'worked'].map(m => view.metricTitle(m)),
    ['初始待完成', '新增', '完成', '待完成', '待完成里今天没有操作的', '今日养护雪板'])
  assert.equal(view.metricTitle('edge'), '修刃数量')
  assert.equal(view.metricTitle('patchBottom'), '补板底数量')
  assert.equal(view.metricTitle('edge', '王政-工作号'), '修刃数量 · 王政-工作号')
  assert.equal(view.metricTitle('nope'), '')
})

function itemsResult(extra) {
  return Object.assign({
    date: '2026-11-10', asOf: '2026-11-10T22:00:00', shop: '万龙服务中心', metric: 'pending', staffId: null, total: 2,
    items: [
      { careId: 11, orderId: 501, orderCode: 'WF_YH_261109_00002', shop: '万龙服务中心', equipment: '双板', brand: 'Atomic/阿托米克', scale: '160',
        customerName: '张 先生', orderDate: '2026-11-09T10:00:00', enteredAt: '2026-11-09T10:05:00', finishedAt: null, isCancel: false,
        tasks: [{ id: 1, name: '安全检查', status: '已完成', sort: 10 }, { id: 2, name: '修刃', status: '未开始', sort: 20 }, { id: 3, name: '发板', status: '未开始', sort: 60 }], hits: [] },
      { careId: 12, orderId: 502, orderCode: 'WF_YH_261110_00001', shop: '万龙服务中心', equipment: '单板', brand: 'Burton', scale: '155',
        customerName: '', orderDate: '2026-11-10T09:00:00', enteredAt: '2026-11-10T09:02:00', finishedAt: '2026-11-10T14:30:00', isCancel: false,
        tasks: [{ id: 4, name: '安全检查', status: '已完成', sort: 10 }, { id: 5, name: '热蜡', status: '已完成', sort: 40 }, { id: 6, name: '发板', status: '未开始', sort: 60 }], hits: [] }
    ]
  }, extra)
}

test('明细整理：订单号、装备标题和图标、顾客、进店 / 完成时间；进度和任务着色沿用养护订单列表那一套', () => {
  const v = view.buildItemsView(itemsResult(), careOrderRows)
  assert.equal(v.countLabel, '共 2 块雪板')
  assert.equal(v.shopLabel, '万龙服务中心')
  assert.equal(v.asOfLabel, '统计至 22:00')
  assert.equal(v.empty, false)
  const [a, b] = v.items
  assert.deepEqual([a.careId, a.orderId, a.orderCode, a.title, a.customerName], [11, 501, 'WF_YH_261109_00002', 'Atomic · 160cm', '张 先生'])
  assert.match(a.iconSrc, /icon-ski-double/)
  assert.equal(a.enteredLabel, '11-09 10:05')            // 不是当天进店的带日期
  assert.equal(a.finishedLabel, '')
  assert.deepEqual([a.statusLabel, a.statusClass], ['未开始', 'idle'])
  assert.deepEqual(a.tasks.map(t => [t.name, t.cls]), [['安全检查', 'done'], ['修刃', 'idle'], ['发板', 'idle']])
  assert.equal(b.enteredLabel, '09:02')                  // 当天的只写时间
  assert.equal(b.finishedLabel, '14:30')
  assert.deepEqual([b.statusLabel, b.statusClass], ['待发板', 'ready'])   // 工序做完只差发板
  assert.match(b.iconSrc, /icon-snowboard/)
})

test('明细整理：工序类的数列出谁在几点做完的，条数按任务算；空结果不报错', () => {
  const r = itemsResult({ metric: 'wax', total: 3, items: [Object.assign({}, itemsResult().items[1], {
    hits: [{ kind: 'wax', taskName: '养板打蜡1', staffId: 28, staffName: '王政-工作号', endTime: '2026-11-10T13:05:00' },
      { kind: 'wax', taskName: '养板打蜡2', staffId: 0, staffName: '', endTime: '2026-11-10T14:10:00' },
      { kind: 'wax', taskName: '养板打蜡3', staffId: 31, staffName: '', endTime: null }]
  })] })
  const v = view.buildItemsView(r, careOrderRows)
  assert.equal(v.isProcess, true)
  assert.equal(v.countLabel, '共 3 道工序，1 块雪板')
  assert.deepEqual(v.items[0].hits.map(h => h.text), ['养板打蜡1 · 王政-工作号 · 13:05', '养板打蜡2 · 未记录 · 14:10', '养板打蜡3 · 员工31'])
  const none = view.buildItemsView({ metric: 'pending', total: 0, items: [] }, careOrderRows)
  assert.deepEqual([none.empty, none.countLabel, none.shopLabel], [true, '共 0 块雪板', '全部门店'])
  assert.equal(view.buildItemsView(null, careOrderRows).empty, true)
})

test('统计页：点数字跳明细页（带日期、门店）；修刃下面某个人那一行只看这个人；数字是 0 不跳', async t => {
  const { page } = setup(t)
  const nav = []
  global.wx.navigateTo = o => nav.push(o.url)
  page.onLoad(); page.onShow(); await settle()
  page.shopSelected({ detail: { shop: '万龙服务中心' } }); await settle()
  page.onMetricTap(tap({ metric: 'pending', count: 9 }))
  page.onMetricTap(tap({ metric: 'edge', count: 4, staff: 1, staffname: '甲' }))
  page.onMetricTap(tap({ metric: 'edge', count: 1, staff: 0, staffname: '未记录' }))
  page.onMetricTap(tap({ metric: 'repair', count: 0 }))
  page.onMetricTap(tap({ count: 3 }))
  const shop = encodeURIComponent('万龙服务中心')
  assert.deepEqual(nav, [
    '/pages/careadmin/workload_items/workload_items?metric=pending&date=' + today() + '&shop=' + shop,
    '/pages/careadmin/workload_items/workload_items?metric=edge&date=' + today() + '&shop=' + shop + '&staffId=1&staffName=' + encodeURIComponent('甲'),
    '/pages/careadmin/workload_items/workload_items?metric=edge&date=' + today() + '&shop=' + shop + '&staffId=0&staffName=' + encodeURIComponent('未记录')
  ])
})

test('统计页模板：进出四个数、两个操作数、每个工序和每个人的修刃都能点，带上各自的统计项', () => {
  const wxml = read('pages/careadmin/workload/workload.wxml')
  for (const m of ['initialPending', 'added', 'completed', 'pending', 'worked', 'idlePending']) {
    assert.match(wxml, new RegExp('data-metric="' + m + '" data-count="\\{\\{report\\.(flow|activity)\\.' + m + '\\}\\}" bindtap="onMetricTap"'), m + ' 应该能点')
  }
  assert.match(wxml, /data-metric="\{\{item\.key\}\}" data-count="\{\{item\.count\}\}" bindtap="onMetricTap"/)
  assert.match(wxml, /data-metric="\{\{item\.key\}\}" data-count="\{\{person\.count\}\}" data-staff="\{\{person\.id\}\}" data-staffname="\{\{person\.name\}\}" bindtap="onMetricTap"/)
  assert.ok(wxml.includes('点任何一个数字，可以看对应的雪板和订单'))
})

function setupItems(t, handler) {
  const calls = []
  const wxCalls = { titles: [], nav: [], stopped: 0 }
  global.getApp = () => ({ globalData: { sessionKey: 'sk', staff: { id: 1, title_level: 100 } }, loginPromiseNew: Promise.resolve() })
  global.wx = {
    setNavigationBarTitle: o => wxCalls.titles.push(o.title), navigateTo: o => wxCalls.nav.push(o.url),
    stopPullDownRefresh() { wxCalls.stopped++ }
  }
  t.after(() => { delete global.getApp; delete global.wx })
  const page = loadPage('pages/careadmin/workload_items/workload_items.js', {
    getCareDailyWorkloadItemsPromise: (date, shop, metric, staffId, sessionKey) => {
      calls.push({ date, shop, metric, staffId, sessionKey })
      return handler ? handler() : Promise.resolve(itemsResult())
    }
  })
  return { page, calls, wxCalls }
}

test('明细页：解码参数、设标题、按参数查询并显示；点一行进养护订单详情', async t => {
  const { page, calls, wxCalls } = setupItems(t)
  page.onLoad({ metric: 'pending', date: '2026-11-10', shop: encodeURIComponent('万龙服务中心') })
  assert.deepEqual([page.data.metric, page.data.date, page.data.shop, page.data.staffId, page.data.title], ['pending', '2026-11-10', '万龙服务中心', null, '待完成'])
  assert.deepEqual(wxCalls.titles, ['待完成'])
  page.onShow(); await settle()
  assert.deepEqual(calls, [{ date: '2026-11-10', shop: '万龙服务中心', metric: 'pending', staffId: null, sessionKey: 'sk' }])
  assert.equal(page.data.view.items.length, 2)
  assert.equal(page.data.querying, false)
  page.gotoDetail(tap({ orderid: 501, careid: 11 }))
  assert.deepEqual(wxCalls.nav, ['/pages/admin/care/care_order_detail/care_order_detail?orderId=501&careId=11'])
})

test('明细页：只看某个人的工序（含没记录完成人的 0）、全部门店不带门店；查询失败给提示，下拉重试', async t => {
  let fail = false
  const { page, calls, wxCalls } = setupItems(t, () => fail ? Promise.reject('x') : Promise.resolve(itemsResult({ metric: 'edge' })))
  page.onLoad({ metric: 'edge', date: '2026-11-10', staffId: '28', staffName: encodeURIComponent('王政-工作号') })
  assert.deepEqual([page.data.shop, page.data.staffId, page.data.title], [null, 28, '修刃数量 · 王政-工作号'])
  page.onShow(); await settle()
  assert.deepEqual(calls[0], { date: '2026-11-10', shop: null, metric: 'edge', staffId: 28, sessionKey: 'sk' })
  const zero = setupItems(t)
  zero.page.onLoad({ metric: 'edge', date: '2026-11-10', staffId: '0', staffName: encodeURIComponent('未记录') })
  assert.deepEqual([zero.page.data.staffId, zero.page.data.title], [0, '修刃数量 · 未记录'])
  const log = console.log; console.log = () => {}; t.after(() => { console.log = log })
  fail = true
  await page.onPullDownRefresh()
  assert.match(page.data.errorText, /查询失败/)
  assert.equal(page.data.querying, false)
  fail = false
  await page.onPullDownRefresh()
  assert.equal(page.data.errorText, '')
})

test('data.js：GET CareWorkload/GetDailyWorkloadItemsByStaff，带统计项，日期 / 门店 / 人有才带（人是 0 也带）', async t => {
  const requests = []
  global.getApp = () => ({ globalData: { requestPrefix: 'https://api.test/api/', domainName: 'api.test', sessionKey: 'sk' } })
  global.wx = {
    request(o) { requests.push(o); o.success({ statusCode: 200, data: { code: 0, message: '', data: { total: 0, items: [] } } }) },
    showToast() {}
  }
  t.after(() => { delete global.getApp; delete global.wx; delete require.cache[require.resolve('../utils/data.js')] })
  delete require.cache[require.resolve('../utils/data.js')]
  const data = require('../utils/data.js')
  await data.getCareDailyWorkloadItemsPromise('2026-11-10', '万龙服务中心', 'edge', 28, 'sk')
  await data.getCareDailyWorkloadItemsPromise(null, null, 'pending', null, 'sk')
  await data.getCareDailyWorkloadItemsPromise('2026-11-10', null, 'edge', 0, 'sk')
  const base = 'https://api.test/api/CareWorkload/GetDailyWorkloadItemsByStaff?sessionKey=sk&metric='
  assert.equal(requests[0].url, base + 'edge&date=2026-11-10&shop=' + encodeURIComponent('万龙服务中心') + '&staffId=28')
  assert.equal(requests[1].url, base + 'pending')
  assert.equal(requests[2].url, base + 'edge&date=2026-11-10&staffId=0')
})

test('明细页模板：标题、条数、订单号、装备、进度、时间、工序完成人都在；点一行带订单和装备 id；事件处理函数都已定义', () => {
  const wxml = read('pages/careadmin/workload_items/workload_items.wxml')
  for (const text of ['{{title}}', 'view.countLabel', 'item.orderCode', 'item.title', 'item.customerName', 'item.statusLabel', 'tk.name', 'item.enteredLabel', 'item.finishedLabel', 'hit.text', '没有对应的雪板']) {
    assert.ok(wxml.includes(text), '模板缺少 ' + text)
  }
  assert.match(wxml, /data-orderid="\{\{item\.orderId\}\}" data-careid="\{\{item\.careId\}\}" bindtap="gotoDetail"/)
  const js = read('pages/careadmin/workload_items/workload_items.js')
  for (const m of wxml.matchAll(/bind(?:tap|change)="(\w+)"/g)) assert.match(js, new RegExp('\\n  ' + m[1] + '\\('), '页面里没有定义 ' + m[1])
  const wxss = read('pages/careadmin/workload_items/workload_items.wxss')
  for (const cls of ['idle', 'run', 'ready', 'done', 'cancel']) assert.match(wxss, new RegExp('\\.item-card--' + cls + '\\s*\\{'))
})

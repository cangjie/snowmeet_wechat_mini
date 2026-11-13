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
    { name: '甲', count: 4 }, { name: '丙', count: 1 }, { name: '乙', count: 1 }, { name: '未记录', count: 1 }
  ])
  assert.deepEqual(v.processes.slice(1).map(p => p.staff), [[], [], [], []])
})

test('整理：员工表里没有名字的人显示「员工 id」；没有数据的结果标 empty，不报错', () => {
  assert.deepEqual(view.staffCounts([{ staffId: 7, name: '', process: { edge: 2 } }], 'edge'), [{ name: '员工7', count: 2 }])
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
  assert.deepEqual(sub.pages, ['workload/workload'])
  assert.ok(!app.pages.some(p => p.indexOf('pages/careadmin/') === 0), '不应同时出现在主包')
  for (const ext of ['js', 'json', 'wxml', 'wxss']) assert.ok(fs.existsSync(path.join(root, 'pages/careadmin/workload/workload.' + ext)), ext + ' 不存在')
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
})

// 租赁开单：租金按「门市价 / 预约价」收，并把选择记下来（2026-11-15 用户要求）。
//   1) 布局：卡/优惠券输入框右移（挪到第二行右侧），租金和押金两个框互换（租金在左、押金在右），租金下面是价目单选；
//   2) 租金预设 pricePresets[0].scene 记下是门市还是预约（后端据此生成每天的日租金并写 rental_detail.scene）；
//   3) 这个商品没有预约价：「预约价」单选保持灰色不可选；
//   4) 切换价目：租金/日换成该场景当天的价；店员手改的价不动、只记场景；那天没有对应价目就不切并提示；
//   5) 改起租日期：预约价的租赁按预约价目重算，那天没有预约价就退回门市价（并提示）；换品类：预约价的预设作废。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const COMP = path.join(__dirname, '../components/reception/rent_recept_form')
const WXML = fs.readFileSync(path.join(COMP, 'rent_recept_form.wxml'), 'utf8')
const WXSS = fs.readFileSync(path.join(COMP, 'rent_recept_form.wxss'), 'utf8')

function formatDate(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function daysFromToday(n) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return formatDate(d)
}
function setByPath(obj, pathStr, value) {
  const keys = pathStr.replace(/\[(\d+)\]/g, '.$1').split('.')
  let cur = obj
  keys.slice(0, -1).forEach(k => { cur = cur[k] })
  cur[keys[keys.length - 1]] = value
}

// 门市价目 260/360；预约价目 190/290（日场、下午场、夜场都有，今天开单也取得到）
function list(scene, weekday, weekend) {
  const out = []
  ;['日场', '下午场', '夜场'].forEach(t => {
    out.push({ day_type: '平日', rent_type: t, scene, price: weekday })
    out.push({ day_type: '周末', rent_type: t, scene, price: weekend })
  })
  return out
}
const SHOP_LIST = list('门市', 260, 360)
const RESERVE_LIST = list('预约', 190, 290)
const dayPrice = (date, weekday, weekend) => {
  const d = new Date(date + 'T00:00:00')
  return d.getDay() === 0 || d.getDay() === 6 ? weekend : weekday
}

// reserveLists：{ '套餐|41': [...] } 之类没有的就返回空表（该商品没有预约价）
function loadForm(displayRentals, { reserveList = RESERVE_LIST } = {}) {
  const dataPath = require.resolve('../utils/data.js')
  const utilPath = require.resolve('../utils/util.js')
  const file = require.resolve(path.join(COMP, 'rent_recept_form.js'))
  const originalData = require.cache[dataPath]
  const originalUtil = require.cache[utilPath]
  const queries = []
  const fakeData = {
    getShopByNamePromise: async () => ({ id: 10 }),
    getRentPriceListPromise: async (shopId, type, id, scene) => {
      queries.push([shopId, type, id, scene])
      return scene === '预约' ? reserveList : SHOP_LIST
    },
    getRentCategoryPromise: async id => ({ id, name: '【FIS】双板', deposit: 500, associateCategories: [] }),
  }
  require.cache[dataPath] = { id: dataPath, filename: dataPath, loaded: true, exports: fakeData }
  // 真实的 util（取价目价要用 getRentPrice），只把 createRentalDetail 换成空函数
  const realUtil = originalUtil ? originalUtil.exports : require(utilPath)
  const stubUtil = Object.assign({}, realUtil, { createRentalDetail() {} })
  require.cache[utilPath] = { id: utilPath, filename: utilPath, loaded: true, exports: stubUtil }
  const calls = { toasts: [] }
  global.wx = { showToast(o) { calls.toasts.push(o.title) }, showLoading() {}, hideLoading() {}, showModal() {} }
  delete require.cache[file]
  let definition = null
  global.Component = value => { definition = value }
  require(file)
  delete global.Component
  delete require.cache[file]
  const syncs = []
  const instance = {
    data: { displayRentals, expandedItem: {}, expandedPkg: {} },
    properties: { shop: '万龙服务中心' },
    setData(values, cb) { Object.keys(values).forEach(k => setByPath(this.data, k, values[k])); if (cb) cb() },
    triggerEvent(name, detail) { if (name === 'syncRent') syncs.push(JSON.parse(JSON.stringify(detail))) },
  }
  Object.keys(definition.methods).forEach(name => { instance[name] = definition.methods[name].bind(instance) })
  instance._updateRentalChip = () => {}
  const restore = () => {
    delete require.cache[file]
    if (originalData) require.cache[dataPath] = originalData; else delete require.cache[dataPath]
    if (originalUtil) require.cache[utilPath] = originalUtil; else delete require.cache[utilPath]
  }
  return { instance, syncs, calls, queries, restore }
}

// 明天起租（日场，价格不随钟点变），门市价
function rental(extra) {
  const date = daysFromToday(2)
  return Object.assign({
    id: 7, name: '普通单板套餐', package_id: 41, category_id: 3, pick_type: '延时租赁', atOnce: true,
    start_date: date + 'T00:00:00', priceList: SHOP_LIST,
    guaranty: 1000, realGuaranty: 1000, guaranty_discount: 0,
    pricePresets: [{ id: 9, rental_id: 7, rent_date: date, day_type: '平日', rent_type: '日场', scene: '门市',
      price: dayPrice(date, 260, 360), discount: 0, manual: false }],
    rentItems: [{ id: 1, name: '雪板', code: 'B', noCode: false, category_id: 3, pick_type: '延时租赁', atOnce: true }],
  }, extra || {})
}
const tapScene = (scene, ridx = 0) => ({ currentTarget: { dataset: { ridx, scene } } })
const preset0 = instance => instance.data.displayRentals[0].pricePresets[0]
const syncedPreset = syncs => syncs[syncs.length - 1].rentals[0].pricePresets[0]

// ---------- 布局 ----------

test('布局：第一行租金在前、押金在后；第二行左边是价目单选、右边是卡输入框（右移）', () => {
  const rent = WXML.indexOf('onPkgRateTap')
  const deposit = WXML.indexOf('onPkgDepositTap')
  assert.ok(rent > 0 && deposit > 0)
  assert.ok(rent < deposit, '租金框在押金框前面')

  const sceneRow = WXML.indexOf('kv-row--scene')
  assert.ok(sceneRow > deposit, '价目单选在租金/押金这一行下面')
  const radios = WXML.indexOf('onPkgSceneTap', sceneRow)
  const card = WXML.indexOf('onPkgCoachCardTap', sceneRow)
  assert.ok(radios > 0 && card > radios, '卡的输入框在价目单选右边')
  // 租金下面：单选和租金框在同一列（两行的第一格）
  assert.ok(sceneRow > rent)
})

test('价目单选：门市价 / 预约价两个选项，没有预约价时带 disabled 样式', () => {
  const start = WXML.indexOf('kv-cell--scene')
  const block = WXML.slice(start, WXML.indexOf('onPkgCoachCardTap', start))
  assert.match(block, /data-scene="门市"/)
  assert.match(block, /data-scene="预约"/)
  assert.match(block, /门市价/)
  assert.match(block, /预约价/)
  assert.match(block, /scene-radio--on/)
  assert.match(block, /scene-radio--disabled/)
  assert.match(block, /pkg\._reserveAvailable \? '' : 'scene-radio--disabled'/)
  assert.match(WXSS, /\.scene-radio--disabled\s*\{[^}]*opacity/)
})

// ---------- 价目场景的来源 ----------

test('租赁的价目场景取自价格预设：预约就是预约，门市 / 会员 / 空 / 没有预设都显示门市价', () => {
  const cases = [['预约', '预约'], ['门市', '门市'], ['会员', '门市'], ['', '门市'], [null, '门市']]
  for (const [scene, want] of cases) {
    const date = daysFromToday(2)
    const { instance, restore } = loadForm([])
    try {
      instance._refreshRentals([rental({ pricePresets: [{ id: 9, rent_date: date, day_type: '平日', rent_type: '日场', scene, price: 190, manual: false }] })])
      assert.equal(instance.data.displayRentals[0]._priceScene, want, `scene=${scene}`)
    } finally { restore() }
  }
  const { instance, restore } = loadForm([])
  try {
    instance._refreshRentals([rental({ pricePresets: [] })])
    assert.equal(instance.data.displayRentals[0]._priceScene, '门市')
  } finally { restore() }
})

test('没有预约价的商品：预约价单选保持不可选；有预约价才可选', async () => {
  const none = loadForm([], { reserveList: [] })
  try {
    none.instance._refreshRentals([rental()])
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(none.instance.data.displayRentals[0]._reserveAvailable, false)
  } finally { none.restore() }

  const has = loadForm([])
  try {
    has.instance._refreshRentals([rental()])
    assert.equal(has.instance.data.displayRentals[0]._reserveAvailable, false, '价目还没查回来时先灰着')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(has.instance.data.displayRentals[0]._reserveAvailable, true)
    // 已缓存的不重复查
    const before = has.queries.length
    await has.instance._ensureReserveLists()
    assert.equal(has.queries.length, before)
    assert.deepEqual(has.queries[0], [10, '套餐', 41, '预约'])
  } finally { has.restore() }
})

// ---------- 切换价目 ----------

async function formWithReserve(extra) {
  const f = loadForm([])
  f.instance._refreshRentals([rental(extra)])
  await new Promise(resolve => setImmediate(resolve))
  return f
}

test('点预约价：租金/日换成预约价目的价，预设记 scene=预约，随保存带给后端', async () => {
  const { instance, syncs, restore } = await formWithReserve()
  try {
    const date = daysFromToday(2)
    instance.onPkgSceneTap(tapScene('预约'))
    await new Promise(resolve => setImmediate(resolve))
    const p = preset0(instance)
    assert.equal(p.scene, '预约')
    assert.equal(p.price, dayPrice(date, 190, 290))
    assert.equal(p.rent_date, date)
    assert.equal(instance.data.displayRentals[0]._priceScene, '预约')
    assert.equal(instance.data.displayRentals[0]._dailyRate, dayPrice(date, 190, 290))
    assert.equal(syncedPreset(syncs).scene, '预约', '保存时预设里带着预约')
    assert.equal(syncedPreset(syncs).price, dayPrice(date, 190, 290))
  } finally { restore() }
})

test('再点回门市价：价格回到门市价目，scene=门市', async () => {
  const { instance, syncs, restore } = await formWithReserve()
  try {
    const date = daysFromToday(2)
    instance.onPkgSceneTap(tapScene('预约'))
    await new Promise(resolve => setImmediate(resolve))
    instance.onPkgSceneTap(tapScene('门市'))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(preset0(instance).scene, '门市')
    assert.equal(preset0(instance).price, dayPrice(date, 260, 360))
    assert.equal(instance.data.displayRentals[0]._priceScene, '门市')
    assert.equal(syncedPreset(syncs).scene, '门市')
  } finally { restore() }
})

test('没有预约价的商品：点预约价没反应，价格、场景、同步都不变', async () => {
  const f = loadForm([], { reserveList: [] })
  try {
    f.instance._refreshRentals([rental()])
    await new Promise(resolve => setImmediate(resolve))
    const before = JSON.stringify(preset0(f.instance))
    f.instance.onPkgSceneTap(tapScene('预约'))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(JSON.stringify(preset0(f.instance)), before)
    assert.equal(f.syncs.length, 0)
    assert.equal(f.instance.data.displayRentals[0]._priceScene, '门市')
  } finally { f.restore() }
})

test('点已选中的场景：什么都不做', async () => {
  const { instance, syncs, restore } = await formWithReserve()
  try {
    instance.onPkgSceneTap(tapScene('门市'))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(syncs.length, 0)
  } finally { restore() }
})

test('店员手改过租金：切到预约价不冲掉手改的价，只记下场景', async () => {
  const date = daysFromToday(2)
  const { instance, restore } = await formWithReserve({
    pricePresets: [{ id: 9, rent_date: date, day_type: '平日', rent_type: '日场', scene: '门市', price: 123, discount: 0, manual: true }],
  })
  try {
    instance.onPkgSceneTap(tapScene('预约'))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(preset0(instance).price, 123)
    assert.equal(preset0(instance).manual, true)
    assert.equal(preset0(instance).scene, '预约')
  } finally { restore() }
})

test('起租那天预约价目里没有价：不切换并提示，价格和场景保持原样', async () => {
  // 预约价目只有「周末」的价，起租日是平日（或反之）时取不到
  const date = daysFromToday(2)
  const weekend = dayPrice(date, 0, 1) === 1
  const onlyOtherDay = RESERVE_LIST.filter(p => p.day_type === (weekend ? '平日' : '周末'))
  const f = loadForm([], { reserveList: onlyOtherDay })
  try {
    f.instance._refreshRentals([rental()])
    await new Promise(resolve => setImmediate(resolve))
    // 有预约价目（别的日子），单选可点；但这一天取不到价
    assert.equal(f.instance.data.displayRentals[0]._reserveAvailable, true)
    f.instance.onPkgSceneTap(tapScene('预约'))
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(f.calls.toasts, ['这一天没有预约价'])
    assert.equal(preset0(f.instance).scene, '门市')
    assert.equal(preset0(f.instance).price, dayPrice(date, 260, 360))
    assert.equal(f.syncs.length, 0)
  } finally { f.restore() }
})

// ---------- 改起租日期 / 换品类 ----------

test('预约价的租赁改起租日期：按预约价目重算，仍记预约', async () => {
  const { instance, restore } = await formWithReserve()
  try {
    instance.onPkgSceneTap(tapScene('预约'))
    await new Promise(resolve => setImmediate(resolve))
    const next = daysFromToday(3)
    instance.setData({ 'displayRentals[0].start_date': next + 'T00:00:00' })
    await instance._repriceForDate(0, next)
    assert.equal(preset0(instance).scene, '预约')
    assert.equal(preset0(instance).price, dayPrice(next, 190, 290))
    assert.equal(preset0(instance).rent_date, next)
    assert.equal(instance.data.displayRentals[0]._priceScene, '预约')
  } finally { restore() }
})

test('门市价的租赁改起租日期：仍按门市价，不会被标成预约', async () => {
  const { instance, restore } = await formWithReserve()
  try {
    const next = daysFromToday(3)
    instance.setData({ 'displayRentals[0].start_date': next + 'T00:00:00' })
    await instance._repriceForDate(0, next)
    assert.equal(preset0(instance).scene, '门市')
    assert.equal(preset0(instance).price, dayPrice(next, 260, 360))
  } finally { restore() }
})

test('预约价的租赁改到没有预约价的那天：退回门市价并提示', async () => {
  const date = daysFromToday(2)
  const isWeekend = d => dayPrice(d, 0, 1) === 1
  // 新日期挑一个和起租日「平日/周末」不同类的（预约价目只有起租日这一类的价，新日期取不到）
  let next = null
  for (let i = 3; i < 12 && !next; i++) if (isWeekend(daysFromToday(i)) !== isWeekend(date)) next = daysFromToday(i)
  const reserveList = RESERVE_LIST.filter(p => p.day_type === (isWeekend(date) ? '周末' : '平日'))
  const f = loadForm([], { reserveList })
  try {
    f.instance._refreshRentals([rental({
      pricePresets: [{ id: 9, rent_date: date, day_type: isWeekend(date) ? '周末' : '平日', rent_type: '日场', scene: '预约', price: 150, manual: false }],
    })])
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(f.instance.data.displayRentals[0]._priceScene, '预约')
    f.instance.setData({ 'displayRentals[0].start_date': next + 'T00:00:00' })
    await f.instance._repriceForDate(0, next)
    assert.deepEqual(f.calls.toasts, ['这一天没有预约价，已改回门市价'])
    assert.equal(preset0(f.instance).scene, '门市')
    assert.equal(preset0(f.instance).price, dayPrice(next, 260, 360))
    assert.equal(f.instance.data.displayRentals[0]._priceScene, '门市')
  } finally { f.restore() }
})

test('换品类：原来按预约价的预设作废（旧品类的价），不留着预约标记', async () => {
  const date = daysFromToday(2)
  const main = { id: 7, is_associate: false, noCode: true, category_id: null, pick_type: '延时租赁', atOnce: true, valid: 1 }
  const r = {
    id: 5, pick_type: '延时租赁', start_date: date + 'T00:00:00', expectDays: 1,
    guaranty: 3000, realGuaranty: 3000, guaranty_discount: 0, rentItems: [main],
    pricePresets: [{ id: 9, rent_date: date, day_type: '平日', rent_type: '日场', scene: '预约', price: 190, manual: false }],
  }
  const { instance, syncs, restore } = loadForm([r])
  try {
    await instance._applyCategoryChange(0, 0, { id: 4, name: '【FIS】双板', deposit: 500 })
  } finally { restore() }
  const saved = syncs[syncs.length - 1].rentals[0]
  assert.ok(!(saved.pricePresets || []).some(p => p.scene === '预约'), '预约价预设已清掉')
})

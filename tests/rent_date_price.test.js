// 租赁开单：起租日期变了，租金/日要按新日期重新算。
// 2026-11-01：开单时价格预设按「今天」生成（今天 16 点后是夜场价），选「延时租赁」或改起租日期后如果不重算，
// 屏幕上和后端收的都是今天的价。规则在 utils/rent_date_price.js；店员手改过的租金（含招待归零）不能被日期一改就冲掉。
const test = require('node:test')
const assert = require('node:assert/strict')
const rentDatePrice = require('../utils/rent_date_price.js')

function formatDate(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function daysFromToday(n) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return formatDate(d)
}

const PRICE_LIST = [
  { day_type: '平日', rent_type: '日场', scene: '门市', price: 260 },
  { day_type: '周末', rent_type: '日场', scene: '门市', price: 360 },
  { day_type: '平日', rent_type: '夜场', scene: '门市', price: 150 },
  { day_type: '周末', rent_type: '夜场', scene: '门市', price: 200 },
]
function expectedDayPrice(dateStr) {
  return rentDatePrice.dayTypeForDate(dateStr) === '周末' ? 360 : 260
}

// ---------- 纯规则 ----------

test('场次：起租日是今天时按钟点分，其它日期一律日场', () => {
  const evening = new Date(2026, 10, 1, 22, 16)
  assert.equal(rentDatePrice.rentTypeForDate('2026-11-01', evening), '夜场')
  assert.equal(rentDatePrice.rentTypeForDate('2026-11-01', new Date(2026, 10, 1, 14, 0)), '下午场')
  assert.equal(rentDatePrice.rentTypeForDate('2026-11-01', new Date(2026, 10, 1, 9, 0)), '日场')
  assert.equal(rentDatePrice.rentTypeForDate('2026-11-02', evening), '日场')
})

test('平日/周末按起租日的星期几', () => {
  assert.equal(rentDatePrice.dayTypeForDate('2026-11-01'), '周末')   // 周日
  assert.equal(rentDatePrice.dayTypeForDate('2026-11-02'), '平日')   // 周一
  assert.equal(rentDatePrice.dayTypeForDate('2026-11-07'), '周末')   // 周六
})

test('今晚 22:16 开的单改成明天：夜场价换成明天的日场价，预设跟着挪到明天', () => {
  const evening = new Date(2026, 10, 1, 22, 16)
  const today = { id: 5, rental_id: 1, rent_date: '2026-11-01', day_type: '周末', rent_type: '夜场', scene: '门市', price: 200, discount: 0, manual: false }
  const next = rentDatePrice.repricePreset(today, PRICE_LIST, '2026-11-02', evening)
  assert.equal(next.price, 260)
  assert.equal(next.rent_date, '2026-11-02')
  assert.equal(next.day_type, '平日')
  assert.equal(next.rent_type, '日场')
  assert.equal(next.id, 5, '同一条预设，保存时整体替换')
  assert.equal(today.price, 200, '不改入参')
  // 再改回今天：回到按现在钟点算的夜场价
  const back = rentDatePrice.repricePreset(next, PRICE_LIST, '2026-11-01', evening)
  assert.equal(back.price, 200)
  assert.equal(back.rent_type, '夜场')
})

test('店员手改过的租金不重算，只挪日期（招待归零同理）', () => {
  const manual = { id: 5, rent_date: '2026-11-01', day_type: '周末', rent_type: '夜场', scene: '门市', price: 0, discount: 0, manual: true }
  const next = rentDatePrice.repricePreset(manual, PRICE_LIST, '2026-11-02', new Date(2026, 10, 1, 22, 16))
  assert.equal(next.price, 0)
  assert.equal(next.manual, true)
  assert.equal(next.rent_date, '2026-11-02')
  assert.equal(next.day_type, '平日')
})

test('价目表里没有这个日期的价：保留原价，只挪日期；折扣不动', () => {
  const preset = { id: 5, rent_date: '2026-11-01', day_type: '周末', rent_type: '日场', scene: '门市', price: 300, discount: 20, manual: false }
  const next = rentDatePrice.repricePreset(preset, [], '2026-11-02', new Date())
  assert.equal(next.price, 300)
  assert.equal(next.discount, 20)
  assert.equal(next.rent_date, '2026-11-02')
  assert.equal(rentDatePrice.repricePreset(null, [], '2026-11-02', new Date()), null, '没预设也没价目表：什么都不生成')
})

// ---------- 组件：改模式 / 改日期后重算 ----------

function setByPath(obj, pathStr, value) {
  const keys = pathStr.replace(/\[(\d+)\]/g, '.$1').split('.')
  let cur = obj
  keys.slice(0, -1).forEach(k => { cur = cur[k] })
  cur[keys[keys.length - 1]] = value
}

function loadForm(displayRentals, fakeData) {
  const dataPath = require.resolve('../utils/data.js')
  const file = require.resolve('../components/reception/rent_recept_form/rent_recept_form.js')
  const originalData = require.cache[dataPath]
  require.cache[dataPath] = { id: dataPath, filename: dataPath, loaded: true, exports: fakeData || {} }
  delete require.cache[file]
  let definition = null
  global.Component = value => { definition = value }
  global.wx = { showToast() {} }
  require(file)
  delete global.Component
  delete require.cache[file]
  const syncs = []
  const instance = {
    data: { displayRentals, expandedItem: {} },
    properties: { shop: '万龙服务中心' },
    setData(values) { Object.keys(values).forEach(k => setByPath(this.data, k, values[k])) },
    triggerEvent() {},
  }
  Object.keys(definition.methods).forEach(name => { instance[name] = definition.methods[name].bind(instance) })
  instance._updateRentalChip = () => {}
  instance._refreshSummary = () => {}
  instance._emitSync = (needUpdate) => { syncs.push({ needUpdate, presets: JSON.parse(JSON.stringify(instance.data.displayRentals.map(r => r.pricePresets))) }) }
  return { instance, syncs, restore() { delete require.cache[file]; if (originalData) require.cache[dataPath] = originalData; else delete require.cache[dataPath] } }
}

function rental(extra) {
  return Object.assign({
    id: 7, name: '普通单板套餐', package_id: 41, category_id: 3, pick_type: '立即租赁', atOnce: true,
    start_date: daysFromToday(0) + 'T22:16:00',
    pricePresets: [{ id: 9, rental_id: 7, rent_date: daysFromToday(0), day_type: '平日', rent_type: '夜场', scene: '门市', price: 150, discount: 0, manual: false }],
    priceList: PRICE_LIST, rentItems: [{ id: 1, name: '雪板', code: 'B', noCode: false, category_id: 3, pick_type: null, atOnce: false }],
  }, extra || {})
}
const tick = () => new Promise(resolve => setImmediate(resolve))

test('选「延时租赁」：起租日变成明天，租金/日换成明天的价', async () => {
  const { instance, syncs, restore } = loadForm([rental()])
  try {
    instance.onPkgModeTap({ currentTarget: { dataset: { ridx: 0, mode: 'delay' } } })
    await tick()
    const r = instance.data.displayRentals[0]
    const tomorrow = daysFromToday(1)
    assert.equal(r.pricePresets[0].rent_date, tomorrow)
    assert.equal(r.pricePresets[0].price, expectedDayPrice(tomorrow))
    assert.equal(r._dailyRate, expectedDayPrice(tomorrow))
    assert.equal(r._dailyRateInput, expectedDayPrice(tomorrow).toFixed(2))
    assert.equal(r.pricePresets[0].id, 9)
    assert.ok(syncs.length >= 2 && syncs[syncs.length - 1].presets[0][0].price === expectedDayPrice(tomorrow), '重算后要同步给父页')
  } finally { restore() }
})

test('改起租日期（日历 / 今明快捷）后同样重算，改回今天回到今天的价', async () => {
  const { instance, restore } = loadForm([rental()])
  try {
    instance._setPkgDate(0, daysFromToday(3))
    await tick()
    assert.equal(instance.data.displayRentals[0].pricePresets[0].price, expectedDayPrice(daysFromToday(3)))
    instance.onPkgDateQuick({ currentTarget: { dataset: { ridx: 0, day: 0 } } })
    await tick()
    const r = instance.data.displayRentals[0]
    assert.equal(r.pricePresets[0].rent_date, daysFromToday(0))
    assert.equal(r.pricePresets[0].rent_type, new Date().getHours() >= 16 ? '夜场' : (new Date().getHours() >= 13 ? '下午场' : '日场'))
  } finally { restore() }
})

test('店员手改过租金：改日期后价格不变（招待 0 元也不变）', async () => {
  const manual = rental({ pricePresets: [{ id: 9, rental_id: 7, rent_date: daysFromToday(0), day_type: '平日', rent_type: '夜场', scene: '门市', price: 0, discount: 0, manual: true }] })
  const { instance, restore } = loadForm([manual])
  try {
    instance.onPkgModeTap({ currentTarget: { dataset: { ridx: 0, mode: 'delay' } } })
    await tick()
    const r = instance.data.displayRentals[0]
    assert.equal(r.pricePresets[0].price, 0)
    assert.equal(r.pricePresets[0].rent_date, daysFromToday(1), '预设挪到明天，后端才找得到')
    assert.equal(r._dailyRate, 0)
  } finally { restore() }
})

test('保存往返后价目表被后端清空：按套餐现取一次，分类租赁按分类取', async () => {
  const calls = []
  const fakeData = {
    getShopByNamePromise: async name => { calls.push(['shop', name]); return { id: 1 } },
    getRentPriceListPromise: async (shopId, type, id, scene) => { calls.push([shopId, type, id, scene]); return PRICE_LIST },
  }
  const pkg = rental({ priceList: [] })
  const single = rental({ id: 8, package_id: null, category_id: 3, priceList: [], timeStamp: 2 })
  const { instance, restore } = loadForm([pkg, single], fakeData)
  try {
    instance.onPkgModeTap({ currentTarget: { dataset: { ridx: 0, mode: 'delay' } } })
    instance.onPkgModeTap({ currentTarget: { dataset: { ridx: 1, mode: 'delay' } } })
    await tick(); await tick()
    assert.deepEqual(calls.filter(c => c[0] !== 'shop').map(c => c.slice(1, 3)), [['套餐', 41], ['分类', 3]])
    assert.equal(instance.data.displayRentals[0].pricePresets[0].price, expectedDayPrice(daysFromToday(1)))
    assert.equal(instance.data.displayRentals[1].pricePresets[0].price, expectedDayPrice(daysFromToday(1)))
    assert.ok(instance.data.displayRentals[0].priceList.length > 0, '取回的价目表留在套餐上，下次改日期不用再取')
  } finally { restore() }
})

test('价目表取不到：只挪日期、保留原价，不报错', async () => {
  const fakeData = {
    getShopByNamePromise: async () => { throw new Error('网络不通') },
    getRentPriceListPromise: async () => [],
  }
  const { instance, restore } = loadForm([rental({ priceList: [] })], fakeData)
  const warn = console.warn; console.warn = () => {}
  try {
    instance.onPkgModeTap({ currentTarget: { dataset: { ridx: 0, mode: 'delay' } } })
    await tick(); await tick()
    const preset = instance.data.displayRentals[0].pricePresets[0]
    assert.equal(preset.price, 150)
    assert.equal(preset.rent_date, daysFromToday(1))
  } finally { console.warn = warn; restore() }
})

test('连改两次日期：先发出的取价结果晚到，不能盖掉后面的', async () => {
  const resolvers = []
  const fakeData = {
    getShopByNamePromise: async () => ({ id: 1 }),
    getRentPriceListPromise: () => new Promise(resolve => { resolvers.push(resolve) }),
  }
  const { instance, restore } = loadForm([rental({ priceList: [] })], fakeData)
  try {
    instance._setPkgDate(0, daysFromToday(1))
    instance._setPkgDate(0, daysFromToday(2))
    await tick(); await tick()
    assert.equal(resolvers.length, 2)
    resolvers[1](PRICE_LIST)           // 第二次的先回来
    await tick(); await tick()
    resolvers[0]([{ day_type: '平日', rent_type: '日场', scene: '门市', price: 999 }, { day_type: '周末', rent_type: '日场', scene: '门市', price: 999 }])   // 第一次的晚到
    await tick(); await tick()
    const preset = instance.data.displayRentals[0].pricePresets[0]
    assert.equal(preset.rent_date, daysFromToday(2))
    assert.equal(preset.price, expectedDayPrice(daysFromToday(2)))
  } finally { restore() }
})

// 租赁开单：改起租日期，起租时间自动变 00:00、租赁模式自动变延时租赁。
// 2026-11-01 用户要求：晚于今天的起租日期 = 延时（装备当晚发放，那天才开始计费），不用再先点模式再改日期。
// 改回今天时，原来是延时租赁的回到立即租赁（起租钟点是现在）；本来就是立即租赁/先租后取的不动。
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
function setByPath(obj, pathStr, value) {
  const keys = pathStr.replace(/\[(\d+)\]/g, '.$1').split('.')
  let cur = obj
  keys.slice(0, -1).forEach(k => { cur = cur[k] })
  cur[keys[keys.length - 1]] = value
}

// ---------- 纯规则 ----------

test('晚于今天 → 延时；改回今天且原来是延时 → 立即；其它不动', () => {
  const today = '2026-11-01'
  assert.equal(rentDatePrice.modeForDateChange('2026-11-02', '立即租赁', today), 'delay')
  assert.equal(rentDatePrice.modeForDateChange('2026-11-05', '先租后取', today), 'delay')
  assert.equal(rentDatePrice.modeForDateChange('2026-11-05', null, today), 'delay')
  assert.equal(rentDatePrice.modeForDateChange('2026-11-05', '延时租赁', today), 'delay')
  assert.equal(rentDatePrice.modeForDateChange('2026-11-01', '延时租赁', today), 'now')
  assert.equal(rentDatePrice.modeForDateChange('2026-11-01', '立即租赁', today), null)
  assert.equal(rentDatePrice.modeForDateChange('2026-11-01', '先租后取', today), null)
  assert.equal(rentDatePrice.modeForDateChange('2026-11-01', null, today), null)
  assert.equal(rentDatePrice.modeForDateChange('', '立即租赁', today), null)
})

// ---------- 组件 ----------

function loadForm(displayRentals) {
  const file = require.resolve('../components/reception/rent_recept_form/rent_recept_form.js')
  delete require.cache[file]
  let definition = null
  global.Component = value => { definition = value }
  global.wx = { showToast() {} }
  require(file)
  delete global.Component
  delete require.cache[file]
  const instance = {
    data: { displayRentals, expandedItem: {} },
    properties: { shop: '万龙服务中心' },
    setData(values) { Object.keys(values).forEach(k => setByPath(this.data, k, values[k])) },
    triggerEvent() {},
  }
  Object.keys(definition.methods).forEach(name => { instance[name] = definition.methods[name].bind(instance) })
  instance._updateRentalChip = () => {}
  instance._refreshSummary = () => {}
  instance._emitSync = () => {}
  instance._repriceForDate = () => {}      // 取价另有测试（rent_date_price.test.js）
  return { instance, restore() { delete require.cache[file] } }
}

function nowTime() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}
function rental(extra) {
  return Object.assign({
    id: 7, name: '普通单板套餐', package_id: 41, category_id: 3, pick_type: '立即租赁', atOnce: true,
    start_date: daysFromToday(0) + 'T22:16:00', _startTime: '22:16',
    pricePresets: [], priceList: [],
    rentItems: [
      { id: 1, name: '雪板', code: 'B', noCode: false, category_id: 3, pick_type: '立即租赁', _modeFromPkg: true, atOnce: true },
      { id: 2, name: '雪杖', noCode: true, is_associate: true, category_id: 4, pick_type: '立即租赁', _modeFromPkg: true, atOnce: true },
    ],
  }, extra || {})
}

test('立即租赁改成明天：模式变延时租赁，起租时间 00:00，装备跟着变且当晚发放', () => {
  const { instance, restore } = loadForm([rental()])
  try {
    instance._setPkgDate(0, daysFromToday(1))
    const r = instance.data.displayRentals[0]
    assert.equal(r.pick_type, '延时租赁')
    assert.equal(r._modeKey, 'delay')
    assert.equal(r.start_date, daysFromToday(1) + 'T00:00:00')
    assert.equal(r._startDate, daysFromToday(1))
    assert.equal(r._startTime, '00:00')
    assert.equal(r._dateIsTomorrow, true)
    assert.equal(r._dateIsToday, false)
    assert.equal(r.atOnce, true)
    for (const it of r.rentItems) {
      assert.equal(it.pick_type, '延时租赁', it.name)
      assert.equal(it.atOnce, true, it.name + ' 当晚发放')
    }
  } finally { restore() }
})

test('日历选更晚的日期、点「明」快捷，都是同样的效果', () => {
  const { instance, restore } = loadForm([rental(), rental({ id: 8, timeStamp: 2 })])
  try {
    instance.onPkgDateQuick({ currentTarget: { dataset: { ridx: 0, day: 1 } } })
    const d3 = new Date(); d3.setDate(d3.getDate() + 3)
    assert.equal(instance.data.displayRentals[1].pick_type, '立即租赁', '只改了第一个套餐')
    instance.setData({ calendarShow: true, calendarRidx: 1 })    // 点开第二个套餐的日历
    instance.onCalendarConfirm({ detail: d3.getTime() })
    const first = instance.data.displayRentals[0]
    const second = instance.data.displayRentals[1]
    assert.equal(first.pick_type, '延时租赁'); assert.equal(first.start_date, daysFromToday(1) + 'T00:00:00')
    assert.equal(second.pick_type, '延时租赁'); assert.equal(second.start_date, daysFromToday(3) + 'T00:00:00')
  } finally { restore() }
})

test('延时租赁改回今天：回到立即租赁，起租时间是现在', () => {
  const { instance, restore } = loadForm([rental()])
  try {
    instance._setPkgDate(0, daysFromToday(2))
    assert.equal(instance.data.displayRentals[0].pick_type, '延时租赁')
    instance.onPkgDateQuick({ currentTarget: { dataset: { ridx: 0, day: 0 } } })
    const r = instance.data.displayRentals[0]
    assert.equal(r.pick_type, '立即租赁')
    assert.equal(r._dateIsToday, true)
    assert.equal(r._startDate, daysFromToday(0))
    assert.match(r._startTime, /^\d{2}:\d{2}$/)
    assert.notEqual(r._startTime, '00:00')
    assert.ok(r.start_date.startsWith(daysFromToday(0) + 'T'))
    for (const it of r.rentItems) assert.equal(it.pick_type, '立即租赁', it.name)
  } finally { restore() }
})

test('本来就是立即租赁/先租后取，改到今天：模式和起租时间都不动', () => {
  for (const pickType of ['立即租赁', '先租后取']) {
    const { instance, restore } = loadForm([rental({ pick_type: pickType, atOnce: pickType === '立即租赁' })])
    try {
      instance._setPkgDate(0, daysFromToday(0))
      const r = instance.data.displayRentals[0]
      assert.equal(r.pick_type, pickType)
      assert.equal(r.start_date, daysFromToday(0) + 'T22:16:00')
    } finally { restore() }
  }
})

test('先租后取改成以后的日期：按规则变延时租赁，装备当晚发放', () => {
  const { instance, restore } = loadForm([rental({
    pick_type: '先租后取', atOnce: false,
    rentItems: [{ id: 1, name: '雪板', code: 'B', category_id: 3, pick_type: '先租后取', _modeFromPkg: true, atOnce: false }],
  })])
  try {
    instance._setPkgDate(0, daysFromToday(1))
    const r = instance.data.displayRentals[0]
    assert.equal(r.pick_type, '延时租赁')
    assert.equal(r.rentItems[0].atOnce, true)
    assert.equal(r.atOnce, true)
  } finally { restore() }
})

test('还没选过模式的套餐，改成以后的日期也直接变延时租赁', () => {
  const { instance, restore } = loadForm([rental({ pick_type: null, atOnce: false,
    rentItems: [{ id: 1, name: '雪板', code: 'B', category_id: 3, pick_type: null, atOnce: false }] })])
  try {
    instance._setPkgDate(0, daysFromToday(4))
    const r = instance.data.displayRentals[0]
    assert.equal(r.pick_type, '延时租赁')
    assert.equal(r.rentItems[0].pick_type, '延时租赁')
    assert.equal(r.rentItems[0].atOnce, true)
  } finally { restore() }
})

test('套餐里自己单独选过模式的装备，改日期时保持自己的模式', () => {
  const own = { id: 3, name: '雪鞋', code: 'S', category_id: 5, pick_type: '先租后取', _modeFromPkg: false, atOnce: false }
  const { instance, restore } = loadForm([rental({ rentItems: [rental().rentItems[0], own] })])
  try {
    instance._setPkgDate(0, daysFromToday(1))
    const items = instance.data.displayRentals[0].rentItems
    assert.equal(items[0].pick_type, '延时租赁')
    assert.equal(items[1].pick_type, '先租后取')
    assert.equal(items[1].atOnce, false)
  } finally { restore() }
})

test('只改起租时间（时间选择器）不动模式和日期', () => {
  const { instance, restore } = loadForm([rental({ pick_type: '延时租赁', start_date: daysFromToday(1) + 'T00:00:00', _startDate: daysFromToday(1) })])
  try {
    instance.onPkgTimeChange({ currentTarget: { dataset: { ridx: 0 } }, detail: { value: '09:30' } })
    const r = instance.data.displayRentals[0]
    assert.equal(r.pick_type, '延时租赁')
    assert.equal(r.start_date, daysFromToday(1) + 'T09:30:00')
  } finally { restore() }
})

// ---------- 装备跟着套餐变（开单时装备带默认模式、没有跟随标记） ----------

function plainItem(extra) {
  // 开单时创建的装备：pick_type 是默认模式，没有 _modeFromPkg / _modeKey 这些前端标记
  return Object.assign({ id: 1, name: '雪板', code: 'B', noCode: false, category_id: 3, pick_type: '立即租赁', atOnce: true }, extra || {})
}

test('开单时带默认模式的装备（没有跟随标记）：改日期后跟着套餐变成延时租赁', () => {
  const { instance, restore } = loadForm([rental({ rentItems: [plainItem(), plainItem({ id: 2, name: '雪杖', is_associate: true, noCode: true })] })])
  try {
    instance._setPkgDate(0, daysFromToday(1))
    const r = instance.data.displayRentals[0]
    assert.equal(r.pick_type, '延时租赁')
    for (const it of r.rentItems) {
      assert.equal(it.pick_type, '延时租赁', it.name + ' 跟着套餐')
      assert.equal(it._modeKey, 'delay', it.name)
      assert.equal(it.atOnce, true, it.name)
    }
  } finally { restore() }
})

test('保存往返把前端标记清掉之后，再改日期装备照样跟着套餐走（延时 → 改回今天 → 立即）', () => {
  const { instance, restore } = loadForm([rental({ rentItems: [plainItem()] })])
  try {
    instance._setPkgDate(0, daysFromToday(2))
    // 模拟保存往返：父页拿到的是去掉 _ 字段的数据，再原样传回
    for (const it of instance.data.displayRentals[0].rentItems) { delete it._modeFromPkg; delete it._modeKey }
    instance._setPkgDate(0, daysFromToday(0))
    const r = instance.data.displayRentals[0]
    assert.equal(r.pick_type, '立即租赁')
    assert.equal(r.rentItems[0].pick_type, '立即租赁')
    assert.equal(r.rentItems[0]._modeKey, 'now')
  } finally { restore() }
})

test('装备单独选的模式和套餐不一致（标记丢了也一样）：改日期时保持不动', () => {
  const own = plainItem({ id: 3, name: '雪鞋', pick_type: '先租后取', atOnce: false })
  const { instance, restore } = loadForm([rental({ rentItems: [plainItem(), own] })])
  try {
    instance._setPkgDate(0, daysFromToday(1))
    const items = instance.data.displayRentals[0].rentItems
    assert.equal(items[0].pick_type, '延时租赁')
    assert.equal(items[1].pick_type, '先租后取')
    assert.equal(items[1].atOnce, false)
  } finally { restore() }
})

test('这次在装备上手动选过、恰好和套餐一样：套餐变了也不动它', () => {
  const chosen = plainItem({ id: 3, name: '雪鞋', pick_type: '立即租赁', _modeFromPkg: false })
  const { instance, restore } = loadForm([rental({ rentItems: [plainItem(), chosen] })])
  try {
    instance._setPkgDate(0, daysFromToday(1))
    const items = instance.data.displayRentals[0].rentItems
    assert.equal(items[0].pick_type, '延时租赁')
    assert.equal(items[1].pick_type, '立即租赁')
  } finally { restore() }
})

test('点模式按钮也一样：默认模式的装备跟着套餐变（先租后取 → 装备不发放）', () => {
  const { instance, restore } = loadForm([rental({ rentItems: [plainItem()] })])
  try {
    instance.onPkgModeTap({ currentTarget: { dataset: { ridx: 0, mode: 'later' } } })
    const it = instance.data.displayRentals[0].rentItems[0]
    assert.equal(it.pick_type, '先租后取')
    assert.equal(it.atOnce, false)
  } finally { restore() }
})

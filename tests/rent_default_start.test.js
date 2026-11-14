// 租赁开单：新加的租赁（套餐、搜索单品、无码物品）默认怎么起租。
// 2026-11-14 用户要求：崇礼旗舰店每天晚上 6 点以后，默认延时租赁，起租日期选第二天。
// 过了 0 点（0:00～17:59）崇礼旗舰店恢复成立即租赁，商品和租赁物一样；万龙系店铺任何时候都是立即租赁；其它店不预选。
// 规则在 utils/rent_date_price.js 的 defaultRentStart。
const test = require('node:test')
const assert = require('node:assert/strict')
const rentDatePrice = require('../utils/rent_date_price.js')
const { loadPage } = require('./reception_harness.js')

const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min)

// ---------- 规则 ----------

test('崇礼旗舰店：18:00 起默认延时租赁，起租日期是第二天 00:00，装备当晚发放', () => {
  for (const [h, min] of [[18, 0], [18, 1], [21, 30], [23, 59]]) {
    const s = rentDatePrice.defaultRentStart('崇礼旗舰店', at(2026, 11, 12, h, min))
    assert.equal(s.pickType, '延时租赁', `${h}:${min}`)
    assert.equal(s.date, '2026-11-13')
    assert.equal(s.time, '00:00')
    assert.equal(s.startDateTime, '2026-11-13T00:00:00')
    assert.equal(s.atOnce, true)
  }
})

test('崇礼旗舰店：过了 0 点（0:00～17:59）恢复成立即租赁，从现在起', () => {
  for (const [h, min] of [[0, 0], [0, 30], [9, 0], [16, 5], [17, 59]]) {
    const s = rentDatePrice.defaultRentStart('崇礼旗舰店', at(2026, 11, 12, h, min))
    assert.equal(s.pickType, '立即租赁', `${h}:${min}`)
    assert.equal(s.date, '2026-11-12')
    assert.equal(s.time, `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
    assert.equal(s.startDateTime, `2026-11-12T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`)
    assert.equal(s.atOnce, true)
  }
})

test('崇礼旗舰店：23:59 还是延时租赁（第二天起租），跨过 0:00 马上变回立即租赁（当天起租）', () => {
  const before = rentDatePrice.defaultRentStart('崇礼旗舰店', at(2026, 11, 12, 23, 59))
  assert.equal(before.pickType, '延时租赁')
  assert.equal(before.date, '2026-11-13')
  const after = rentDatePrice.defaultRentStart('崇礼旗舰店', at(2026, 11, 13, 0, 0))
  assert.equal(after.pickType, '立即租赁')
  assert.equal(after.date, '2026-11-13')
  assert.equal(after.time, '00:00')
})

test('跨月、跨年：12-31 晚上开单，起租日期是次年 1-1', () => {
  const s = rentDatePrice.defaultRentStart('崇礼旗舰店', at(2026, 12, 31, 20, 0))
  assert.equal(s.date, '2027-01-01')
  assert.equal(s.startDateTime, '2027-01-01T00:00:00')
  assert.equal(rentDatePrice.defaultRentStart('崇礼旗舰店', at(2026, 11, 30, 19, 0)).date, '2026-12-01')
})

test('周末标记按起租日期算：周五晚开单第二天是周六，周日晚开单第二天是周一；过了 0 点按当天算', () => {
  assert.equal(rentDatePrice.defaultRentStart('崇礼旗舰店', at(2026, 11, 13, 19)).startDateIsWeekend, true)   // 周五 → 周六
  assert.equal(rentDatePrice.defaultRentStart('崇礼旗舰店', at(2026, 11, 15, 19)).startDateIsWeekend, false)  // 周日 → 周一
  assert.equal(rentDatePrice.defaultRentStart('崇礼旗舰店', at(2026, 11, 14, 10)).startDateIsWeekend, true)   // 周六白天，起租当天
  assert.equal(rentDatePrice.defaultRentStart('崇礼旗舰店', at(2026, 11, 14, 0, 10)).startDateIsWeekend, true) // 周五晚的延时租赁过了 0 点：周六当天
})

test('万龙系店铺：任何时候都是立即租赁、从现在起（晚上也不变）；其它店不预选', () => {
  for (const shop of ['万龙服务中心', '万龙体验中心']) {
    for (const h of [9, 19, 23]) {
      const s = rentDatePrice.defaultRentStart(shop, at(2026, 11, 12, h, 15))
      assert.equal(s.pickType, '立即租赁', `${shop} ${h}`)
      assert.equal(s.date, '2026-11-12')
      assert.equal(s.time, `${String(h).padStart(2, '0')}:15`)
      assert.equal(s.atOnce, true)
    }
  }
  for (const shop of ['南山', '', null, undefined, '崇礼旗舰店分店']) {
    const s = rentDatePrice.defaultRentStart(shop, at(2026, 11, 12, 20, 0))
    assert.equal(s.pickType, null, String(shop))
    assert.equal(s.date, '2026-11-12')
    assert.equal(s.atOnce, false)
  }
  assert.equal(rentDatePrice.defaultRentStart(' 崇礼旗舰店 ', at(2026, 11, 12, 20)).pickType, '延时租赁', '店名两端空格不影响')
})

// ---------- 三个开单入口都按这条规则 ----------

const PRICE_LIST = [
  { day_type: '平日', rent_type: '日场', scene: '门市', price: 260 },
  { day_type: '周末', rent_type: '日场', scene: '门市', price: 360 },
  { day_type: '平日', rent_type: '夜场', scene: '门市', price: 150 },
  { day_type: '周末', rent_type: '夜场', scene: '门市', price: 200 },
]
const CATEGORY = { id: 3, name: '【中级】全能板+青少全能', deposit: 3000 }

function setupPage(file, t, shop, now, extraData = {}) {
  t.mock.timers.reset()   // 一个用例里要换时间再开一次页面时，先放掉上一次的假时钟
  t.mock.timers.enable({ apis: ['Date'], now: now.getTime() })
  global.getApp = () => ({ globalData: { sessionKey: 'sk', requestPrefix: 'https://t/api/' }, loginPromiseNew: Promise.resolve() })
  global.wx = { showToast() {}, showLoading() {}, hideLoading() {}, navigateBack() {} }
  t.after(() => { delete global.getApp; delete global.wx })
  const fakeData = Object.assign({
    getShopByNamePromise: async () => ({ id: 10 }),
    getRentCategoryPromise: async () => ({ associateCategories: [{ associate_id: 27, category: { id: 27, name: '【其他】雪杖' } }] }),
    getRentPriceListPromise: async () => PRICE_LIST,
    getPackagePromise: async id => ({ id, name: '中级双板套餐', deposit: 3000, rentPackageItemCategories: [{ categories: [{ id: 3, name: '全能板', code: '0103' }] }] }),
  }, extraData)
  const page = loadPage(file, fakeData)
  // recept_new.onAddSingleProduct 在函数里才 require('utils/data.js')，loadPage 只在加载页面文件时替换，这里要一直替换到用例结束
  const dataPath = require.resolve('../utils/data.js')
  const originalData = require.cache[dataPath]
  require.cache[dataPath] = { id: dataPath, filename: dataPath, loaded: true, exports: fakeData }
  t.after(() => { if (originalData) require.cache[dataPath] = originalData; else delete require.cache[dataPath] })
  page.setData({ shop })
  return page
}

test('搜索单品：崇礼旗舰店晚上 7 点开单 → 延时租赁、明天 00:00 起租、租金按明天（周六）的日场价', async t => {
  const page = setupPage('pages/admin/reception/recept_new.js', t, '崇礼旗舰店', at(2026, 11, 13, 19, 0))   // 周五晚
  const added = []
  page._appendRentals = rentals => added.push(...rentals)
  await page.onAddSingleProduct({ detail: { product: { id: 9, name: '全能 170', barcode: 'B-170', category: CATEGORY } } })

  const r = added[0]
  assert.equal(r.pick_type, '延时租赁')
  assert.equal(r.atOnce, true)
  assert.equal(r.start_date, '2026-11-14T00:00:00')
  assert.equal(r.startDateIsWeekend, true)
  assert.equal(r.pricePresets[0].rent_date, '2026-11-14')
  assert.equal(r.pricePresets[0].rent_type, '日场')
  assert.equal(r.pricePresets[0].price, 360)
  for (const item of r.rentItems) {
    assert.equal(item.pick_type, '延时租赁')
    assert.equal(item.atOnce, true, '延时租赁的装备（含雪杖）当晚发放')
  }
})

test('搜索单品：崇礼旗舰店过了 0 点（含下午）开单是立即租赁，商品和租赁物都是；万龙晚上照旧立即租赁', async t => {
  for (const [h, min] of [[0, 20], [15, 0]]) {
    const chongli = setupPage('pages/admin/reception/recept_new.js', t, '崇礼旗舰店', at(2026, 11, 12, h, min))
    const a = []
    chongli._appendRentals = rentals => a.push(...rentals)
    await chongli.onAddSingleProduct({ detail: { product: { id: 9, barcode: 'B', category: CATEGORY } } })
    const hh = String(h).padStart(2, '0'), mm = String(min).padStart(2, '0')
    assert.equal(a[0].pick_type, '立即租赁', `${h}:${min}`)
    assert.equal(a[0].start_date, `2026-11-12T${hh}:${mm}:00`)
    assert.equal(a[0].atOnce, true)
    assert.equal(a[0].pricePresets[0].rent_date, '2026-11-12', '租金按当天的价')
    for (const item of a[0].rentItems) {
      assert.equal(item.pick_type, '立即租赁', `${h}:${min} 租赁物`)
      assert.equal(item.atOnce, true)
    }
  }

  const wanlongNight = setupPage('pages/admin/reception/recept_new.js', t, '万龙服务中心', at(2026, 11, 12, 20, 0))
  const b = []
  wanlongNight._appendRentals = rentals => b.push(...rentals)
  await wanlongNight.onAddSingleProduct({ detail: { product: { id: 9, barcode: 'B', category: CATEGORY } } })
  assert.equal(b[0].pick_type, '立即租赁')
  assert.equal(b[0].start_date, '2026-11-12T20:00:00')
  assert.equal(b[0].atOnce, true)
})

test('无码物品：崇礼旗舰店晚上开单同样默认延时租赁、第二天起租；过了 0 点恢复立即租赁', t => {
  const page = setupPage('pages/admin/reception/recept_new.js', t, '崇礼旗舰店', at(2026, 11, 12, 22, 40))
  const added = []
  page._appendRentals = rentals => added.push(...rentals)
  page._addBlankRental()

  const r = added[0]
  assert.equal(r.pick_type, '延时租赁')
  assert.equal(r.start_date, '2026-11-13T00:00:00')
  assert.equal(r.atOnce, true)
  assert.equal(r.rentItems[0].pick_type, '延时租赁')
  assert.equal(r.rentItems[0].atOnce, true)

  const afterMidnight = setupPage('pages/admin/reception/recept_new.js', t, '崇礼旗舰店', at(2026, 11, 13, 0, 30))
  const later = []
  afterMidnight._appendRentals = rentals => later.push(...rentals)
  afterMidnight._addBlankRental()
  assert.equal(later[0].pick_type, '立即租赁')
  assert.equal(later[0].start_date, '2026-11-13T00:30:00')
  assert.equal(later[0].atOnce, true)
  assert.equal(later[0].rentItems[0].pick_type, '立即租赁')
  assert.equal(later[0].rentItems[0].atOnce, true)
})

test('选套餐：崇礼旗舰店晚上开单，套餐和套餐里的装备都默认延时租赁、第二天起租', async t => {
  const page = setupPage('pages/admin/reception/recept_package.js', t, '崇礼旗舰店', at(2026, 11, 12, 18, 5))
  const emitted = []
  page._eventChannel = { emit(name, rentals) { emitted.push({ name, rentals }) } }
  page.setData({ packages: [{ id: 41, qty: 2 }], shopObj: { id: 10 } })
  page.onConfirm()
  await new Promise(resolve => setImmediate(resolve))

  assert.equal(emitted.length, 1)
  assert.equal(emitted[0].name, 'rentalsSelected')
  assert.equal(emitted[0].rentals.length, 2)
  for (const r of emitted[0].rentals) {
    assert.equal(r.pick_type, '延时租赁')
    assert.equal(r.atOnce, true)
    assert.equal(r.start_date, '2026-11-13T00:00:00')
    assert.equal(r.pricePresets[0].rent_date, '2026-11-13')
    assert.equal(r.pricePresets[0].price, 260, '周五是平日日场价')
    assert.equal(r.rentItems[0].pick_type, '延时租赁')
    assert.equal(r.rentItems[0].atOnce, true)
  }
})

test('选套餐：崇礼旗舰店过了 0 点，套餐和套餐里的装备恢复立即租赁、当天起租', async t => {
  const page = setupPage('pages/admin/reception/recept_package.js', t, '崇礼旗舰店', at(2026, 11, 13, 0, 20))
  const emitted = []
  page._eventChannel = { emit(name, rentals) { emitted.push({ name, rentals }) } }
  page.setData({ packages: [{ id: 41, qty: 1 }], shopObj: { id: 10 } })
  page.onConfirm()
  await new Promise(resolve => setImmediate(resolve))

  const r = emitted[0].rentals[0]
  assert.equal(r.pick_type, '立即租赁')
  assert.equal(r.atOnce, true)
  assert.equal(r.start_date, '2026-11-13T00:20:00')
  assert.equal(r.pricePresets[0].rent_date, '2026-11-13')
  assert.equal(r.rentItems[0].pick_type, '立即租赁')
  assert.equal(r.rentItems[0].atOnce, true)
})

// ---------- 万龙两家店：全天默认立即租赁，商品和租赁物都是（2026-11-14 用户要求） ----------
// 万龙体验中心、万龙服务中心不管几点开单（含晚上 6 点以后、深夜、凌晨），新加的租赁商品、套餐、
// 无码物品和它们的租赁物（含配套的雪杖）一律「立即租赁」、从现在起租、当场发放；不会像崇礼旗舰店那样晚上改延时租赁。

const WANLONG_SHOPS = ['万龙体验中心', '万龙服务中心']
const WANLONG_HOURS = [[0, 10], [9, 0], [17, 59], [18, 0], [19, 30], [23, 59]]
const hhmm = (h, min) => `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`

test('万龙两家店：搜索单品全天立即租赁、从现在起租，租赁物（含雪杖）也是立即租赁并当场发放', async t => {
  for (const shop of WANLONG_SHOPS) {
    for (const [h, min] of WANLONG_HOURS) {
      const page = setupPage('pages/admin/reception/recept_new.js', t, shop, at(2026, 11, 12, h, min))
      const added = []
      page._appendRentals = rentals => added.push(...rentals)
      await page.onAddSingleProduct({ detail: { product: { id: 9, barcode: 'B', category: CATEGORY } } })

      const label = `${shop} ${hhmm(h, min)}`
      const r = added[0]
      assert.equal(r.pick_type, '立即租赁', label)
      assert.equal(r.atOnce, true, label)
      assert.equal(r.start_date, `2026-11-12T${hhmm(h, min)}:00`, `${label} 当天从现在起租`)
      assert.equal(r.pricePresets[0].rent_date, '2026-11-12', `${label} 租金按当天的价`)
      assert.ok(r.rentItems.length >= 2, `${label} 主装备 + 雪杖`)
      for (const item of r.rentItems) {
        assert.equal(item.pick_type, '立即租赁', `${label} 租赁物`)
        assert.equal(item.atOnce, true, `${label} 租赁物当场发放`)
      }
    }
  }
})

test('万龙两家店：无码物品全天立即租赁，商品和租赁物都是', t => {
  for (const shop of WANLONG_SHOPS) {
    for (const [h, min] of WANLONG_HOURS) {
      const page = setupPage('pages/admin/reception/recept_new.js', t, shop, at(2026, 11, 12, h, min))
      const added = []
      page._appendRentals = rentals => added.push(...rentals)
      page._addBlankRental()

      const label = `${shop} ${hhmm(h, min)}`
      const r = added[0]
      assert.equal(r.pick_type, '立即租赁', label)
      assert.equal(r.atOnce, true, label)
      assert.equal(r.start_date, `2026-11-12T${hhmm(h, min)}:00`, label)
      assert.equal(r.rentItems[0].pick_type, '立即租赁', `${label} 租赁物`)
      assert.equal(r.rentItems[0].atOnce, true, `${label} 租赁物当场发放`)
    }
  }
})

test('万龙两家店：选套餐全天立即租赁，套餐和套餐里的装备都是', async t => {
  for (const shop of WANLONG_SHOPS) {
    for (const [h, min] of WANLONG_HOURS) {
      const page = setupPage('pages/admin/reception/recept_package.js', t, shop, at(2026, 11, 12, h, min))
      const emitted = []
      page._eventChannel = { emit(name, rentals) { emitted.push({ name, rentals }) } }
      page.setData({ packages: [{ id: 41, qty: 1 }], shopObj: { id: 10 } })
      page.onConfirm()
      await new Promise(resolve => setImmediate(resolve))

      const label = `${shop} ${hhmm(h, min)}`
      const r = emitted[0].rentals[0]
      assert.equal(r.pick_type, '立即租赁', label)
      assert.equal(r.atOnce, true, label)
      assert.equal(r.start_date, `2026-11-12T${hhmm(h, min)}:00`, label)
      assert.equal(r.pricePresets[0].rent_date, '2026-11-12', label)
      for (const item of r.rentItems) {
        assert.equal(item.pick_type, '立即租赁', `${label} 套餐内装备`)
        assert.equal(item.atOnce, true, `${label} 套餐内装备当场发放`)
      }
    }
  }
})

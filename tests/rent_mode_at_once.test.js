// 租赁模式和装备是否当场发放：立即租赁、延时租赁当场发放；先租后取稍后发放。
// 2026-11-01：旧版的延时租赁是装备当晚交给顾客、明天才开始计费；新版开单页原来选「延时租赁」会把 atOnce 设成 false，
// 装备开单时不发放；而「先租后取」原来反过来被当成当场发放。现在和旧版一致：
// 延时租赁当晚发放、明天起计费；先租后取等待装备全部发放后计费。
// 后端 EffectRental 按 rentItem.atOnce 决定是否当场发放（SnowmeetApi.Tests/RentalDelayIssueTests.cs 钉住后端那一半）。
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

function formatDate(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// 组件的 setData 用 'displayRentals[0].atOnce' 这种路径；这里按路径记下来，并让 data 跟着变。
function setByPath(obj, pathStr, value) {
  const keys = pathStr.replace(/\[(\d+)\]/g, '.$1').split('.')
  let cur = obj
  keys.slice(0, -1).forEach(k => { cur = cur[k] })
  cur[keys[keys.length - 1]] = value
}

function loadForm(displayRentals) {
  const file = require.resolve('../components/reception/rent_recept_form/rent_recept_form.js')
  delete require.cache[file]
  let definition = null
  global.Component = value => { definition = value }
  global.wx = { showToast() {} }
  require(file)
  delete global.Component
  delete require.cache[file]
  const patches = {}
  const instance = {
    data: { displayRentals, expandedItem: {} },
    setData(values) {
      Object.keys(values).forEach(k => { patches[k] = values[k]; setByPath(this.data, k, values[k]) })
    },
    triggerEvent() {},
  }
  Object.keys(definition.methods).forEach(name => { instance[name] = definition.methods[name].bind(instance) })
  // 同步父页、刷新套餐标签不在本测试范围：绑完真方法后再换成空实现
  instance._emitSync = () => {}
  instance._updateRentalChip = () => {}
  return { instance, patches }
}

function rentalWithItems(items, extra) {
  return Object.assign({
    id: 1, name: '普通单板套餐', pick_type: '立即租赁', atOnce: true,
    start_date: formatDate(new Date()) + 'T22:16:00', rentItems: items,
  }, extra || {})
}

function item(extra) {
  return Object.assign({ id: 0, name: '雪板', code: 'B-001', noCode: false, noNeed: false, is_associate: false, category_id: 3, pick_type: null, atOnce: false }, extra || {})
}

test('套餐选「延时租赁」：装备当晚发放，起租日期是明天 00:00', () => {
  const { instance, patches } = loadForm([rentalWithItems([item(), item({ id: 2, is_associate: true, noCode: true, name: '雪杖' })])])
  instance.onPkgModeTap({ currentTarget: { dataset: { ridx: 0, mode: 'delay' } } })

  assert.equal(patches['displayRentals[0].pick_type'], '延时租赁')
  assert.equal(patches['displayRentals[0].atOnce'], true, '套餐级 atOnce 跟着模式走')
  for (const it of patches['displayRentals[0].rentItems']) assert.equal(it.atOnce, true, it.name + ' 要当晚发放')

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  assert.equal(patches['displayRentals[0].start_date'], formatDate(tomorrow) + 'T00:00:00')
})

test('套餐选「立即租赁」：当场发放，从现在起计费', () => {
  const { instance, patches } = loadForm([rentalWithItems([item()], { pick_type: '先租后取', atOnce: false })])
  instance.onPkgModeTap({ currentTarget: { dataset: { ridx: 0, mode: 'now' } } })
  assert.equal(patches['displayRentals[0].atOnce'], true)
  assert.equal(patches['displayRentals[0].rentItems'][0].atOnce, true)
  assert.equal(patches['displayRentals[0].start_date'].slice(0, 10), formatDate(new Date()))
})

test('套餐选「先租后取」：不当场发放，装备稍后取走', () => {
  const { instance, patches } = loadForm([rentalWithItems([item({ atOnce: true }), item({ id: 2, name: '雪杖', is_associate: true, noCode: true, atOnce: true })])])
  instance.onPkgModeTap({ currentTarget: { dataset: { ridx: 0, mode: 'later' } } })
  assert.equal(patches['displayRentals[0].pick_type'], '先租后取')
  assert.equal(patches['displayRentals[0].atOnce'], false)
  for (const it of patches['displayRentals[0].rentItems']) assert.equal(it.atOnce, false, it.name + ' 不当场发放')
  assert.equal(patches['displayRentals[0].start_date'].slice(0, 10), formatDate(new Date()), '预约起租是今天')
})

test('套餐里自己单独选过模式的装备不会被套餐模式覆盖', () => {
  const own = item({ id: 5, name: '雪鞋', pick_type: '先租后取', atOnce: false })
  const { instance, patches } = loadForm([rentalWithItems([item(), own])])
  instance.onPkgModeTap({ currentTarget: { dataset: { ridx: 0, mode: 'delay' } } })
  const items = patches['displayRentals[0].rentItems']
  assert.equal(items[0].atOnce, true)
  assert.equal(items[1].pick_type, '先租后取')
  assert.equal(items[1].atOnce, false, '自选的装备原样保留')
})

test('单件装备自己选模式：延时租赁、立即租赁当晚发放，先租后取不发放', () => {
  for (const [mode, pickType, atOnce] of [['delay', '延时租赁', true], ['now', '立即租赁', true], ['later', '先租后取', false]]) {
    const { instance, patches } = loadForm([rentalWithItems([item({ atOnce: !atOnce })])])
    instance.onItemModeTap({ currentTarget: { dataset: { ridx: 0, iidx: 0, mode } } })
    assert.equal(patches['displayRentals[0].rentItems[0].pick_type'], pickType)
    assert.equal(patches['displayRentals[0].rentItems[0].atOnce'], atOnce, pickType)
  }
})

// ---------- 追加租赁页：重新装入草稿时 atOnce 按 pick_type 派生，不能把延时租赁又改回 false ----------

function loadAppendPage() {
  const file = require.resolve('../pages/admin/rent/rent_append.js')
  delete require.cache[file]
  let definition = null
  global.getApp = () => ({ globalData: {} })
  global.Page = value => { definition = value }
  global.wx = {}
  require(file)
  delete global.Page
  delete require.cache[file]
  const page = { data: { shop: '', order: null }, setData(values) { Object.assign(this.data, values) } }
  Object.keys(definition).forEach(name => { if (typeof definition[name] === 'function') page[name] = definition[name].bind(page) })
  return page
}

test('追加页装入草稿：延时租赁、立即租赁当晚发放，先租后取不发放，装备和套餐一致', () => {
  const page = loadAppendPage()
  const draft = pickType => ({
    id: 9, appending: true, pick_type: pickType, atOnce: false, guaranty: 100,
    rentItems: [{ id: 1, pick_type: pickType, atOnce: true, category: { name: '双板' } }],
  })
  const order = { id: 1, shop: '万龙服务中心', appendingRentals: [draft('延时租赁'), draft('立即租赁'), draft('先租后取')] }
  page._setOrder(order)
  const want = { '延时租赁': true, '立即租赁': true, '先租后取': false }
  for (const rental of page.data.order.appendingRentals) {
    assert.equal(rental.atOnce, want[rental.pick_type], rental.pick_type)
    assert.equal(rental.rentItems[0].atOnce, want[rental.pick_type], rental.pick_type)
  }
})

test('追加页：没选过模式的草稿默认立即租赁，当晚发放', () => {
  const page = loadAppendPage()
  page._setOrder({ id: 1, appendingRentals: [{ id: 9, appending: true, pick_type: null, guaranty: 0, rentItems: [{ id: 1, category: { name: '双板' } }] }] })
  const rental = page.data.order.appendingRentals[0]
  assert.equal(rental.pick_type, '立即租赁')
  assert.equal(rental.atOnce, true)
  assert.equal(rental.rentItems[0].atOnce, true)
})

// ---------- 选分类后重建的配套项（雪杖等）：当场发放要跟着租赁模式，不能读前端临时字段 rental.atOnce ----------
// 2026-11-10 WT_ZL_261110_00001：开单先存草稿再选分类，草稿存回来后 rental.atOnce 丢了（租赁表没有这一列），
// 选【FIS】双板后自动带出的雪杖 atOnce=false，确认时没发放；后端要求应领装备全部发放才计租，当天租金一行都没写。
// 租赁模式存在 rental.pick_type（落库、往返不丢），配套项按它派生，和追加租赁页一致。
function loadFormForCategoryChange(displayRentals, associates) {
  const dataPath = require.resolve('../utils/data.js')
  const utilPath = require.resolve('../utils/util.js')
  const file = require.resolve('../components/reception/rent_recept_form/rent_recept_form.js')
  const originalData = require.cache[dataPath]
  const originalUtil = require.cache[utilPath]
  const fakeData = {
    getRentCategoryPromise: async id => ({ id, name: '【FIS】双板', deposit: 500, associateCategories: associates }),
    getShopByNamePromise: async () => ({ id: 10 }),
    getRentPriceListPromise: async () => [],
  }
  require.cache[dataPath] = { id: dataPath, filename: dataPath, loaded: true, exports: fakeData }
  require.cache[utilPath] = { id: utilPath, filename: utilPath, loaded: true, exports: { createRentalDetail() {}, formatDate } }
  delete require.cache[file]
  let definition = null
  global.Component = value => { definition = value }
  global.wx = { showToast() {}, showLoading() {}, hideLoading() {} }
  require(file)
  delete global.Component
  delete require.cache[file]
  const syncs = []
  const instance = {
    data: { displayRentals, expandedItem: {} },
    properties: { shop: '万龙体验中心' },
    setData(values) { Object.keys(values).forEach(k => setByPath(this.data, k, values[k])) },
    triggerEvent(name, detail) { if (name === 'syncRent') syncs.push(detail) },
  }
  Object.keys(definition.methods).forEach(name => { instance[name] = definition.methods[name].bind(instance) })
  const restore = () => {
    delete require.cache[file]
    if (originalData) require.cache[dataPath] = originalData; else delete require.cache[dataPath]
    if (originalUtil) require.cache[utilPath] = originalUtil; else delete require.cache[utilPath]
  }
  return { instance, syncs, restore }
}

test('选分类重建配套项：立即租赁、延时租赁的雪杖当场发放，先租后取不发放，不依赖丢失的 rental.atOnce', async () => {
  const associates = [{ associate_id: 27, category: { id: 27, name: '【其他】雪杖' } }]
  for (const [pickType, want] of [['立即租赁', true], ['延时租赁', true], ['先租后取', false]]) {
    // 草稿往返之后的样子：pick_type 在，rental.atOnce 没有
    const rental = {
      id: 5, pick_type: pickType, start_date: formatDate(new Date()) + 'T09:20:00', expectDays: 1,
      rentItems: [{ id: 7, is_associate: false, noCode: true, category_id: null, pick_type: pickType, atOnce: true, valid: 1 }],
    }
    const { instance, syncs, restore } = loadFormForCategoryChange([rental], associates)
    try {
      await instance._applyCategoryChange(0, 0, { id: 4, name: '【FIS】双板' })
    } finally { restore() }
    assert.equal(syncs.length, 1, pickType + ' 应触发保存')
    const items = syncs[0].rentals[0].rentItems
    const stick = items.find(i => i.is_associate)
    assert.ok(stick, pickType + ' 要带出雪杖')
    assert.equal(stick.atOnce, want, pickType + ' 的雪杖 atOnce')
    assert.equal(stick.pick_type, pickType)
  }
})

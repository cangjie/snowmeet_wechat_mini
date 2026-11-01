// 租赁模式和装备是否当场发放：立即租赁、延时租赁当场发放；先租后取不发放（先计租金，装备稍后取走）。
// 2026-11-01：旧版的延时租赁是装备当晚交给顾客、明天才开始计费；新版开单页原来选「延时租赁」会把 atOnce 设成 false，
// 装备开单时不发放；而「先租后取」原来反过来被当成当场发放。现在和旧版一致：
// 延时租赁当晚发放、明天起计费；先租后取先从现在起计租金、装备稍后由店员发放。起租日期只管从哪天计费。
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

test('套餐选「先租后取」：不发放，从现在起先计租金，装备稍后取走', () => {
  const { instance, patches } = loadForm([rentalWithItems([item({ atOnce: true }), item({ id: 2, name: '雪杖', is_associate: true, noCode: true, atOnce: true })])])
  instance.onPkgModeTap({ currentTarget: { dataset: { ridx: 0, mode: 'later' } } })
  assert.equal(patches['displayRentals[0].pick_type'], '先租后取')
  assert.equal(patches['displayRentals[0].atOnce'], false)
  for (const it of patches['displayRentals[0].rentItems']) assert.equal(it.atOnce, false, it.name + ' 不当场发放')
  assert.equal(patches['displayRentals[0].start_date'].slice(0, 10), formatDate(new Date()), '起租是今天，租金从现在起算')
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

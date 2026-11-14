// 租赁开单：商品（套餐/单品）的租赁模式按钮会按应领装备的模式亮起来（rentalModeDisplay），
// 但录入校验原来只看 rental.pick_type：商品没选过模式、店员在装备上选了模式后，按钮亮着「立即租赁」，
// 状态却报「模式未选」，去结算被拦（2026-11-14 用户截图）。现在：
//   1) 校验认「商品自己的模式，或一致的装备模式」，和按钮一致；
//   2) 在装备上选模式导致商品模式默认选中时，把 pick_type / atOnce 补到商品上（保存下来）；
//   3) 装备模式不一致、或商品自己选过，都不乱补；加载时不改数据。
const test = require('node:test')
const assert = require('node:assert/strict')

function setByPath(obj, pathStr, value) {
  const keys = pathStr.replace(/\[(\d+)\]/g, '.$1').split('.')
  let cur = obj
  keys.slice(0, -1).forEach(k => { cur = cur[k] })
  cur[keys[keys.length - 1]] = value
}

function loadForm(rentals, { data = {} } = {}) {
  const dataPath = require.resolve('../utils/data.js')
  const utilPath = require.resolve('../utils/util.js')
  const file = require.resolve('../components/reception/rent_recept_form/rent_recept_form.js')
  const originalData = require.cache[dataPath]
  const originalUtil = require.cache[utilPath]
  const fakeData = Object.assign({
    getShopByNamePromise: async () => ({ id: 10 }),
    getRentPriceListPromise: async () => [],
  }, data)
  require.cache[dataPath] = { id: dataPath, filename: dataPath, loaded: true, exports: fakeData }
  require.cache[utilPath] = { id: utilPath, filename: utilPath, loaded: true, exports: { createRentalDetail() {}, formatDate() { return '2026-11-14' } } }
  global.wx = { showToast() {}, showLoading() {}, hideLoading() {} }
  delete require.cache[file]
  let definition = null
  global.Component = value => { definition = value }
  require(file)
  delete global.Component
  delete require.cache[file]
  const events = []
  const instance = {
    data: { sort: 'time', expandedPkg: {}, expandedItem: {}, displayRentals: [] },
    properties: { shop: '崇礼旗舰店' },
    setData(values, callback) { Object.keys(values).forEach(k => setByPath(this.data, k, values[k])); if (callback) callback() },
    triggerEvent(name, detail) { events.push({ name, detail }) },
  }
  Object.keys(definition.methods).forEach(name => { instance[name] = definition.methods[name].bind(instance) })
  instance._repriceForDate = async () => {}
  instance._refreshRentals(rentals)
  events.length = 0
  const restore = () => {
    delete require.cache[file]
    if (originalData) require.cache[dataPath] = originalData; else delete require.cache[dataPath]
    if (originalUtil) require.cache[utilPath] = originalUtil; else delete require.cache[utilPath]
  }
  return { instance, events, restore }
}

// 崇礼这类店没有默认模式：商品开出来 pick_type 是空
const item = (pick_type, extra = {}) => ({ id: 0, name: '全能板', code: 'B-001', category_id: 1, noCode: false, pick_type, ...extra })
const rental = (items, extra = {}) => ({ id: 5, name: '【中级】全能板+青少全能', pick_type: null, start_date: '2026-11-14T21:01:00', rentItems: items, ...extra })
const tapItem = (mode, iidx = 0) => ({ currentTarget: { dataset: { ridx: 0, iidx, mode } } })

test('商品没选模式、装备也没选：照旧提示「模式未选」，不能结算', t => {
  const { instance, restore } = loadForm([rental([item(null)])]); t.after(restore)
  assert.equal(instance.data.displayRentals[0]._rentalStatusLabel, '模式未选')
  assert.equal(instance.data.summary.canCheckout, false)
})

test('在装备上选了模式：商品按钮亮起，状态不再报「模式未选」，可以结算，模式补到商品上并随保存带出', t => {
  const { instance, events, restore } = loadForm([rental([item(null)])]); t.after(restore)
  instance.onItemModeTap(tapItem('now'))

  const r = instance.data.displayRentals[0]
  assert.equal(r._modeKey, 'now')
  assert.equal(r._rentalEntered, true)
  assert.equal(r._rentalStatusLabel, '已录入')
  assert.equal(instance.data.summary.canCheckout, true)
  assert.equal(r.pick_type, '立即租赁')
  assert.equal(r.atOnce, true)
  const saved = events.at(-1).detail.rentals[0]
  assert.equal(saved.pick_type, '立即租赁')
  assert.equal(saved.rentItems[0].pick_type, '立即租赁')
})

test('先租后取、延时租赁：商品模式和发放标记也按装备补上', t => {
  for (const [mode, pickType, atOnce] of [['later', '先租后取', false], ['delay', '延时租赁', true]]) {
    const { instance, restore } = loadForm([rental([item(null)])])
    try {
      instance.onItemModeTap(tapItem(mode))
      const r = instance.data.displayRentals[0]
      assert.equal(r.pick_type, pickType, mode)
      assert.equal(r.atOnce, atOnce, mode)
      assert.equal(r._rentalEntered, true, mode)
    } finally { restore() }
  }
})

test('多件装备：只选了一件（另一件没选）时不乱补；两件选成一样才算商品模式', t => {
  const { instance, restore } = loadForm([rental([item(null), item(null, { id: 0, code: 'B-002' })])]); t.after(restore)
  instance.onItemModeTap(tapItem('now', 0))
  let r = instance.data.displayRentals[0]
  assert.equal(r.pick_type, null, '另一件还没选，不能认定商品模式')
  assert.equal(r._rentalStatusLabel, '模式未选')
  assert.equal(r._modeMixed, true)

  instance.onItemModeTap(tapItem('now', 1))
  r = instance.data.displayRentals[0]
  assert.equal(r.pick_type, '立即租赁')
  assert.equal(r._rentalEntered, true)
  assert.equal(r._modeMixed, false)
})

test('装备模式不一致、商品没选过：不补，仍提示「模式未选」', t => {
  const { instance, restore } = loadForm([rental([item(null), item(null, { code: 'B-002' })])]); t.after(restore)
  instance.onItemModeTap(tapItem('now', 0))
  instance.onItemModeTap(tapItem('later', 1))
  const r = instance.data.displayRentals[0]
  assert.equal(r.pick_type, null)
  assert.equal(r._rentalEntered, false)
  assert.equal(r._rentalStatusLabel, '模式未选')
})

test('商品自己选过模式：在装备上选别的模式，不覆盖商品自己的选择', t => {
  const { instance, restore } = loadForm([rental([item('先租后取')], { pick_type: '先租后取' })]); t.after(restore)
  instance.onItemModeTap(tapItem('now'))
  const r = instance.data.displayRentals[0]
  assert.equal(r.pick_type, '先租后取')
  assert.equal(r._rentalEntered, true)
})

test('加载（比如找回中断的单）：装备模式一致即可通过校验，但加载本身不改数据、不触发保存', t => {
  const raw = rental([item('立即租赁')])
  const { instance, events, restore } = loadForm([raw]); t.after(restore)
  const r = instance.data.displayRentals[0]
  assert.equal(r._rentalEntered, true)
  assert.equal(r._rentalStatusLabel, '已录入')
  assert.equal(r.pick_type, null)
  assert.equal(raw.pick_type, null)
  assert.equal(events.length, 0)
})

test('选分类重建配套项：商品没选过模式、装备是立即租赁，雪杖照样当场发放', async t => {
  const main = item('立即租赁', { category_id: null, noCode: true, name: '', code: '' })
  const { instance, events, restore } = loadForm([rental([main])], {
    data: { getRentCategoryPromise: async id => ({ id, name: '【FIS】双板', deposit: 500,
      associateCategories: [{ associate_id: 27, category: { id: 27, name: '【其他】雪杖' } }] }) } })
  t.after(restore)
  await instance._applyCategoryChange(0, 0, { id: 4, name: '【FIS】双板', deposit: 500 })

  const items = events.at(-1).detail.rentals[0].rentItems
  const stick = items.find(i => i.is_associate)
  assert.ok(stick, '要带出雪杖')
  assert.equal(stick.pick_type, '立即租赁')
  assert.equal(stick.atOnce, true)
})

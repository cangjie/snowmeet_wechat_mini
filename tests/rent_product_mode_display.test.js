const test = require('node:test')
const assert = require('node:assert/strict')

function setByPath(obj, path, value) {
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let target = obj
  keys.slice(0, -1).forEach(key => { target = target[key] })
  target[keys[keys.length - 1]] = value
}

function loadForm(rental) {
  const file = require.resolve('../components/reception/rent_recept_form/rent_recept_form.js')
  delete require.cache[file]
  let definition
  global.Component = value => { definition = value }
  global.wx = { showToast() {} }
  require(file)
  delete global.Component
  const events = []
  const instance = {
    data: { sort: 'time', expandedPkg: {}, expandedItem: {}, displayRentals: [] },
    properties: { shop: '万龙服务中心' },
    setData(values, callback) {
      Object.keys(values).forEach(key => setByPath(this.data, key, values[key]))
      if (callback) callback()
    },
    triggerEvent(name, detail) { events.push({ name, detail }) },
  }
  Object.entries(definition.methods).forEach(([name, fn]) => { instance[name] = fn.bind(instance) })
  instance._refreshRentals([rental])
  return { instance, events }
}

function item(pick_type, extra = {}) {
  return { name: '雪板', code: 'B-001', category_id: 1, pick_type, ...extra }
}

function rental(items, extra = {}) {
  return { id: 1, name: '套餐', pick_type: '立即租赁', start_date: '2026-11-13T09:00:00', rentItems: items, ...extra }
}

test('加载时四种一致的租赁物模式决定商品按钮，不改商品或装备数据', () => {
  for (const [pickType, key] of [['立即租赁', 'now'], ['先租后取', 'later'], ['延时租赁', 'delay'], ['异店租赁', 'cross']]) {
    const raw = rental([item(pickType), item(pickType, { noNeed: false })], { pick_type: '先租后取' })
    const { instance, events } = loadForm(raw)
    assert.equal(instance.data.displayRentals[0]._modeKey, key)
    assert.equal(instance.data.displayRentals[0]._modeMixed, false)
    assert.equal(instance.data.displayRentals[0].pick_type, '先租后取')
    assert.equal(raw.rentItems[0].pick_type, pickType)
    assert.equal(events.length, 0)
  }
})

test('分别修改租赁物时立即更新一致状态，混合或未选仍保留提示', () => {
  const { instance, events } = loadForm(rental([item('立即租赁'), item('先租后取')]))
  assert.equal(instance.data.displayRentals[0]._modeMixed, true)
  instance._applyItemMode(0, 0, 'later', null)
  assert.equal(instance.data.displayRentals[0]._modeKey, 'later')
  assert.equal(instance.data.displayRentals[0]._modeMixed, false)
  assert.equal(events.at(-1).detail.rentals[0].rentItems[0].pick_type, '先租后取')
  instance._applyItemMode(0, 1, 'delay', null)
  assert.equal(instance.data.displayRentals[0]._modeMixed, true)

  const missing = loadForm(rental([item('延时租赁'), item(null)]))
  assert.equal(missing.instance.data.displayRentals[0]._modeMixed, true)
})

test('不需要的租赁物不参与比较，切换不需要时立即更新；没有有效模式时保留商品原模式', () => {
  const { instance } = loadForm(rental([item('延时租赁'), item('先租后取')]))
  instance.onItemCodeFlag({ currentTarget: { dataset: { ridx: 0, iidx: 1, flag: 'not_required' } } })
  assert.equal(instance.data.displayRentals[0]._modeKey, 'delay')
  assert.equal(instance.data.displayRentals[0]._modeMixed, false)
  instance.onItemCodeFlag({ currentTarget: { dataset: { ridx: 0, iidx: 1, flag: 'not_required' } } })
  assert.equal(instance.data.displayRentals[0]._modeMixed, true)
  for (const items of [[], [item(null)], [item('延时租赁', { noNeed: true })]]) {
    assert.equal(loadForm(rental(items)).instance.data.displayRentals[0]._modeKey, 'now')
  }
})

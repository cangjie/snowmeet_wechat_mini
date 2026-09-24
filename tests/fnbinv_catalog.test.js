const test = require('node:test')
const assert = require('node:assert/strict')
const catalog = require('../pages/fnbinv/common/catalog.js')
const expiry = require('../pages/fnbinv/common/expiry.js')

const UNITS = [{ code: 'g', dimension: 1, factor_to_base: 1 }, { code: 'kg', dimension: 1, factor_to_base: 1000 },
  { code: 'ml', dimension: 2, factor_to_base: 1 }, { code: 'l', dimension: 2, factor_to_base: 1000 }, { code: 'piece', dimension: 3, factor_to_base: 1 }]
const rule = (id, storage, month, value) => ({ id, item_id: 9, storage_type: storage, production_month: month, shelf_life_value: value, shelf_life_unit: 'day', valid: true })
const rules = [...Array(12)].map((_, i) => rule(i + 1, 'ambient', i + 1, expiry.isWarmMonth(i + 1) ? 90 : 180))
  .concat([...Array(12)].map((_, i) => rule(i + 20, 'chilled', i + 1, 240)))
const dryBeans = { id: 7, parent_id: 1, level: 2, name: '干豆制品', default_storage: 'ambient', sort: 3, valid: true }

test('基本单位由默认录入单位的量纲决定', () => {
  assert.equal(catalog.baseUnitFor('kg', UNITS), 'g')
  assert.equal(catalog.baseUnitFor('l', UNITS), 'ml')
  assert.equal(catalog.baseUnitFor('piece', UNITS), 'piece')
})

test('二级分类只有名称和建议储存方式', () => {
  const edit = catalog.categoryEditState(dryBeans)
  assert.deepEqual(catalog.categoryBody(edit), { id: 7, parentId: 1, level: 2, name: '干豆制品', defaultStorage: 'ambient', sort: 3, valid: true })
  assert.deepEqual(catalog.categoryBody(catalog.categoryEditState({ id: 1, level: 1, name: ' 干货 ', sort: 2, valid: true })),
    { id: 1, parentId: null, level: 1, name: '干货', defaultStorage: null, sort: 2, valid: true })
  const blank = catalog.categoryEditState({ id: 0, parent_id: 1, level: 2, name: '', default_storage: 'chilled', sort: 0, valid: true })
  assert.match(catalog.validateCategory(blank), /名称/)
  blank.name = '速冻面点'
  assert.equal(catalog.validateCategory(blank), '')
})

test('新建食材：临期提醒按分类储存方式给默认，开封后默认储存同分类，保质期规则都不适用', () => {
  const edit = catalog.materialEditState(null, dryBeans, rules)
  assert.equal(edit.categoryId, 7)
  assert.equal(edit.warnDays, '30')
  assert.equal(edit.openStorage, 'ambient')
  assert.equal(edit.openDays, '')
  assert.deepEqual(expiry.STORAGE.map(s => edit.rules[s.code].mode), ['none', 'none', 'none'])
  assert.equal(catalog.materialEditState(null, { id: 8, default_storage: 'frozen' }, []).warnDays, '7')
  edit.name = '红豆'
  const body = catalog.materialBody(edit, UNITS, 1790000000000)
  assert.match(body.code, /^M[0-9A-Z]+$/)
  assert.deepEqual(Object.assign({}, body, { code: 'X' }), { id: 0, code: 'X', name: '红豆', categoryId: 7, itemType: 'raw', baseUnitCode: 'g',
    defaultInputUnitCode: 'kg', warnDays: 30, defaultOpenStorage: 'ambient', defaultOpenDays: null, imageId: null, remark: null, valid: true })
})

test('编辑食材 ↔ 请求：保留编码、图片和备注，规则只取本食材的', () => {
  const item = { id: 9, code: 'BEAN1', name: '袋装黄豆', category_id: 7, item_type: 'raw', base_unit_code: 'g', default_input_unit_code: 'kg',
    warn_days: 15, default_open_storage: 'chilled', default_open_days: 5, image_id: 33, remark: '500g/袋' }
  const other = rule(99, 'frozen', 1, 30)
  other.item_id = 10
  const edit = catalog.materialEditState(item, dryBeans, rules.concat([other]))
  assert.deepEqual(edit.rules.ambient, { mode: 'band', unit: 'day', all: '', warm: '90', cold: '180' })
  assert.deepEqual(edit.rules.chilled, { mode: 'all', unit: 'day', all: '240', warm: '', cold: '' })
  assert.deepEqual(edit.rules.frozen, { mode: 'none', unit: 'day', all: '', warm: '', cold: '' })
  assert.deepEqual(catalog.materialBody(edit, UNITS, 0), { id: 9, code: 'BEAN1', name: '袋装黄豆', categoryId: 7, itemType: 'raw', baseUnitCode: 'g',
    defaultInputUnitCode: 'kg', warnDays: 15, defaultOpenStorage: 'chilled', defaultOpenDays: 5, imageId: 33, remark: '500g/袋', valid: true })
  assert.deepEqual(catalog.ruleSpec(edit.rules.ambient), { unit: 'day', warm: 90, cold: 180 })
  assert.deepEqual(catalog.ruleSpec(edit.rules.chilled), { unit: 'day', warm: 240, cold: 240 })
  assert.equal(catalog.ruleSpec(edit.rules.frozen), null)
})

test('开封后保质期不变：档案里记为 OPEN_KEEP_DAYS，编辑时显示为选项而不是天数', () => {
  const item = { id: 9, name: '速冻水饺', category_id: 7, base_unit_code: 'piece', default_input_unit_code: 'piece', warn_days: 7,
    default_open_storage: 'frozen', default_open_days: expiry.OPEN_KEEP_DAYS }
  const edit = catalog.materialEditState(item, dryBeans, [])
  assert.deepEqual({ openKeep: edit.openKeep, openDays: edit.openDays }, { openKeep: true, openDays: '' })
  assert.equal(catalog.validateMaterial(edit, UNITS), '')
  assert.equal(catalog.materialBody(edit, UNITS, 0).defaultOpenDays, expiry.OPEN_KEEP_DAYS)
  edit.openKeep = false
  edit.openDays = '3'
  assert.equal(catalog.materialBody(edit, UNITS, 0).defaultOpenDays, 3)
  assert.equal(catalog.materialEditState(Object.assign({}, item, { default_open_days: 5 }), dryBeans, []).openKeep, false)
})

test('食材规则保存计划：挂在食材上，只发有变化的月份', () => {
  const item = { id: 9, category_id: 7, base_unit_code: 'g', default_input_unit_code: 'kg', warn_days: 1 }
  const edit = catalog.materialEditState(item, dryBeans, rules)
  assert.deepEqual(catalog.rulePlans(rules, 9, edit.rules), [])
  edit.rules.frozen = { mode: 'all', unit: 'month', all: '6', warm: '', cold: '' }
  edit.rules.chilled.mode = 'none'
  const plans = catalog.rulePlans(rules, 9, edit.rules)
  assert.equal(plans.filter(p => p.storageType === 'frozen' && p.valid && p.id === 0 && p.shelfLifeValue === 6).length, 12)
  assert.equal(plans.filter(p => p.storageType === 'chilled' && !p.valid).length, 12)
  assert.ok(plans.every(p => p.itemId === 9 && p.categoryId === undefined))
})

test('食材校验：名称、单位量纲、非负整数提醒天数与开封天数、分档须两档都填', () => {
  const edit = catalog.materialEditState({ id: 9, name: '', category_id: 7, base_unit_code: 'g', default_input_unit_code: 'kg', warn_days: 1 }, dryBeans, [])
  assert.match(catalog.validateMaterial(edit, UNITS), /名称/)
  edit.name = '黄豆'
  edit.inputUnit = 'ml'
  assert.match(catalog.validateMaterial(edit, UNITS), /计量方式/)
  edit.inputUnit = 'g'
  edit.warnDays = ''
  assert.match(catalog.validateMaterial(edit, UNITS), /临期/)
  edit.warnDays = '0'
  edit.openDays = '-1'
  assert.match(catalog.validateMaterial(edit, UNITS), /开封/)
  edit.openDays = ''
  edit.rules.chilled = { mode: 'band', unit: 'day', all: '', warm: '7', cold: '' }
  assert.match(catalog.validateMaterial(edit, UNITS), /冷藏/)
  edit.rules.chilled.cold = '10'
  assert.equal(catalog.validateMaterial(edit, UNITS), '')
})

test('删除分类：有可用食材时拦下并给出数量；一级分类提示连同二级一起删', () => {
  const sub = (id, n) => ({ id, name: '小类' + id, items: [...Array(n)].map((_, i) => ({ id: i + 1 })) })
  const vegetables = catalog.deleteCheck('蔬菜类', [sub(2, 2)], false)
  assert.equal(vegetables.blocked, true)
  assert.match(vegetables.message, /「蔬菜类」下还有 2 种可用食材/)
  const fresh = catalog.deleteCheck('生鲜', [sub(2, 0), sub(3, 1)], true)
  assert.equal(fresh.blocked, true)
  assert.match(fresh.message, /还有 1 种可用食材/)
  const dry = catalog.deleteCheck('干货', [sub(4, 0), sub(5, 0)], true)
  assert.equal(dry.blocked, false)
  assert.match(dry.message, /2 个二级分类会一并删除/)
  const mushroom = catalog.deleteCheck('菌菇类', [sub(6, 0)], false)
  assert.equal(mushroom.blocked, false)
  assert.doesNotMatch(mushroom.message, /二级分类/)
  assert.doesNotMatch(catalog.deleteCheck('空大类', [], true).message, /一并/)
})

test('新食材编码：M + 时间戳，全大写且不超过 64 字符', () => {
  const code = catalog.newMaterialCode(1790000000000)
  assert.match(code, /^M[0-9A-Z]+$/)
  assert.notEqual(catalog.newMaterialCode(1790000000001), code)
})

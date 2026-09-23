const test = require('node:test')
const assert = require('node:assert/strict')
const catalog = require('../pages/fnbinv/common/catalog.js')
const expiry = require('../pages/fnbinv/common/expiry.js')

const UNITS = [{ code: 'g', dimension: 1, factor_to_base: 1 }, { code: 'kg', dimension: 1, factor_to_base: 1000 },
  { code: 'ml', dimension: 2, factor_to_base: 1 }, { code: 'l', dimension: 2, factor_to_base: 1000 }, { code: 'piece', dimension: 3, factor_to_base: 1 }]
const rule = (id, storage, month, value) => ({ id, category_id: 7, storage_type: storage, production_month: month, shelf_life_value: value, shelf_life_unit: 'day', valid: true })
const rules = [...Array(12)].map((_, i) => rule(i + 1, 'ambient', i + 1, expiry.isWarmMonth(i + 1) ? 90 : 180))
  .concat([...Array(12)].map((_, i) => rule(i + 20, 'chilled', i + 1, 240)))

test('基本单位由默认录入单位的量纲决定', () => {
  assert.equal(catalog.baseUnitFor('kg', UNITS), 'g')
  assert.equal(catalog.baseUnitFor('l', UNITS), 'ml')
  assert.equal(catalog.baseUnitFor('piece', UNITS), 'piece')
})

test('二级分类的规则摘要按冷藏/冷冻/常温列出', () => {
  assert.equal(catalog.ruleLine(rules, 7), '冷藏 240 天 · 常温 高温档 90 天 / 低温档 180 天')
  assert.equal(catalog.ruleLine([], 7), '未设置保质期规则')
})

test('编辑态 ↔ 请求：分类字段与三种储存方式的规则模式', () => {
  const category = { id: 7, parent_id: 1, level: 2, name: '干豆制品', default_storage: 'ambient', default_unit_code: 'kg', warn_days: 15,
    default_open_storage: 'ambient', default_open_days: 5, sort: 3, valid: true }
  const edit = catalog.editState(category, rules)
  assert.deepEqual(edit.rules.ambient, { mode: 'band', unit: 'day', all: '', warm: '90', cold: '180' })
  assert.deepEqual(edit.rules.chilled, { mode: 'all', unit: 'day', all: '240', warm: '', cold: '' })
  assert.deepEqual(edit.rules.frozen, { mode: 'none', unit: 'day', all: '', warm: '', cold: '' })
  const body = catalog.categoryBody(edit)
  assert.deepEqual(body, { id: 7, parentId: 1, level: 2, name: '干豆制品', defaultStorage: 'ambient', defaultUnitCode: 'kg', warnDays: 15,
    defaultOpenStorage: 'ambient', defaultOpenDays: 5, sort: 3, valid: true })
  assert.deepEqual(catalog.ruleSpec(edit.rules.ambient), { unit: 'day', warm: 90, cold: 180 })
  assert.deepEqual(catalog.ruleSpec(edit.rules.chilled), { unit: 'day', warm: 240, cold: 240 })
  assert.equal(catalog.ruleSpec(edit.rules.frozen), null)
})

test('分类校验：名称必填、二级须有默认单位与非负整数预警天数、分档须两档都填', () => {
  const edit = catalog.editState({ id: 0, parent_id: 1, level: 2, name: '', default_storage: 'chilled', default_unit_code: 'kg', warn_days: 1, sort: 0, valid: true }, [])
  assert.match(catalog.validate(edit), /名称/)
  edit.name = '蔬菜类'
  edit.warnDays = '-1'
  assert.match(catalog.validate(edit), /预警/)
  edit.warnDays = '1'
  edit.rules.chilled = { mode: 'band', unit: 'day', all: '', warm: '7', cold: '' }
  assert.match(catalog.validate(edit), /冷藏/)
  edit.rules.chilled.cold = '10'
  assert.equal(catalog.validate(edit), '')
})

test('新食材编码：M + 时间戳，全大写且不超过 64 字符', () => {
  const code = catalog.newMaterialCode(1790000000000)
  assert.match(code, /^M[0-9A-Z]+$/)
  assert.notEqual(catalog.newMaterialCode(1790000000001), code)
})

const test = require('node:test')
const assert = require('node:assert/strict')
const forms = require('../pages/fnbinv/common/forms.js')
const units = require('../pages/fnbinv/common/units.js')

const UNITS = [
  { code: 'g', dimension: 1, factor_to_base: 1 }, { code: 'kg', dimension: 1, factor_to_base: 1000 },
  { code: 'ml', dimension: 2, factor_to_base: 1 }, { code: 'l', dimension: 2, factor_to_base: 1000 },
  { code: 'piece', dimension: 3, factor_to_base: 1 }
]
const cabbage = { id: 10, name: '大白菜', base_unit_code: 'g', default_input_unit_code: 'kg', category_id: 2 }
const sauce = { id: 20, name: '番茄酱', base_unit_code: 'ml', default_input_unit_code: 'ml', category_id: 4 }
const rule = { id: 77, item_id: 10, storage_type: 'chilled', production_month: 9, shelf_life_value: 7, shelf_life_unit: 'day', valid: true }
const base = { requestId: 'r-1', photos: [{ id: 5 }], batchNo: 'B260923-01', storage: 'chilled', warnDays: 1,
  packed: false, qty: '10', inputUnit: 'kg', unitPrice: '', units: UNITS }

test('散装 + 生产日期按食材规则算到期：来源 category，带规则号', () => {
  const r = forms.buildReceipt(Object.assign({}, base, { material: cabbage, prodDate: '2026-09-20', rule }), '2026-09-23')
  assert.equal(r.ok, true, r.error)
  assert.deepEqual(r.body, {
    requestId: 'r-1', itemId: 10, batchNo: 'B260923-01', stockForm: 'bulk', storageType: 'chilled', storageLocation: null,
    quantity: 10, inputUnitCode: 'kg', unitPrice: 0, productionDate: '2026-09-20', shelfLifeValue: 7, shelfLifeUnit: 'day',
    expireDate: '2026-09-27', warnDays: 1, imageIds: [5], packSize: null, packUnitName: null, openStorageType: null,
    openShelfLifeDays: null, expirySource: 'category', expiryNote: null, shelfLifeRuleId: 77
  })
})

test('封装 + 包装上的到期日：来源 package，每件含量换算到基本单位，单价按件', () => {
  const r = forms.buildReceipt(Object.assign({}, base, { material: sauce, packed: true, qty: '3', packSize: '1', contentUnit: 'l',
    packName: '瓶', openStorage: 'chilled', openDays: '7', expireDate: '2027-03-01', unitPrice: '12.5' }), '2026-09-23')
  assert.equal(r.ok, true, r.error)
  assert.equal(r.body.stockForm, 'sealed')
  assert.equal(r.body.quantity, 3)
  assert.equal(r.body.inputUnitCode, 'ml')
  assert.equal(r.body.packSize, 1000)
  assert.equal(r.body.packUnitName, '瓶')
  assert.equal(r.body.openShelfLifeDays, 7)
  assert.equal(r.body.unitPrice, 12.5)
  assert.equal(r.body.expirySource, 'package')
  assert.equal(r.body.shelfLifeRuleId, null)
})

test('只知道生产月份：按规则从入库日估算，来源 estimated 并写明依据', () => {
  const r = forms.buildReceipt(Object.assign({}, base, { material: cabbage, month: 9, rule }), '2026-09-23')
  assert.equal(r.ok, true, r.error)
  assert.equal(r.body.expirySource, 'estimated')
  assert.equal(r.body.expireDate, '2026-09-30')
  assert.equal(r.body.productionDate, null)
  assert.match(r.body.expiryNote, /9 月/)
})

test('生产日期 + 手填保质期：来源 manual，按天数推算到期', () => {
  const r = forms.buildReceipt(Object.assign({}, base, { material: cabbage, prodDate: '2026-09-20', shelfValue: '5', shelfUnit: 'day' }), '2026-09-23')
  assert.equal(r.body.expirySource, 'manual')
  assert.equal(r.body.expireDate, '2026-09-25')
  assert.equal(r.body.shelfLifeValue, 5)
})

test('拦截：没照片、已过期、封装件数非整数、没有任何日期、没选食材', () => {
  const draft = Object.assign({}, base, { material: cabbage, expireDate: '2026-10-01' })
  assert.match(forms.buildReceipt(Object.assign({}, draft, { photos: [] }), '2026-09-23').error, /照片/)
  assert.match(forms.buildReceipt(Object.assign({}, draft, { expireDate: '2026-09-22' }), '2026-09-23').error, /已过期/)
  assert.match(forms.buildReceipt(Object.assign({}, draft, { packed: true, qty: '1.5', packSize: '500', contentUnit: 'g', packName: '袋', openStorage: 'chilled', openDays: '3' }), '2026-09-23').error, /整数/)
  assert.match(forms.buildReceipt(Object.assign({}, base, { material: cabbage }), '2026-09-23').error, /到期/)
  assert.match(forms.buildReceipt(Object.assign({}, base, { expireDate: '2026-10-01' }), '2026-09-23').error, /食材/)
})

test('三项日期都填且矛盾时提示以到期日为准', () => {
  assert.equal(forms.dateNote({ prodDate: '2026-09-20', shelfValue: '5', shelfUnit: 'day', expireDate: '2026-09-30' }),
    '按生产日期和保质期应为 2026-09-25，将以到期日期 2026-09-30 入库')
  assert.equal(forms.dateNote({ prodDate: '2026-09-20', shelfValue: '5', shelfUnit: 'day', expireDate: '2026-09-25' }), '')
})

test('基本单位换回录入单位显示', () => {
  assert.equal(units.fromBase(400, 'kg', UNITS), 0.4)
  assert.equal(units.fromBase(30, 'ml', UNITS), 30)
})

test('批次号：服务端发号若已被入库单占用，则递增末尾序号避让', () => {
  assert.equal(forms.nextBatchNo('B260923-03', []), 'B260923-03')
  assert.equal(forms.nextBatchNo('B260923-03', ['B260923-03', 'B260923-04']), 'B260923-05')
  assert.equal(forms.nextBatchNo('B260923-09', ['B260923-09']), 'B260923-10')
  assert.equal(forms.nextBatchNo('自定义', ['自定义']), '自定义-2')
})

test('生产日期晚于到期日期时在加入入库单前就拦下（服务端会拒）', () => {
  const r = forms.buildReceipt(Object.assign({}, base, { material: cabbage, prodDate: '2026-10-05', expireDate: '2026-10-01' }), '2026-09-23')
  assert.equal(r.ok, false)
  assert.match(r.error, /生产日期/)
})

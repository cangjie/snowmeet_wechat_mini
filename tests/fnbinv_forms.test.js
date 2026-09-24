const test = require('node:test')
const assert = require('node:assert/strict')
const forms = require('../pages/fnbinv/common/forms.js')
const units = require('../pages/fnbinv/common/units.js')
const expiry = require('../pages/fnbinv/common/expiry.js')

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

test('封装开封后保质期不变：开封天数记为 OPEN_KEEP_DAYS；既没填天数也没选不变时拦下', () => {
  const sealed = Object.assign({}, base, { material: sauce, packed: true, qty: '2', packSize: '500', contentUnit: 'ml',
    packName: '瓶', openStorage: 'chilled', expireDate: '2027-03-01' })
  const keep = forms.buildReceipt(Object.assign({}, sealed, { openKeep: true, openDays: '' }), '2026-09-23')
  assert.equal(keep.ok, true, keep.error)
  assert.equal(keep.body.openShelfLifeDays, expiry.OPEN_KEEP_DAYS)
  assert.match(forms.buildReceipt(Object.assign({}, sealed, { openDays: '' }), '2026-09-23').error, /保质期不变/)
})

test('封装含量单位与食材计量方式不一致（按毫升计量的酱写成克）时拦下', () => {
  const r = forms.buildReceipt(Object.assign({}, base, { material: sauce, packed: true, qty: '3', packSize: '500', contentUnit: 'g',
    packName: '瓶', openStorage: 'chilled', openDays: '7', expireDate: '2027-03-01' }), '2026-09-23')
  assert.equal(r.ok, false)
  assert.match(r.error, /每瓶含量的单位须与食材计量方式一致/)
})

test('没有生产日期也没有到期日期：拦下，不再按月份估算', () => {
  const r = forms.buildReceipt(Object.assign({}, base, { material: cabbage, month: 9, rule }), '2026-09-23')
  assert.equal(r.ok, false)
  assert.match(r.error, /到期日期/)
})

test('生产日期 + 手填保质期：来源 manual，按天数推算到期', () => {
  const r = forms.buildReceipt(Object.assign({}, base, { material: cabbage, prodDate: '2026-09-20', shelfValue: '5', shelfUnit: 'day' }), '2026-09-23')
  assert.equal(r.body.expirySource, 'manual')
  assert.equal(r.body.expireDate, '2026-09-25')
  assert.equal(r.body.shelfLifeValue, 5)
})

test('批次照片选填：不拍照也能加入入库单，照片列表为空', () => {
  const r = forms.buildReceipt(Object.assign({}, base, { material: cabbage, expireDate: '2026-10-01', photos: [] }), '2026-09-23')
  assert.equal(r.ok, true, r.error)
  assert.deepEqual(r.body.imageIds, [])
})

test('拦截：已过期、封装件数非整数、没有任何日期、没选食材', () => {
  const draft = Object.assign({}, base, { material: cabbage, expireDate: '2026-10-01' })
  assert.match(forms.buildReceipt(Object.assign({}, draft, { expireDate: '2026-09-22' }), '2026-09-23').error, /已过期/)
  assert.match(forms.buildReceipt(Object.assign({}, draft, { packed: true, qty: '1.5', packSize: '500', contentUnit: 'g', packName: '袋', openStorage: 'chilled', openDays: '3' }), '2026-09-23').error, /整数/)
  assert.match(forms.buildReceipt(Object.assign({}, base, { material: cabbage }), '2026-09-23').error, /到期/)
  assert.match(forms.buildReceipt(Object.assign({}, base, { expireDate: '2026-10-01' }), '2026-09-23').error, /食材/)
})

test('手填了到期日期：以它为准，生产日期和保质期不参与计算、也不提交', () => {
  const r = forms.buildReceipt(Object.assign({}, base, { material: cabbage, prodDate: '2026-09-20', shelfValue: '5', shelfUnit: 'day',
    expireDate: '2026-09-30', rule }), '2026-09-23')
  assert.equal(r.ok, true, r.error)
  assert.deepEqual({ source: r.body.expirySource, expireDate: r.body.expireDate, productionDate: r.body.productionDate,
    shelfLifeValue: r.body.shelfLifeValue, shelfLifeUnit: r.body.shelfLifeUnit, ruleId: r.body.shelfLifeRuleId },
  { source: 'package', expireDate: '2026-09-30', productionDate: null, shelfLifeValue: null, shelfLifeUnit: null, ruleId: null })
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

test('手填的到期日期早于之前填的生产日期：生产日期不提交，不再因矛盾被拦', () => {
  const r = forms.buildReceipt(Object.assign({}, base, { material: cabbage, prodDate: '2026-10-05', expireDate: '2026-10-01' }), '2026-09-23')
  assert.equal(r.ok, true, r.error)
  assert.equal(r.body.productionDate, null)
})

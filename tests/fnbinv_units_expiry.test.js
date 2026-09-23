const test = require('node:test')
const assert = require('node:assert/strict')
const units = require('../pages/fnbinv/common/units.js')
const expiry = require('../pages/fnbinv/common/expiry.js')

test('基本单位满 1000 换算成大单位显示', () => {
  assert.equal(units.formatQty(1500, 'g'), '1.5 kg')
  assert.equal(units.formatQty(800, 'g'), '800 g')
  assert.equal(units.formatQty(1000, 'ml'), '1 L')
  assert.equal(units.formatQty(250, 'ml'), '250 ml')
  assert.equal(units.formatQty(12, 'piece'), '12 个')
  assert.equal(units.formatQty(1234.567, 'g'), '1.23 kg')
  assert.equal(units.formatQty(0.3333, 'g'), '0.33 g')
})

test('输入单位按系数换算到基本单位，只列同量纲单位', () => {
  const list = [
    { code: 'g', name: '克', dimension: 1, factor_to_base: 1 }, { code: 'kg', name: '千克', dimension: 1, factor_to_base: 1000 },
    { code: 'ml', name: '毫升', dimension: 2, factor_to_base: 1 }, { code: 'piece', name: '个', dimension: 3, factor_to_base: 1 }
  ]
  assert.equal(units.toBase(1.5, 'kg', list), 1500)
  assert.deepEqual(units.inputUnitsFor('g', list).map(u => u.code), ['g', 'kg'])
  assert.equal(units.unitName('l'), 'L')
  assert.equal(units.unitName('piece'), '个')
})

test('储存方式中文名与高温档月份', () => {
  assert.equal(expiry.storageLabel('chilled'), '冷藏')
  assert.equal(expiry.storageLabel('frozen'), '冷冻')
  assert.equal(expiry.storageLabel('ambient'), '常温')
  assert.deepEqual([5, 6, 9, 10].map(expiry.isWarmMonth), [false, true, true, false])
})

test('到期日与服务端同口径：生产日 + N 天/月，月末按月底截断', () => {
  assert.equal(expiry.calcExpiry('2026-07-10', 7, 'day'), '2026-07-17')
  assert.equal(expiry.calcExpiry('2026-01-31', 1, 'month'), '2026-02-28')
  assert.equal(expiry.calcExpiry('2026-12-15', 30, 'day'), '2027-01-14')
  assert.equal(expiry.daysBetween('2026-09-23', '2026-09-25'), 2)
  assert.equal(expiry.daysBetween('2026-09-23T00:00:00', '2026-09-20'), -3)
})

test('临期汇总分成已过期、开封后临期、未开封临期三组，正常批次不出现', () => {
  const rows = [
    { batch_id: 1, itemName: '豆腐', status: '已过期', stock_form: 'sealed', expire_date: '2026-09-20T00:00:00' },
    { batch_id: 2, itemName: '番茄酱', status: '临期', stock_form: 'opened', expire_date: '2026-09-24T00:00:00' },
    { batch_id: 3, itemName: '白菜', status: '今日', stock_form: 'bulk', expire_date: '2026-09-23T00:00:00' },
    { batch_id: 4, itemName: '面粉', status: '正常', stock_form: 'bulk', expire_date: '2026-12-01T00:00:00' },
    { batch_id: 5, itemName: '奶油', status: '临期', stock_form: 'sealed', expire_date: '2026-09-25T00:00:00' }
  ]
  const groups = expiry.groupAlerts(rows)
  assert.deepEqual(groups.expired.map(r => r.batch_id), [1])
  assert.deepEqual(groups.opened.map(r => r.batch_id), [2])
  assert.deepEqual(groups.sealed.map(r => r.batch_id), [3, 5])
  assert.equal(groups.total, 4)
})

test('按储存方式归纳 12 个月规则：全年一致 / 高低温两档 / 未设置', () => {
  const make = (month, value) => ({ id: month, category_id: 7, storage_type: 'ambient', production_month: month, shelf_life_value: value, shelf_life_unit: 'day', valid: true })
  const all = [...Array(12)].map((_, i) => make(i + 1, 180))
  assert.deepEqual(expiry.summarizeRules(all, 'ambient'), { mode: 'all', unit: 'day', value: 180 })
  const band = [...Array(12)].map((_, i) => make(i + 1, expiry.isWarmMonth(i + 1) ? 90 : 180))
  assert.deepEqual(expiry.summarizeRules(band, 'ambient'), { mode: 'band', unit: 'day', warm: 90, cold: 180 })
  assert.equal(expiry.summarizeRules(band, 'frozen'), null)
})

test('规则保存计划：只改有变化的月份，删除时把已有规则置为停用', () => {
  const existing = [{ id: 11, category_id: 7, storage_type: 'chilled', production_month: 1, shelf_life_value: 10, shelf_life_unit: 'day', valid: true },
    { id: 17, category_id: 7, storage_type: 'chilled', production_month: 7, shelf_life_value: 10, shelf_life_unit: 'day', valid: true }]
  const plan = expiry.planRuleSaves(existing, 7, 'chilled', { unit: 'day', warm: 7, cold: 10 })
  assert.equal(plan.length, 11)
  assert.deepEqual(plan.find(p => p.productionMonth === 7), { id: 17, categoryId: 7, storageType: 'chilled', productionMonth: 7, shelfLifeValue: 7, shelfLifeUnit: 'day', remark: null, valid: true })
  assert.equal(plan.find(p => p.productionMonth === 1), undefined)
  assert.equal(plan.find(p => p.productionMonth === 2).id, 0)
  const removal = expiry.planRuleSaves(existing, 7, 'chilled', null)
  assert.deepEqual(removal.map(p => [p.id, p.valid]), [[11, false], [17, false]])
})

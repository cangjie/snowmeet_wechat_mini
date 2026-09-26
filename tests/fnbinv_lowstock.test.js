const test = require('node:test')
const assert = require('node:assert/strict')
const lowstock = require('../pages/fnbinv/common/lowstock.js')

const UNITS = [{ code: 'g', dimension: 1, factor_to_base: 1 }, { code: 'kg', dimension: 1, factor_to_base: 1000 },
  { code: 'ml', dimension: 2, factor_to_base: 1 }, { code: 'piece', dimension: 3, factor_to_base: 1 }]
const row = (patch) => Object.assign({ itemId: 1, itemName: '牛奶', categoryId: 2, baseUnitCode: 'ml', defaultInputUnitCode: 'ml',
  availableQuantity: 900, lastBatchQuantity: 6000, ratio: null, fixedQuantity: null, threshold: 600, low: false }, patch)

test('预警规则说明：数量优先，其次自定义比例，都没设为默认 10%', () => {
  assert.equal(lowstock.ruleLabel(row()), '最近一批的 10%（默认）')
  assert.equal(lowstock.ruleLabel(row({ ratio: 0.25 })), '最近一批的 25%')
  assert.equal(lowstock.ruleLabel(row({ fixedQuantity: 1500 })), '低于 1.5 L 预警')
})

test('展示行：库存低、已用完、没有入库记录分别提示', () => {
  const v = lowstock.viewRow(row({ availableQuantity: 500, low: true }))
  assert.deepEqual([v.tag.text, v.availLabel, v.lineLabel, v.lastLabel], ['库存低', '可用 500 ml', '预警线 600 ml', '最近一批 6 L'])
  assert.equal(lowstock.viewRow(row({ availableQuantity: 0, low: true })).tag.text, '已用完')
  const unknown = lowstock.viewRow(row({ lastBatchQuantity: null, threshold: null }))
  assert.deepEqual([unknown.tag.text, unknown.lastLabel], ['无法计算', ''])
  assert.match(unknown.lineLabel, /算不出预警线/)
  assert.equal(lowstock.viewRow(row()).tag.text, '正常')
})

test('库存页卡片说明：列出前两种，多了写总数', () => {
  assert.equal(lowstock.summary([row()]), '库存都够用')
  assert.equal(lowstock.summary([row({ low: true }), row({ itemName: '面粉', low: true })]), '牛奶、面粉快用完了')
  assert.equal(lowstock.summary([row({ low: true }), row({ itemName: '面粉', low: true }), row({ itemName: '糖', low: true })]), '牛奶、面粉 等 3 种快用完了')
})

test('设置：比例按百分数填，填 10 即恢复默认；数量按常用单位填、换成基本单位', () => {
  const cabbage = row({ itemId: 7, baseUnitCode: 'g', defaultInputUnitCode: 'kg', fixedQuantity: 2500 })
  const edit = lowstock.editorState(cabbage, UNITS)
  assert.deepEqual([edit.mode, edit.qtyText, edit.unitLabel, edit.ratioText], ['qty', '2.5', 'kg', '10'])
  assert.deepEqual(lowstock.saveBody(edit, UNITS).body, { itemId: 7, ratio: null, quantity: 2500 })
  assert.deepEqual(lowstock.saveBody(Object.assign({}, edit, { mode: 'ratio', ratioText: '15' }), UNITS).body, { itemId: 7, ratio: 0.15, quantity: null })
  assert.deepEqual(lowstock.saveBody(Object.assign({}, edit, { mode: 'ratio', ratioText: '10' }), UNITS).body, { itemId: 7, ratio: null, quantity: null })
  assert.match(lowstock.saveBody(Object.assign({}, edit, { mode: 'ratio', ratioText: '0' }), UNITS).error, /比例/)
  assert.match(lowstock.saveBody(Object.assign({}, edit, { mode: 'ratio', ratioText: '120' }), UNITS).error, /比例/)
  assert.match(lowstock.saveBody(Object.assign({}, edit, { qtyText: '' }), UNITS).error, /数量/)
  assert.equal(lowstock.editorState(row({ ratio: 0.2 }), UNITS).ratioText, '20')
})

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

test('设置弹层组件：打开时按这行带出当前设置，切到按数量填写后发 submit；填错不发', () => {
  let def = null
  global.Component = d => { def = d }
  const toasts = []
  global.wx = { showToast(o) { toasts.push(o.title) } }
  delete require.cache[require.resolve('../pages/fnbinv/components/low-stock-editor/index.js')]
  require('../pages/fnbinv/components/low-stock-editor/index.js')
  delete global.Component
  const events = []
  const comp = {
    data: JSON.parse(JSON.stringify(def.data)),
    properties: { show: true, row: row({ itemId: 7, itemName: '面粉', baseUnitCode: 'g', defaultInputUnitCode: 'kg' }), units: UNITS, saving: false },
    setData(patch) { Object.keys(patch).forEach(k => { const p = k.split('.'); let o = this.data; p.slice(0, -1).forEach(x => { o = o[x] }); o[p[p.length - 1]] = patch[k] }) },
    triggerEvent(name, detail) { events.push([name, detail]) }
  }
  Object.keys(def.methods).forEach(k => { comp[k] = def.methods[k].bind(comp) })
  def.observers['show, row'].call(comp, true, comp.properties.row)
  assert.deepEqual([comp.data.edit.name, comp.data.edit.mode, comp.data.edit.unitLabel], ['面粉', 'ratio', 'kg'])
  comp.setMode({ currentTarget: { dataset: { mode: 'qty' } } })
  comp.setQty({ detail: { value: 'abc' } })
  comp.onSave()
  assert.equal(events.length, 0)
  assert.match(toasts[0], /数量/)
  comp.setQty({ detail: { value: '1.2' } })
  comp.onSave()
  assert.deepEqual(events, [['submit', { itemId: 7, ratio: null, quantity: 1200 }]])
  comp.onClose()
  assert.equal(events[1][0], 'close')
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

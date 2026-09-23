const test = require('node:test')
const assert = require('node:assert/strict')
const view = require('../pages/fnbinv/common/stock-view.js')

const categories = [
  { id: 1, parent_id: null, level: 1, name: '生鲜', valid: true },
  { id: 2, parent_id: 1, level: 2, name: '蔬菜类', valid: true },
  { id: 3, parent_id: null, level: 1, name: '调味料', valid: true },
  { id: 4, parent_id: 3, level: 2, name: '酱料', valid: true }
]
const materials = [
  { id: 10, name: '大白菜', category_id: 2, base_unit_code: 'g', valid: true },
  { id: 20, name: '番茄酱', category_id: 4, base_unit_code: 'ml', valid: true }
]
const row = (id, item, form, qty, expire, extra) => ({
  batch: { id, name: item === 10 ? '大白菜' : '番茄酱', batch_no: 'B' + id, expire_date: expire + 'T00:00:00', warn_days: 1 },
  stock: Object.assign({ batch_id: id, item_id: item, stock_form: form, storage_type: 'chilled', quantity: qty,
    pack_size: null, pack_unit_name: null, sealed_pack_count: null, is_destroyed: false }, extra || {})
})
const rows = [
  row(1, 10, 'bulk', 1500, '2026-09-26'),
  row(2, 10, 'bulk', 0, '2026-09-24'),
  row(3, 20, 'sealed', 2000, '2027-03-01', { pack_size: 1000, pack_unit_name: '瓶', sealed_pack_count: 2 }),
  row(4, 20, 'opened', 800, '2026-09-25', { parent_batch_id: 3 }),
  row(5, 20, 'opened', 300, '2026-09-20', { is_destroyed: true })
]

test('按食材分组，去掉清零与已销毁批次，批次按到期先后排列', () => {
  const result = view.buildStockRows({ rows, materials, categories, today: '2026-09-23' })
  assert.deepEqual(result.items.map(i => i.name), ['大白菜', '番茄酱'])
  const tomato = result.items[1]
  assert.deepEqual(tomato.batches.map(b => b.batchId), [4, 3])
  assert.equal(tomato.availableLabel, '800 ml')
  assert.equal(tomato.sealedLabel, '2 瓶')
  assert.equal(tomato.hasSealed, true)
  assert.equal(tomato.subName, '酱料')
  assert.equal(tomato.initial, '番')
  assert.deepEqual({ sku: result.skuCount, batches: result.batchCount, opened: result.openedCount }, { sku: 2, batches: 3, opened: 1 })
  assert.equal(tomato.availLine, '另有未开封 2 瓶（2 L）')
  assert.equal(tomato.metaLine, '冷藏 · 2 个批次 · 含已开封')
  assert.deepEqual(tomato.tag, { text: '剩 2 天', tone: 'muted' })
  assert.deepEqual(result.items[0].tag, { text: '剩 3 天', tone: 'muted' })
})

test('食材状态标签：过期、今天到期、充足', () => {
  assert.deepEqual(view.itemTag(-1, 1), { text: '已过期', tone: 'danger' })
  assert.deepEqual(view.itemTag(0, 1), { text: '今天到期', tone: 'danger' })
  assert.deepEqual(view.itemTag(61, 1), { text: '充足', tone: 'ok' })
  assert.deepEqual(view.itemTag(2, 3), { text: '临期 2 天', tone: 'warn' })
})

test('批次文案：未开封显示件数×规格且可开封，到期天数与状态色', () => {
  const result = view.buildStockRows({ rows, materials, categories, today: '2026-09-23' })
  const sealed = result.items[1].batches[1]
  assert.equal(sealed.qtyLabel, '2 瓶 × 1 L')
  assert.equal(sealed.formLabel, '未开封')
  assert.equal(sealed.canOpen, true)
  const opened = result.items[1].batches[0]
  assert.equal(opened.formLabel, '已开封')
  assert.equal(opened.daysLeft, 2)
  assert.equal(opened.canOpen, false)
  const cabbage = result.items[0].batches[0]
  assert.equal(cabbage.expireText, '3 天后到期')
  assert.equal(view.expireText(0), '今天到期')
  assert.equal(view.expireText(-2), '已过期 2 天')
})

test('按一级、二级分类、储存方式和关键字筛选', () => {
  const base = { rows, materials, categories, today: '2026-09-23' }
  assert.deepEqual(view.buildStockRows(Object.assign({ filter: { l1: 3 } }, base)).items.map(i => i.itemId), [20])
  assert.deepEqual(view.buildStockRows(Object.assign({ filter: { l2: 2 } }, base)).items.map(i => i.itemId), [10])
  assert.deepEqual(view.buildStockRows(Object.assign({ filter: { storage: 'frozen' } }, base)).items, [])
  assert.deepEqual(view.buildStockRows(Object.assign({ filter: { query: '番茄' } }, base)).items.map(i => i.itemId), [20])
  assert.deepEqual(view.buildStockRows(Object.assign({ filter: { query: 'B1' } }, base)).items.map(i => i.itemId), [10])
})

test('分类树：一级带二级，停用的不出现', () => {
  const tree = view.categoryTree(categories.concat([{ id: 9, parent_id: 1, level: 2, name: '停用', valid: false }]))
  assert.deepEqual(tree.map(g => [g.name, g.subs.map(s => s.name)]), [['生鲜', ['蔬菜类']], ['调味料', ['酱料']]])
})

test('临期/过期行：形态、到期文案、数量与过期天数', () => {
  const row = view.alertRow({ batch_id: 7, itemName: '内酯豆腐', batch_no: 'B260908-09', stock_form: 'sealed', base_unit_code: 'piece',
    quantity: 6, expire_date: '2026-09-19T00:00:00', status: '已过期' }, '2026-09-23')
  assert.deepEqual(row, { batchId: 7, name: '内酯豆腐', batchNo: 'B260908-09', line: '未开封 · 2026-09-19 到期', expireText: '已过期 4 天',
    qtyLabel: '6 个', quantity: 6, overdue: 4, tone: 'danger' })
  assert.equal(view.alertRow({ batch_id: 8, itemName: 'x', batch_no: 'b', stock_form: 'opened', base_unit_code: 'ml', quantity: 900,
    expire_date: '2026-09-24', status: '临期' }, '2026-09-23').tone, 'warn')
})

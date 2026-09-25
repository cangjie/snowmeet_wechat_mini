const test = require('node:test')
const assert = require('node:assert/strict')
const kitchen = require('../pages/fnbinv/common/kitchen.js')
const stocktake = require('../pages/fnbinv/common/stocktake.js')
const dash = require('../pages/fnbinv/common/dash.js')

test('厨房单状态：已取消 / 待核对 / 待出餐 / 已出餐', () => {
  assert.equal(kitchen.orderStatus({ order_status: 'cancelled', review_status: 'verified' }, false).text, '已取消')
  assert.equal(kitchen.orderStatus({ order_status: 'pending', review_status: 'pending' }, false).text, '待核对')
  assert.equal(kitchen.orderStatus({ order_status: 'pending', review_status: 'verified' }, false).text, '待出餐')
  assert.equal(kitchen.orderStatus({ order_status: 'pending', review_status: 'verified' }, true).text, '已出餐')
  assert.equal(kitchen.lineSummary([{ item_name: '酸菜白肉锅', quantity: 1 }, { item_name: '麻婆豆腐', quantity: 2 }]), '酸菜白肉锅 ×1、麻婆豆腐 ×2')
})

test('出餐需求：欠料行标红并给出文案', () => {
  const rows = kitchen.needRows([{ itemId: 1, itemName: '白菜', plannedQuantity: 800, actualQuantity: 500, shortageQuantity: 300 }], { 1: 'g' })
  assert.deepEqual(rows[0], { itemId: 1, name: '白菜', planned: '800 g', actual: '500 g', short: true, shortLabel: '欠 300 g' })
})

test('盘点行合并食材名与预览差异，列出需要补承接批次的盘盈行', () => {
  const rows = stocktake.mergeRows(
    [{ item_id: 1, system_qty: 2200, counted_qty: 1900, rowVersion: 'v1' }, { item_id: 2, system_qty: 500, counted_qty: null, rowVersion: 'v2' }, { item_id: 3, system_qty: 10, counted_qty: 12, rowVersion: 'v3' }],
    [{ id: 1, name: '木耳', base_unit_code: 'g' }, { id: 2, name: '牛奶', base_unit_code: 'ml' }, { id: 3, name: '鸡蛋', base_unit_code: 'piece' }])
  assert.deepEqual(rows.map(r => [r.name, r.systemLabel, r.diffText]), [['木耳', '2.2 kg', '-300 g'], ['牛奶', '500 ml', ''], ['鸡蛋', '10 个', '+2 个']])
  assert.equal(stocktake.pendingCount(rows), 1)
  assert.deepEqual(stocktake.gainItems(rows).map(r => r.itemId), [3])
})

test('看板：按一级分类汇总在库成本，本周从周一算起', () => {
  const categories = [{ id: 1, level: 1, name: '肉禽水产', valid: true }, { id: 2, level: 2, parent_id: 1, name: '猪肉类', valid: true },
    { id: 3, level: 1, name: '干货', valid: true }, { id: 4, level: 2, parent_id: 3, name: '菌菇', valid: true }]
  const bars = dash.costBars([{ category_id: 2, total_amount: 612 }, { category_id: 4, total_amount: 286 }, { category_id: 2, total_amount: 0 }], categories)
  assert.deepEqual(bars.map(b => [b.name, b.valueLabel, b.pctLabel]), [['肉禽水产', '¥612.00', '68%'], ['干货', '¥286.00', '32%']])
  assert.deepEqual(dash.weekRange('2026-09-23'), { from: '2026-09-21', to: '2026-09-23' })
  assert.deepEqual(dash.weekRange('2026-09-27'), { from: '2026-09-21', to: '2026-09-27' })
  assert.equal(dash.lossAmount([{ delta_amount: -12.5 }, { delta_amount: -3 }, { delta_amount: 2 }]), 13.5)
})

test('损耗台账行：原因中文、批号、带符号数量', () => {
  assert.equal(dash.reasonLabel('stocktake_gain'), '盘盈')
  assert.equal(dash.reasonLabel('near_expiry'), '临期报损')
  assert.deepEqual(dash.ledgerRow({ movementId: '9', item_name: '干木耳', reason_code: 'stocktake_loss', batch_no: 'B1', base_unit_code: 'g', delta_qty: -300, delta_amount: -14.4, business_date: '2026-09-22T00:00:00' }),
    { id: '9', name: '干木耳', reason: '盘亏 · B1', qty: '-300 g', amount: '¥14.40', date: '09-22', gain: false })
  assert.equal(dash.ledgerRow({ movementId: '1', item_name: 'x', reason_code: 'expiry', batch_no: 'B2', base_unit_code: 'piece', delta_qty: 6, delta_amount: 1, business_date: '2026-09-22' }).qty, '+6 个')
})

test('下单时间：服务端 UTC（无时区后缀）换成北京时间 HH:mm', () => {
  assert.equal(kitchen.localTime('2026-09-23T03:42:10.123'), '11:42')
  assert.equal(kitchen.localTime('2026-09-23T16:05:00Z'), '00:05')
})

test('厨房单排序：待核对、待出餐在前，已出餐其次，已取消最后；同组按下单时间倒序', () => {
  const rows = [
    { order: { id: '1', ordered_at: '2026-09-23T03:00:00', order_status: 'pending', review_status: 'verified' }, served: true },
    { order: { id: '2', ordered_at: '2026-09-23T03:10:00', order_status: 'cancelled', review_status: 'pending' }, served: false },
    { order: { id: '3', ordered_at: '2026-09-23T03:20:00', order_status: 'pending', review_status: 'pending' }, served: false },
    { order: { id: '4', ordered_at: '2026-09-23T03:30:00', order_status: 'pending', review_status: 'verified' }, served: false }
  ]
  assert.deepEqual(kitchen.sortOrders(rows).map(r => r.order.id), ['4', '3', '1', '2'])
})

test('一道菜按已发布配方 × 份数算用料；没有配方或份数为 0 时为空', () => {
  const r = { output: 1, lines: [{ item_id: 10, quantity: 150 }, { item_id: 12, quantity: 20 }] }
  assert.deepEqual(kitchen.portionNeeds(r, 2), [{ itemId: 10, baseQty: 300 }, { itemId: 12, baseQty: 40 }])
  assert.deepEqual(kitchen.portionNeeds({ output: 10, lines: [{ item_id: 10, quantity: 1000 }] }, 3), [{ itemId: 10, baseQty: 300 }])
  assert.deepEqual(kitchen.portionNeeds(null, 2), [])
  assert.deepEqual(kitchen.portionNeeds(r, 0), [])
})

test('将扣减用料：按配方 × 份数以常用单位带出，改过的保留；提交只发改过的项，0 表示不扣', () => {
  const unitList = [{ code: 'g', dimension: 1, factor_to_base: 1 }, { code: 'kg', dimension: 1, factor_to_base: 1000 }, { code: 'ml', dimension: 2, factor_to_base: 1 }]
  const materialOf = { 10: { id: 10, name: '大白菜', base_unit_code: 'g', default_input_unit_code: 'kg' }, 12: { id: 12, name: '糖浆', base_unit_code: 'ml', default_input_unit_code: 'ml' } }
  let lines = kitchen.deductLines([{ itemId: 10, baseQty: 200 }, { itemId: 12, baseQty: 10 }], [], materialOf, unitList)
  assert.deepEqual(lines.map(l => [l.name, l.qty, l.unitCode, l.recipeLabel, l.touched]), [['大白菜', '0.2', 'kg', '200 g', false], ['糖浆', '10', 'ml', '10 ml', false]])
  lines[1] = Object.assign({}, lines[1], { qty: '0', touched: true })
  lines = kitchen.deductLines([{ itemId: 10, baseQty: 300 }, { itemId: 12, baseQty: 15 }], lines, materialOf, unitList)
  assert.deepEqual(lines.map(l => l.qty), ['0.3', '0'])
  assert.deepEqual(kitchen.adjustments(lines, unitList), { ingredients: [{ itemId: 12, quantity: 0 }] })
  assert.match(kitchen.adjustments([Object.assign({}, lines[0], { qty: '0', touched: true }), lines[1]], unitList).error, /至少/)
  assert.match(kitchen.adjustments([Object.assign({}, lines[0], { qty: '', touched: true })], unitList).error, /不小于 0/)
})

test('出餐列表耗用：按实际扣减量列每种食材，欠料注明欠多少', () => {
  const unitOf = { 10: 'g', 12: 'ml' }
  assert.equal(kitchen.usedSummary([{ itemId: 10, itemName: '大白菜', actualQuantity: 1500, shortageQuantity: 0 },
    { itemId: 12, itemName: '番茄酱', actualQuantity: 20, shortageQuantity: 10 }], unitOf), '大白菜 1.5 kg、番茄酱 20 ml（欠 10 ml）')
  assert.equal(kitchen.usedSummary([], unitOf), '')
})

const test = require('node:test')
const assert = require('node:assert/strict')
const recipe = require('../pages/fnbinv/common/recipe.js')

const UNITS = [{ code: 'g', dimension: 1, factor_to_base: 1 }, { code: 'kg', dimension: 1, factor_to_base: 1000 },
  { code: 'ml', dimension: 2, factor_to_base: 1 }, { code: 'piece', dimension: 3, factor_to_base: 1 }]
const materials = [
  { id: 1, name: '大白菜', base_unit_code: 'g', default_input_unit_code: 'kg', item_type: 'raw', valid: true },
  { id: 2, name: '生抽', base_unit_code: 'ml', default_input_unit_code: 'ml', item_type: 'raw', valid: true },
  { id: 3, name: 'Pizza 面团', base_unit_code: 'piece', default_input_unit_code: 'piece', item_type: 'prepared', valid: true }
]

test('配方行展示：名称 + 基本单位换算后的用量', () => {
  assert.deepEqual(recipe.linesView([{ item_id: 1, quantity: 400, sort: 1 }, { item_id: 2, quantity: 20, sort: 2 }], materials),
    [{ itemId: 1, name: '大白菜', qtyLabel: '400 g' }, { itemId: 2, name: '生抽', qtyLabel: '20 ml' }])
})

test('编辑态按录入单位显示，提交时换回基本单位', () => {
  const lines = recipe.editorLines([{ item_id: 1, quantity: 400 }, { item_id: 2, quantity: 20 }], materials, UNITS)
  assert.deepEqual(lines[0], { itemId: 1, name: '大白菜', qty: '0.4', unitCode: 'kg', unitLabel: 'kg' })
  const body = recipe.draftBody({ id: '12', rowVersion: 'rv', kind: 'dish', dishSpecId: 5, lines }, UNITS)
  assert.deepEqual(body.body, { id: '12', recipeType: 'dish', dishSpecId: 5, outputItemId: null, outputQty: 1, remark: null, rowVersion: 'rv',
    lines: [{ itemId: 1, quantity: 400, sort: 1, remark: null }, { itemId: 2, quantity: 20, sort: 2, remark: null }] })
})

test('半成品配方：产出量按产出食材单位，用料不能包含产出本身', () => {
  const ok = recipe.draftBody({ id: 0, kind: 'prep', outputItemId: 3, outputQty: '10', outputUnit: 'piece',
    lines: [{ itemId: 1, qty: '1.8', unitCode: 'kg' }] }, UNITS)
  assert.equal(ok.body.recipeType, 'prep')
  assert.equal(ok.body.outputQty, 10)
  assert.equal(ok.body.dishSpecId, null)
  assert.equal(ok.body.lines[0].quantity, 1800)
  assert.match(recipe.draftBody({ id: 0, kind: 'prep', outputItemId: 3, outputQty: '10', outputUnit: 'piece', lines: [{ itemId: 3, qty: '1', unitCode: 'piece' }] }, UNITS).error, /产出/)
  assert.match(recipe.draftBody({ id: 0, kind: 'prep', outputItemId: 3, outputQty: '', outputUnit: 'piece', lines: [{ itemId: 1, qty: '1', unitCode: 'kg' }] }, UNITS).error, /产出量/)
})

test('配方校验：至少一行、用量大于 0、同一食材不重复', () => {
  assert.match(recipe.draftBody({ id: 0, kind: 'dish', dishSpecId: 5, lines: [] }, UNITS).error, /用料/)
  assert.match(recipe.draftBody({ id: 0, kind: 'dish', dishSpecId: 5, lines: [{ itemId: 1, qty: '0', unitCode: 'kg' }] }, UNITS).error, /用量/)
  assert.match(recipe.draftBody({ id: 0, kind: 'dish', dishSpecId: 5, lines: [{ itemId: 1, qty: '1', unitCode: 'kg' }, { itemId: 1, qty: '2', unitCode: 'kg' }] }, UNITS).error, /重复/)
})

test('菜品配方状态文案', () => {
  assert.deepEqual(recipe.dishStatus({ publishedRecipeId: '9', publishedVersion: 2, draftRecipeId: null }), { text: '已发布 v2', tone: 'ok' })
  assert.deepEqual(recipe.dishStatus({ publishedRecipeId: null, draftRecipeId: '3' }), { text: '草稿未发布', tone: 'warn' })
  assert.deepEqual(recipe.dishStatus({ publishedRecipeId: null, draftRecipeId: null }), { text: '未配置配方', tone: 'danger' })
})

test('半成品配方取最新发布版与最新草稿', () => {
  const picked = recipe.latestFor([{ id: '1', status: 'retired', version_no: 1, output_item_id: 3 }, { id: '2', status: 'published', version_no: 2, output_item_id: 3 },
    { id: '4', status: 'draft', version_no: 3, output_item_id: 3 }, { id: '5', status: 'published', version_no: 1, output_item_id: 9 }], 3)
  assert.deepEqual({ published: picked.published.id, draft: picked.draft.id }, { published: '2', draft: '4' })
})

test('制作预估：用量 × 批数 对比可用量，不足则整单不可制作', () => {
  const lines = [{ item_id: 1, quantity: 1800 }, { item_id: 2, quantity: 600 }]
  const stock = { 1: 5000, 2: 400 }
  const r = recipe.prepNeeds(lines, 2, stock, materials)
  assert.deepEqual(r.rows.map(x => [x.name, x.needLabel, x.stockLabel, x.short]), [['大白菜', '3.6 kg', '可用 5 kg', false], ['生抽', '1.2 L', '可用 400 ml', true]])
  assert.equal(r.ok, false)
  assert.equal(recipe.prepNeeds(lines, 1, { 1: 5000, 2: 600 }, materials).ok, true)
})

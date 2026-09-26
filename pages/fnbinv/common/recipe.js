// 配方：菜品（一菜一份「标准份」）与半成品；用量服务端存基本单位，编辑时按录入单位
const units = require('./units.js')

function byId(materials) {
  const map = {}
  ;(materials || []).forEach(m => { map[m.id] = m })
  return map
}

function linesView(lines, materials) {
  const map = byId(materials)
  return (lines || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).map(l => {
    const m = map[l.item_id] || { name: '食材#' + l.item_id, base_unit_code: '' }
    return { itemId: l.item_id, name: m.name, qtyLabel: units.formatQty(l.quantity, m.base_unit_code) }
  })
}

// 配方用量都不大：食材常用单位是千克、升的，用料按克、毫升填（单位表里有才换）
function lineUnitCode(material, unitList) {
  const code = material.default_input_unit_code || material.base_unit_code
  const small = { kg: 'g', l: 'ml' }[code]
  return small && (unitList || []).some(u => u.code === small) ? small : code
}

function editorLine(material, baseQty, unitList) {
  const unitCode = lineUnitCode(material, unitList)
  return { itemId: material.id, name: material.name, qty: baseQty === null ? '' : String(units.fromBase(baseQty, unitCode, unitList)),
    unitCode, unitLabel: units.unitName(unitCode) }
}

// scale：按比例换算用量（早先按整批产出存的半成品配方，编辑时换成每 1 单位的用量）
function editorLines(lines, materials, unitList, scale) {
  const map = byId(materials)
  const k = scale > 0 ? scale : 1
  return (lines || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0))
    .filter(l => map[l.item_id]).map(l => editorLine(map[l.item_id], Math.round(l.quantity * k * 1e6) / 1e6, unitList))
}

// 半成品配方按「每 1 单位」填用量：克、毫升太小，换成千克、升（单位表里有才换）
function perUnitCode(code, unitList) {
  const big = { g: 'kg', ml: 'l' }[code]
  return big && (unitList || []).some(u => u.code === big) ? big : code
}

function draftBody(editor, unitList) {
  const lines = editor.lines || []
  if (!lines.length) return { error: '请至少添加一种用料' }
  if (lines.some(l => !(Number(l.qty) > 0))) return { error: '每种用料的用量都要大于 0' }
  if (new Set(lines.map(l => l.itemId)).size !== lines.length) return { error: '同一种食材不能重复添加' }
  const prep = editor.kind === 'prep'
  let outputQty = 1
  if (prep) {
    if (lines.some(l => l.itemId === editor.outputItemId)) return { error: '用料不能包含产出的半成品本身' }
    // 用量是每 1 单位半成品的，产出量固定存 1 单位；制作时按实际产出量折算
    outputQty = units.toBase(1, editor.outputUnit, unitList)
  }
  return {
    body: {
      id: editor.id || 0, recipeType: prep ? 'prep' : 'dish', dishSpecId: prep ? null : editor.dishSpecId,
      outputItemId: prep ? editor.outputItemId : null, outputQty, remark: null, rowVersion: editor.rowVersion || null,
      lines: lines.map((l, i) => ({ itemId: l.itemId, quantity: units.toBase(l.qty, l.unitCode, unitList), sort: i + 1, remark: null }))
    }
  }
}

// 菜品卡片副标题：不设分类（「未分类」）、售价为 0 时不显示
function dishMeta(dish) {
  return [dish.categoryName && dish.categoryName !== '未分类' ? dish.categoryName : '',
    dish.salePrice > 0 ? units.money(dish.salePrice) : ''].filter(Boolean).join(' · ')
}

function dishStatus(dish) {
  if (dish.publishedRecipeId) return { text: '已发布 v' + dish.publishedVersion, tone: 'ok' }
  if (dish.draftRecipeId) return { text: '草稿未发布', tone: 'warn' }
  return { text: '未配置配方', tone: 'danger' }
}

function latestFor(recipes, outputItemId) {
  const own = (recipes || []).filter(r => r.recipe_type !== 'dish' && r.output_item_id === outputItemId)
  const top = status => own.filter(r => r.status === status).sort((a, b) => b.version_no - a.version_no)[0] || null
  return { published: top('published'), draft: top('draft') }
}

// 制作预估（仅展示，以服务端过账为准）：配方用量 × 倍数（实际产出 ÷ 配方产出），对比可用量（散装 + 已开封，不含过期）
function prepNeeds(lines, factor, availableByItem, materials) {
  const map = byId(materials)
  const rows = (lines || []).map(l => {
    const m = map[l.item_id] || { name: '食材#' + l.item_id, base_unit_code: '' }
    const need = Math.round(l.quantity * factor * 1e6) / 1e6
    const have = Number(availableByItem[l.item_id] || 0)
    return { itemId: l.item_id, name: m.name, need, needLabel: units.formatQty(need, m.base_unit_code),
      stockLabel: '可用 ' + units.formatQty(have, m.base_unit_code), short: have < need }
  })
  return { rows, ok: rows.length > 0 && rows.every(r => !r.short) }
}

module.exports = { linesView, lineUnitCode, editorLine, editorLines, perUnitCode, draftBody, dishMeta, dishStatus, latestFor, prepNeeds }

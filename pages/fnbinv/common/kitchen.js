// 厨房单展示：状态、菜品摘要、出餐扣料需求；建单时的配料表（按配方 × 份数自动算，可手动改）
const units = require('./units.js')
const recipe = require('./recipe.js')

// 选中菜品的配方合计用量（食材基本单位）。recipes：recipeId → { output, lines: [{ item_id, quantity }] }
function dishNeeds(dishes, qtyOf, recipes) {
  const total = {}
  ;(dishes || []).forEach(d => {
    const n = Number(qtyOf[d.productId]) || 0
    const r = d.publishedRecipeId && recipes[d.publishedRecipeId]
    if (!(n > 0) || !r) return
    r.lines.forEach(l => { total[l.item_id] = Math.round(((total[l.item_id] || 0) + l.quantity * n / (r.output || 1)) * 1e6) / 1e6 })
  })
  return Object.keys(total).map(id => ({ itemId: Number(id), baseQty: total[id] }))
}

// 重新按菜品算配料时保留手动操作：改过用量的（touched）保留原值，手动加的保留，删掉的（removedIds）不再出现
function mergeIngredients(prev, computed, removedIds, materials, unitList) {
  const old = {}
  ;(prev || []).forEach(l => { old[l.itemId] = l })
  const materialOf = {}
  ;(materials || []).forEach(m => { materialOf[m.id] = m })
  const out = []
  computed.forEach(c => {
    if (removedIds.indexOf(c.itemId) >= 0 || !materialOf[c.itemId]) return
    const hit = old[c.itemId]
    out.push(hit && hit.touched ? hit : Object.assign(recipe.editorLine(materialOf[c.itemId], c.baseQty, unitList), { auto: true, touched: false }))
  })
  ;(prev || []).filter(l => !l.auto && !computed.some(c => c.itemId === l.itemId)).forEach(l => out.push(l))
  return out
}

// 配料表 → CreateAndServe 的 ingredients（换算为基本单位）
function ingredientBody(lines, unitList) {
  if (!lines || !lines.length) return { error: '请至少有一种配料' }
  if (lines.some(l => !(Number(l.qty) > 0))) return { error: '每种配料的用量都要大于 0' }
  return { ingredients: lines.map(l => ({ itemId: l.itemId, quantity: units.toBase(l.qty, l.unitCode, unitList) })) }
}

function orderStatus(order, served) {
  if (order.order_status === 'cancelled') return { text: '已取消', tone: 'muted', key: 'cancelled' }
  if (served) return { text: '已出餐', tone: 'ok', key: 'served' }
  if (order.review_status !== 'verified') return { text: '待核对', tone: 'warn', key: 'review' }
  return { text: '待出餐', tone: 'blue', key: 'ready' }
}

function lineSummary(lines) {
  return (lines || []).map(l => l.item_name + ' ×' + units.trimNum(l.quantity)).join('、')
}

function needRows(needs, unitOf) {
  return (needs || []).map(n => {
    const unit = unitOf[n.itemId] || ''
    const short = n.shortageQuantity > 0
    return { itemId: n.itemId, name: n.itemName, planned: units.formatQty(n.plannedQuantity, unit),
      actual: units.formatQty(n.actualQuantity, unit), short, shortLabel: short ? '欠 ' + units.formatQty(n.shortageQuantity, unit) : '' }
  })
}

// 审计时间按 UTC 存，EF 输出不带 Z：一律按 UTC 解析再换北京时间
function localTime(iso) {
  const text = String(iso || '')
  const utc = /[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : text + 'Z'
  const d = new Date(new Date(utc).getTime() + 8 * 3600000)
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0')
}

const RANK = { review: 0, ready: 0, served: 1, cancelled: 2 }

function sortOrders(rows) {
  return (rows || []).slice().sort((a, b) => {
    const ra = RANK[orderStatus(a.order, a.served).key]
    const rb = RANK[orderStatus(b.order, b.served).key]
    return ra - rb || String(b.order.ordered_at).localeCompare(String(a.order.ordered_at))
  })
}

module.exports = { orderStatus, lineSummary, needRows, localTime, sortOrders, dishNeeds, mergeIngredients, ingredientBody }

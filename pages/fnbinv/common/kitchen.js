// 厨房单展示：状态、菜品摘要、出餐扣料需求、列表耗用；建单时按配方带出将扣减的用料，可微调，并提示库存够不够
const units = require('./units.js')
const recipe = require('./recipe.js')

// 一张厨房单一道菜：按已发布配方 × 份数算用料（基本单位）。recipe：{ output, lines: [{ item_id, quantity }] }
function portionNeeds(recipe, portions) {
  const n = Number(portions) || 0
  if (!recipe || !(n > 0)) return []
  return recipe.lines.map(l => ({ itemId: l.item_id, baseQty: Math.round(l.quantity * n / (recipe.output || 1) * 1e6) / 1e6 }))
}

// 将扣减的用料行（按常用单位显示，可微调）：改过的（touched）保留原值，其余按配方 × 份数
function deductLines(needs, prev, materialOf, unitList) {
  const old = {}
  ;(prev || []).forEach(l => { old[l.itemId] = l })
  return needs.map(n => {
    const m = materialOf[n.itemId] || { id: n.itemId, name: '食材#' + n.itemId, base_unit_code: '', default_input_unit_code: '' }
    const line = Object.assign(recipe.editorLine(m, n.baseQty, unitList),
      { baseUnit: m.base_unit_code, recipeQty: n.baseQty, recipeLabel: units.formatQty(n.baseQty, m.base_unit_code) })
    const hit = old[n.itemId]
    return Object.assign(line, hit && hit.touched ? { qty: hit.qty, touched: true } : { touched: false })
  })
}

// 微调过的用料 → CreateAndServe / UpdateServedOrder 的 ingredients（基本单位；0 表示这单不扣这一项）；没改的按配方
function adjustments(lines, unitList) {
  if ((lines || []).some(l => l.qty === '' || isNaN(Number(l.qty)) || Number(l.qty) < 0)) return { error: '用量要填不小于 0 的数' }
  if (lines.length && lines.every(l => Number(l.qty) === 0)) return { error: '至少要扣一种配料' }
  return { ingredients: lines.filter(l => l.touched).map(l => ({ itemId: l.itemId, quantity: units.toBase(l.qty, l.unitCode, unitList) })) }
}

// 建单前的库存提示（仅展示，以服务端扣料为准）：用量超过能扣的量（散装、已开封、自制，未过期）就标欠料；
// 欠料且有整包没开封的，提示开封。stockOf：GetDeductStock 按食材；served：编辑已扣料的单时这单已扣的量（保存时先退回，算可用时加回）
function withStock(lines, stockOf, unitList, served) {
  return (lines || []).map(l => {
    const s = stockOf && stockOf[l.itemId]
    if (!s) return Object.assign({}, l, { stockKnown: false, short: false, availLabel: '', shortLabel: '', openHint: '', canOpen: false })
    const avail = Math.round((Number(s.availableQuantity || 0) + Number((served && served[l.itemId]) || 0)) * 1e6) / 1e6
    const need = l.qty === '' || isNaN(Number(l.qty)) ? 0 : units.toBase(l.qty, l.unitCode, unitList)
    const gap = Math.round((need - avail) * 1e6) / 1e6
    const short = gap > 0
    const packs = Number(s.sealedPacks || 0)
    return Object.assign({}, l, { stockKnown: true, short,
      availLabel: '可用 ' + units.formatQty(avail, l.baseUnit),
      shortLabel: short ? '欠 ' + units.formatQty(gap, l.baseUnit) : '',
      openHint: short && packs > 0 ? '另有 ' + packs + ' ' + (s.packUnitName || '件') + '未开封' : '',
      canOpen: short && !!s.openBatchId, openLabel: '开封 1 ' + (s.packUnitName || '件') })
  })
}

// 建单确认框里列出欠料：大白菜 欠 50 g（另有 2 袋未开封）
function shortageText(lines) {
  return (lines || []).filter(l => l.short).map(l => l.name + ' ' + l.shortLabel + (l.openHint ? '（' + l.openHint + '）' : '')).join('；')
}

// 还能补扣的欠料：欠着、且出餐后没被盘点调整过
function openShortage(needs) {
  return (needs || []).filter(n => n.shortageQuantity > 0 && !n.settledByStocktake)
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
    const label = short ? '欠 ' + units.formatQty(n.shortageQuantity, unit) + (n.settledByStocktake ? ' · 已盘点' : '') : ''
    return { itemId: n.itemId, name: n.itemName, planned: units.formatQty(n.plannedQuantity, unit),
      actual: units.formatQty(n.actualQuantity, unit), short, shortLabel: label }
  })
}

// 列表卡片上的一行耗用：按实际扣减量列出每种食材，欠料的注明欠多少（出餐后已盘点调整的注明）
function usedSummary(needs, unitOf) {
  return (needs || []).map(n => {
    const unit = unitOf[n.itemId] || ''
    return n.itemName + ' ' + units.formatQty(n.actualQuantity, unit) + (n.shortageQuantity > 0 ? '（欠 ' + units.formatQty(n.shortageQuantity, unit) + (n.settledByStocktake ? '，已盘点' : '') + '）' : '')
  }).join('、')
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

module.exports = { orderStatus, lineSummary, needRows, usedSummary, localTime, sortOrders, portionNeeds, deductLines, adjustments,
  withStock, shortageText, openShortage }

// 盘点：快照行 + 食材名 → 展示行；盘盈行需补承接批次
const units = require('./units.js')

function signed(qty, unit) {
  if (!qty) return '0 ' + units.unitName(unit)
  return (qty > 0 ? '+' : '') + units.formatQty(qty, unit)
}

function mergeRows(snapshotRows, materials) {
  const byId = {}
  ;(materials || []).forEach(m => { byId[m.id] = m })
  return (snapshotRows || []).map(r => {
    const m = byId[r.item_id] || { name: '食材#' + r.item_id, base_unit_code: '' }
    const counted = r.counted_qty === null || r.counted_qty === undefined ? null : Number(r.counted_qty)
    const diff = counted === null ? null : Math.round((counted - r.system_qty) * 1e6) / 1e6
    return { itemId: r.item_id, name: m.name, unit: m.base_unit_code, rowVersion: r.rowVersion,
      systemQty: r.system_qty, systemLabel: units.formatQty(r.system_qty, m.base_unit_code),
      counted, diff, diffText: diff === null || diff === 0 ? '' : signed(diff, m.base_unit_code),
      tone: diff === null || diff === 0 ? '' : diff < 0 ? 'danger' : 'ok' }
  })
}

function pendingCount(rows) {
  return rows.filter(r => r.counted === null).length
}

function gainItems(rows) {
  return rows.filter(r => r.diff > 0)
}

module.exports = { mergeRows, pendingCount, gainItems }

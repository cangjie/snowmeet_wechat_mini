// 看板：在库成本按一级分类汇总；本周损耗（周一起算，盘盈冲减）
const units = require('./units.js')
const expiry = require('./expiry.js')
const COLORS = ['#2563EB', '#B45309', '#15803D', '#7C3AED', '#B91C1C', '#0369A1', '#4B5563', '#0F766E']

function costBars(overviewRows, categories) {
  const byId = {}
  ;(categories || []).forEach(c => { byId[c.id] = c })
  const sums = {}
  ;(overviewRows || []).forEach(r => {
    const sub = byId[r.category_id]
    const top = sub ? (sub.level === 1 ? sub : byId[sub.parent_id]) : null
    const key = top ? top.id : 0
    sums[key] = (sums[key] || 0) + Number(r.total_amount || 0)
  })
  const total = Object.keys(sums).reduce((s, k) => s + sums[k], 0)
  return Object.keys(sums).filter(k => sums[k] > 0).map(k => ({ id: Number(k), name: byId[k] ? byId[k].name : '未分类', value: sums[k] }))
    .sort((a, b) => b.value - a.value)
    .map((b, i) => Object.assign(b, { valueLabel: units.money(b.value), pct: total ? b.value / total * 100 : 0,
      pctLabel: Math.round(total ? b.value / total * 100 : 0) + '%', color: COLORS[i % COLORS.length] }))
}

function weekRange(today) {
  const d = new Date(today + 'T00:00:00Z')
  const offset = (d.getUTCDay() + 6) % 7
  return { from: expiry.addDays(today, -offset), to: today }
}

const REASONS = { expiry: '过期销毁', near_expiry: '临期报损', damage: '损坏', other: '其他', stocktake_loss: '盘亏', stocktake_gain: '盘盈' }

function reasonLabel(code) {
  return REASONS[code] || code || ''
}

function ledgerRow(r) {
  const qty = Number(r.delta_qty) || 0
  return { id: r.movementId, name: r.item_name, reason: reasonLabel(r.reason_code) + ' · ' + r.batch_no,
    qty: (qty > 0 ? '+' : '') + units.formatQty(qty, r.base_unit_code), amount: units.money(Math.abs(Number(r.delta_amount) || 0)),
    date: String(r.business_date).slice(5, 10), gain: qty > 0 }
}

function lossAmount(rows) {
  const net = -(rows || []).reduce((s, r) => s + Number(r.delta_amount || 0), 0)
  return Math.round(net * 100) / 100
}

module.exports = { costBars, weekRange, lossAmount, reasonLabel, ledgerRow, REASONS }

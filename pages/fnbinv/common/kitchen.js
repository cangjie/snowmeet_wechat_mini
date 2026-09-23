// 厨房单展示：状态、菜品摘要、出餐扣料需求
const units = require('./units.js')

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

module.exports = { orderStatus, lineSummary, needRows, localTime, sortOrders }

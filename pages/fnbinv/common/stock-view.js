// 库存页视图模型：把 ListBatches 的批次按食材分组，配合分类与储存方式筛选
const units = require('./units.js')
const expiry = require('./expiry.js')

const FORM_LABEL = { bulk: '散装', sealed: '未开封', opened: '已开封', prepared: '半成品' }

function expireText(days) {
  if (days < 0) return '已过期 ' + (-days) + ' 天'
  if (days === 0) return '今天到期'
  return days + ' 天后到期'
}

function tone(days, warnDays) {
  if (days < 0) return 'danger'
  if (days <= (warnDays || 0)) return 'warn'
  return 'normal'
}

// 食材行状态标签，取最早到期批次（与原型一致）
function itemTag(days, warnDays) {
  if (days < 0) return { text: '已过期', tone: 'danger' }
  if (days === 0) return { text: '今天到期', tone: 'danger' }
  if (days <= (warnDays || 0)) return { text: '临期 ' + days + ' 天', tone: 'warn' }
  if (days > 60) return { text: '充足', tone: 'ok' }
  return { text: '剩 ' + days + ' 天', tone: 'muted' }
}

// GetExpirySummary 行 → 临期页 / 销毁清单的展示行
function alertRow(r, today) {
  const days = expiry.daysBetween(today, r.expire_date)
  return { batchId: r.batch_id, name: r.itemName, batchNo: r.batch_no,
    line: (FORM_LABEL[r.stock_form] || r.stock_form) + ' · ' + String(r.expire_date).slice(0, 10) + ' 到期',
    expireText: expireText(days), qtyLabel: units.formatQty(r.quantity, r.base_unit_code), quantity: r.quantity,
    overdue: days < 0 ? -days : 0, tone: days < 0 ? 'danger' : 'warn' }
}

function categoryTree(categories) {
  const valid = (categories || []).filter(c => c.valid)
  return valid.filter(c => c.level === 1).map(g => ({
    id: g.id, name: g.name,
    subs: valid.filter(c => c.level === 2 && c.parent_id === g.id)
  }))
}

function sealedLabel(stock) {
  const unit = stock.pack_unit_name || '件'
  return (stock.sealed_pack_count || 0) + ' ' + unit
}

function buildBatch(row, material, today) {
  const s = row.stock
  const days = expiry.daysBetween(today, row.batch.expire_date)
  const base = material ? material.base_unit_code : ''
  const qtyLabel = s.stock_form === 'sealed'
    ? sealedLabel(s) + ' × ' + units.formatQty(s.pack_size, base)
    : units.formatQty(s.quantity, base)
  return {
    batchId: s.batch_id, batchNo: row.batch.batch_no, form: s.stock_form, formLabel: FORM_LABEL[s.stock_form] || s.stock_form,
    storage: s.storage_type, storageLabel: expiry.storageLabel(s.storage_type), qtyLabel,
    expireDate: String(row.batch.expire_date).slice(0, 10), daysLeft: days, expireText: expireText(days),
    tone: tone(days, row.batch.warn_days), canOpen: s.stock_form === 'sealed' && (s.sealed_pack_count || 0) > 0 && days >= 0
  }
}

function matches(row, material, categoryOf, filter) {
  if (!filter) return true
  const sub = categoryOf[material.category_id]
  if (filter.l1 && (!sub || sub.parent_id !== filter.l1)) return false
  if (filter.l2 && material.category_id !== filter.l2) return false
  if (filter.storage && row.stock.storage_type !== filter.storage) return false
  const q = (filter.query || '').trim()
  if (q && material.name.indexOf(q) < 0 && String(row.batch.batch_no || '').indexOf(q) < 0) return false
  return true
}

function buildStockRows({ rows, materials, categories, today, filter }) {
  const materialOf = {}
  ;(materials || []).forEach(m => { materialOf[m.id] = m })
  const categoryOf = {}
  ;(categories || []).forEach(c => { categoryOf[c.id] = c })
  const live = (rows || []).filter(r => r.stock.quantity > 0 && !r.stock.is_destroyed && materialOf[r.stock.item_id])
  const groups = {}
  live.filter(r => matches(r, materialOf[r.stock.item_id], categoryOf, filter)).forEach(r => {
    const id = r.stock.item_id
    if (!groups[id]) groups[id] = []
    groups[id].push(r)
  })
  const order = {}
  ;(materials || []).forEach((m, i) => { order[m.id] = i })
  const items = Object.keys(groups).map(key => {
    const material = materialOf[key]
    const list = groups[key]
    const batches = list.map(r => buildBatch(r, material, today)).sort((a, b) => a.daysLeft - b.daysLeft || a.batchId - b.batchId)
    const usable = list.filter(r => r.stock.stock_form !== 'sealed').reduce((sum, r) => sum + r.stock.quantity, 0)
    const packs = list.filter(r => r.stock.stock_form === 'sealed')
    const packCount = packs.reduce((sum, r) => sum + (r.stock.sealed_pack_count || 0), 0)
    const sub = categoryOf[material.category_id]
    const packUnit = packs.length ? (packs[0].stock.pack_unit_name || '件') : ''
    const sealedBase = packs.reduce((sum, r) => sum + r.stock.quantity, 0)
    const worst = list.slice().sort((a, b) => String(a.batch.expire_date).localeCompare(String(b.batch.expire_date)))[0]
    const storages = batches.map(b => b.storageLabel).filter((v, i, a) => a.indexOf(v) === i)
    return {
      itemId: material.id, name: material.name, initial: material.name.slice(0, 1), subName: sub ? sub.name : '', baseUnit: material.base_unit_code,
      availableLabel: units.formatQty(usable, material.base_unit_code),
      sealedLabel: packs.length ? packCount + ' ' + packUnit : '',
      availLine: packs.length ? '另有未开封 ' + packCount + ' ' + packUnit + '（' + units.formatQty(sealedBase, material.base_unit_code) + '）' : '',
      metaLine: storages.join(' / ') + ' · ' + batches.length + ' 个批次' + (batches.some(b => b.form === 'opened') ? ' · 含已开封' : ''),
      tag: itemTag(batches[0].daysLeft, worst.batch.warn_days),
      hasSealed: packs.length > 0, earliestDays: batches[0].daysLeft, batches
    }
  }).sort((a, b) => order[a.itemId] - order[b.itemId])
  return {
    items,
    skuCount: items.length,
    batchCount: items.reduce((n, i) => n + i.batches.length, 0),
    openedCount: items.reduce((n, i) => n + i.batches.filter(b => b.form === 'opened').length, 0)
  }
}

module.exports = { buildStockRows, categoryTree, alertRow, expireText, tone, itemTag, FORM_LABEL }

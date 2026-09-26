// 用量预警：可用量（未开封 + 已开封 + 散装 + 自制，不含过期、已报损）降到预警线及以下时提醒。
// 预警线默认为最近一次入库或制作数量的 10%；每种食材可改比例，或直接填数量（服务端按基本单位存）
const units = require('./units.js')

const DEFAULT_RATIO = 0.1

function percent(ratio) {
  return units.trimNum(ratio * 100) + '%'
}

// 预警规则说明：数量优先，其次自定义比例，都没设为默认 10%
function ruleLabel(row) {
  if (row.fixedQuantity != null) return '低于 ' + units.formatQty(row.fixedQuantity, row.baseUnitCode) + ' 预警'
  if (row.ratio != null) return '最近一批的 ' + percent(row.ratio)
  return '最近一批的 ' + percent(DEFAULT_RATIO) + '（默认）'
}

function tag(row) {
  if (row.threshold == null) return { text: '无法计算', tone: 'muted' }
  if (row.availableQuantity <= 0) return { text: '已用完', tone: 'danger' }
  if (row.low) return { text: '库存低', tone: 'warn' }
  return { text: '正常', tone: 'ok' }
}

// ListLowStock 一行 → 展示行
function viewRow(row) {
  const unit = row.baseUnitCode
  return {
    itemId: row.itemId, name: row.itemName, low: row.low, tag: tag(row), ruleLabel: ruleLabel(row),
    availLabel: '可用 ' + units.formatQty(row.availableQuantity, unit),
    lineLabel: row.threshold != null ? '预警线 ' + units.formatQty(row.threshold, unit) : '没有入库记录，按比例算不出预警线，可直接填数量',
    lastLabel: row.lastBatchQuantity != null ? '最近一批 ' + units.formatQty(row.lastBatchQuantity, unit) : ''
  }
}

// 库存页「用量预警」卡片的一行说明
function summary(rows) {
  const low = (rows || []).filter(r => r.low)
  if (!low.length) return '库存都够用'
  const names = low.slice(0, 2).map(r => r.itemName).join('、')
  return names + (low.length > 2 ? ' 等 ' + low.length + ' 种' : '') + '快用完了'
}

// 设置弹窗：数量按食材常用单位填；比例按百分数填
function editorState(row, unitList) {
  const unitCode = row.defaultInputUnitCode || row.baseUnitCode
  return {
    itemId: row.itemId, name: row.itemName, lastLabel: viewRow(row).lastLabel,
    mode: row.fixedQuantity != null ? 'qty' : 'ratio',
    ratioText: units.trimNum((row.ratio != null ? row.ratio : DEFAULT_RATIO) * 100),
    qtyText: row.fixedQuantity != null ? String(units.fromBase(row.fixedQuantity, unitCode, unitList)) : '',
    unitCode, unitLabel: units.unitName(unitCode)
  }
}

// SaveLowStockAlert 的请求体；比例填 10% 即恢复默认（两项都不存）
function saveBody(edit, unitList) {
  if (edit.mode === 'qty') {
    const q = Number(edit.qtyText)
    if (edit.qtyText === '' || isNaN(q) || q < 0) return { error: '数量要填不小于 0 的数' }
    return { body: { itemId: edit.itemId, ratio: null, quantity: units.toBase(q, edit.unitCode, unitList) } }
  }
  const p = Number(edit.ratioText)
  if (edit.ratioText === '' || isNaN(p) || p <= 0 || p > 100) return { error: '比例要大于 0、不超过 100' }
  const ratio = Math.round(p * 100) / 10000
  if (!(ratio > 0)) return { error: '比例最少 0.01%' }
  return { body: { itemId: edit.itemId, ratio: ratio === DEFAULT_RATIO ? null : ratio, quantity: null } }
}

// 库存 tab 的角标 = 临期过期批次数 + 用量预警食材数；两处分别更新各自的数
function setBadge(patch) {
  const g = getApp().globalData
  if (patch.expiry != null) g.fnbExpiryCount = patch.expiry
  if (patch.low != null) g.fnbLowCount = patch.low
  g.fnbAlertCount = (g.fnbExpiryCount || 0) + (g.fnbLowCount || 0)
  return g.fnbAlertCount
}

module.exports = { DEFAULT_RATIO, ruleLabel, viewRow, summary, editorState, saveBody, setBadge }

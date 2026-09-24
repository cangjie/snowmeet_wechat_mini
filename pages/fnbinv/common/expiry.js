// 效期工具：与服务端 FnbInventoryRules 同口径（到期 = 生产日 + N 天/月，月末截断）
const STORAGE = [
  { code: 'chilled', label: '冷藏' },
  { code: 'frozen', label: '冷冻' },
  { code: 'ambient', label: '常温' }
]

// 开封后「保质期不变」：开封天数记为 100 年。服务端开封到期取 min(原到期日, 开封日 + 天数)，自然等于封装的原到期日
const OPEN_KEEP_DAYS = 36500

function storageLabel(code) {
  const hit = STORAGE.find(s => s.code === code)
  return hit ? hit.label : ''
}

// 高温档：6–9 月生产；其余为低温档
function isWarmMonth(month) {
  return month >= 6 && month <= 9
}

function parse(iso) {
  const p = String(iso).slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(p[0], p[1] - 1, p[2]))
}

function format(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(iso, days) {
  const d = parse(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return format(d)
}

function addMonths(iso, months) {
  const d = parse(iso)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return format(d)
}

function calcExpiry(productionIso, value, unit) {
  return unit === 'month' ? addMonths(productionIso, value) : addDays(productionIso, value)
}

function daysBetween(fromIso, toIso) {
  return Math.round((parse(toIso) - parse(fromIso)) / 86400000)
}

function today() {
  const d = new Date(Date.now() + 8 * 3600000)
  return d.toISOString().slice(0, 10)
}

// GetExpirySummary 的行按三档分组：已过期 / 开封后临期 / 未开封临期（含散装）
function groupAlerts(rows) {
  const byDate = (a, b) => String(a.expire_date).localeCompare(String(b.expire_date))
  const near = (rows || []).filter(r => r.status === '临期' || r.status === '今日')
  const expired = (rows || []).filter(r => r.status === '已过期').sort(byDate)
  const opened = near.filter(r => r.stock_form === 'opened').sort(byDate)
  const sealed = near.filter(r => r.stock_form !== 'opened').sort(byDate)
  return { expired, opened, sealed, total: expired.length + opened.length + sealed.length }
}

function activeRules(rules, storage) {
  return (rules || []).filter(r => r.valid && r.storage_type === storage)
}

// 把某储存方式的 12 条逐月规则归纳成「全年一致 / 高低温两档 / 自定义」
function summarizeRules(rules, storage) {
  const list = activeRules(rules, storage)
  if (list.length === 0) return null
  const unit = list[0].shelf_life_unit
  const byMonth = {}
  list.forEach(r => { byMonth[r.production_month] = r.shelf_life_value })
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  if (list.some(r => r.shelf_life_unit !== unit) || months.some(m => byMonth[m] === undefined)) return { mode: 'custom', unit }
  const warm = byMonth[6]
  const cold = byMonth[1]
  if (months.some(m => byMonth[m] !== (isWarmMonth(m) ? warm : cold))) return { mode: 'custom', unit }
  return warm === cold ? { mode: 'all', unit, value: warm } : { mode: 'band', unit, warm, cold }
}

// 生成 SaveShelfLifeRule 请求体（不含 shopId）；spec=null 表示停用该储存方式的全部规则。规则挂在食材上
function planRuleSaves(existing, itemId, storage, spec) {
  const current = activeRules(existing, storage).filter(r => r.item_id === itemId)
  if (!spec) {
    return current.map(r => ({ id: r.id, itemId, storageType: storage, productionMonth: r.production_month,
      shelfLifeValue: r.shelf_life_value, shelfLifeUnit: r.shelf_life_unit, remark: r.remark || null, valid: false }))
  }
  const plan = []
  for (let month = 1; month <= 12; month++) {
    const value = isWarmMonth(month) ? spec.warm : spec.cold
    const hit = current.find(r => r.production_month === month)
    if (hit && hit.shelf_life_value === value && hit.shelf_life_unit === spec.unit) continue
    plan.push({ id: hit ? hit.id : 0, itemId, storageType: storage, productionMonth: month,
      shelfLifeValue: value, shelfLifeUnit: spec.unit, remark: null, valid: true })
  }
  return plan
}

// 给某个食材的生产月份和储存方式挑出规则
function ruleFor(rules, itemId, storage, month) {
  return (rules || []).find(r => r.valid && r.item_id === itemId && r.storage_type === storage && r.production_month === month) || null
}

module.exports = { STORAGE, OPEN_KEEP_DAYS, storageLabel, isWarmMonth, addDays, addMonths, calcExpiry, daysBetween, today,
  groupAlerts, summarizeRules, planRuleSaves, ruleFor }

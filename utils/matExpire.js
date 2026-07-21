// 食材过期提醒（mat_expire）：状态派生 + 日期工具。
// 口径抄自网页版 wwwroot/fnb/mat_expire/mat.js，与后端 FnbMaterialController.DeriveStatus 一致。
function fmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
function addDays(dateStr, n) {
  var d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return fmtDate(d)
}
// to − from 的天数（同日=0，to 在过去为负）
function daysBetween(fromStr, toStr) {
  return Math.round((new Date(toStr + 'T00:00:00') - new Date(fromStr + 'T00:00:00')) / 86400000)
}
// batch.expire_date 形如 '2026-07-15T00:00:00'；today 必须用 GetBatches 返回的服务器日期字符串，
// 不能用设备本地日期（手机时区/时间漂移会导致状态误判——网页版当年为此专门做成服务器口径）
function deriveStatus(batch, today) {
  if (batch.dispose_status) return '已处理'
  var e = (batch.expire_date || '').slice(0, 10)
  if (!e) return '正常'
  if (e < today) return '已过期'
  if (e === today) return '今日'
  if (e <= addDays(today, batch.warn_days || 0)) return '临期'
  return '正常'
}

module.exports = {
  fmtDate: fmtDate,
  addDays: addDays,
  daysBetween: daysBetween,
  deriveStatus: deriveStatus,
}

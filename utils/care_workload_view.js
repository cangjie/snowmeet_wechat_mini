// 日养护工作列表：把后端 CareWorkload/GetDailyWorkloadByStaff 的结果整理成页面要显示的样子。
// 纯函数、不依赖 wx / app，方便单测。统计规则见后端 Helpers/CareWorkloadRules.cs。

// 工序键（后端接口里的英文键）→ 中文名，也是页面上展示的顺序
const PROCESSES = [
  { key: 'edge', label: '修刃' },
  { key: 'wax', label: '打蜡' },
  { key: 'scrape', label: '刮蜡' },
  { key: 'patchBottom', label: '补板底' },
  { key: 'repair', label: '维修' }
]

// 要按人拆开显示的工序：需求只要「每个人的修刃数量」；后端已经把每个人的所有工序都带出来了，以后要加只改这里
const SPLIT_BY_STAFF = ['edge']

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function num(v) {
  return typeof v === 'number' && isFinite(v) ? v : 0
}

function parseDay(dateStr) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(dateStr || ''))
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

function formatDay(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

// 「2026-11-10」→「周二」；日期不对返回空串
function weekdayOf(dateStr) {
  const d = parseDay(dateStr)
  return d ? WEEKDAYS[d.getDay()] : ''
}

// 前一天 / 后一天；日期不对原样返回
function shiftDate(dateStr, delta) {
  const d = parseDay(dateStr)
  if (!d) return dateStr
  d.setDate(d.getDate() + delta)
  return formatDay(d)
}

// 后端给的时间是「2026-11-10T22:00:00」或「2026-11-10 22:00:00」
function timePart(value) {
  const m = /[T ](\d{2}:\d{2})/.exec(String(value || ''))
  return m ? m[1] : ''
}

function monthDayTime(value) {
  const m = /^\d{4}-(\d{2})-(\d{2})[T ](\d{2}:\d{2})/.exec(String(value || ''))
  return m ? m[1] + '-' + m[2] + ' ' + m[3] : ''
}

// 每个人在某个工序上完成的数量，多的排前面，同样多的按名字；没有完成过的不列；任务上没记录完成人的显示「未记录」
function staffCounts(staff, key) {
  return (Array.isArray(staff) ? staff : [])
    .map(p => ({
      name: (p && p.staffId && String(p.name || '').trim()) || (p && p.staffId ? '员工' + p.staffId : '未记录'),
      count: num(p && p.process && p.process[key]),
      id: p ? num(p.staffId) : 0
    }))
    .filter(p => p.count > 0)
    .sort((a, b) => (b.count - a.count) || (a.id === 0 ? 1 : 0) - (b.id === 0 ? 1 : 0) || a.name.localeCompare(b.name, 'zh'))
    .map(p => ({ name: p.name, count: p.count }))
}

function buildWorkloadView(stat) {
  const s = stat || {}
  const initial = num(s.initialPending)
  const added = num(s.added)
  const completed = num(s.completed)
  const cancelled = num(s.completedCancelled)
  const pending = num(s.pending)
  const process = s.process || {}
  const processes = PROCESSES.map(p => ({
    key: p.key,
    label: p.label,
    count: num(process[p.key]),
    staff: SPLIT_BY_STAFF.indexOf(p.key) >= 0 ? staffCounts(s.staff, p.key) : []
  }))
  const isSnapshot = s.source === 'snapshot'
  return {
    date: s.date || '',
    weekday: weekdayOf(s.date),
    shopLabel: s.shop ? String(s.shop) : '全部门店',
    asOfLabel: timePart(s.asOf) ? '统计至 ' + timePart(s.asOf) : '',
    isSnapshot,
    sourceLabel: isSnapshot ? '快照' : '实时',
    updatedLabel: monthDayTime(s.computedAt),
    flow: {
      initialPending: initial,
      added,
      completed,
      canceled: cancelled,
      hasCanceled: cancelled > 0,
      pending,
      equation: initial + ' + ' + added + ' − ' + completed + ' = ' + pending
    },
    activity: { worked: num(s.worked), idlePending: num(s.idlePending) },
    processes,
    empty: initial + added + completed + pending + num(s.worked) === 0 && processes.every(p => p.count === 0)
  }
}

module.exports = { PROCESSES, buildWorkloadView, shiftDate, weekdayOf, staffCounts }

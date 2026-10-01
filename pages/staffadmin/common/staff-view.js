// 员工账号管理的纯函数：账号状态分类、工作手机状态。页面只认这里的结论，数据来自 api.js
// 一个员工账号同一时间只关联一套手机号 + 微信（social_account_for_job 的一行）；
// 这套手机是工作手机（is_private=0）还是私人手机（is_private=1）是手机自己的属性，账号本身不分类型

const TITLE_OPTIONS = [
  { level: 50, label: '万龙对账' },
  { level: 100, label: '店员' },
  { level: 200, label: '店长' },
  { level: 300, label: '系统管理员' }
]
const TITLE_LABELS = { 0: '未开通', 50: '万龙对账', 100: '店员', 200: '店长', 300: '系统管理员', 1000: '超级管理员' }

const STATUS = {
  active: { text: '在职', tone: 'ok' },
  pending: { text: '待开通', tone: 'blue' },
  attention: { text: '需处理', tone: 'danger' },
  left: { text: '已离职', tone: 'muted' }
}
const FILTERS = [
  { key: 'active', label: '在职' },
  { key: 'pending', label: '待开通' },
  { key: 'attention', label: '需处理' },
  { key: 'left', label: '已离职' }
]

function pad(n) { return n < 10 ? '0' + n : '' + n }
function today() {
  const d = new Date()
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}
function dateLabel(iso) { return iso ? String(iso).slice(0, 10) : '' }

function titleLabel(level) {
  return TITLE_LABELS[level] || ('职级 ' + level)
}

function tail(cell) {
  const s = String(cell || '')
  return s ? '···' + s.slice(-4) : ''
}

function phoneType(isPrivate) {
  return isPrivate ? { text: '私人手机', tone: 'muted' } : { text: '工作手机', tone: 'blue' }
}

// 雪季：6 月起算下一季，与后端 StaffController.CreateStaff 一致
function seasonMemo(iso) {
  const d = String(iso || today())
  const y = Number(d.slice(0, 4))
  const m = Number(d.slice(5, 7))
  const start = m >= 6 ? y : y - 1
  return (start - 2000) + '-' + (start + 1 - 2000) + '雪季'
}

// 账号状态：待开通 = 自助登记后还没开通（未启用、职级 0、已绑手机）；需处理 = 能不能登录和账号状态对不上
function classify(s) {
  const b = s.binding
  const issues = []
  let status
  if (!s.valid) {
    if (b && s.title_level === 0) status = 'pending'
    else if (b) {
      status = 'attention'
      issues.push({ code: 'departed_holding', tone: 'danger', text: '已离职但仍占用' + (b.is_private ? '私人手机 ' : '工作手机 ') + tail(b.cell) })
    } else status = 'left'
  } else if (!b) {
    if (s.pending_bind) {
      status = 'active'
      issues.push({ code: 'await_bind', tone: 'warn', text: '等员工扫码绑定微信' })
    } else {
      status = 'attention'
      issues.push({ code: 'no_phone', tone: 'danger', text: '在职但没有绑定手机，无法登录' })
    }
  } else if (!b.has_wechat) {
    status = 'attention'
    issues.push({ code: 'no_wechat', tone: 'danger', text: '手机 ' + tail(b.cell) + ' 还没绑定微信，无法登录' })
  } else {
    status = 'active'
  }
  return { status, statusTag: STATUS[status], issues }
}

function viewStaff(s) {
  const c = classify(s)
  const b = s.binding
  return Object.assign({}, s, c, {
    titleLabel: titleLabel(s.title_level),
    typeTag: b ? phoneType(b.is_private) : null,
    phoneLabel: b ? tail(b.cell) : (s.pending_bind ? '待扫码' : '无手机'),
    wechatTag: !b ? null : (b.has_wechat ? { text: '微信已绑定', tone: 'ok' } : { text: '微信未绑定', tone: 'warn' }),
    initial: String(s.name || '').trim().slice(0, 1) || '?'
  })
}

function summarize(views) {
  const out = { active: 0, pending: 0, attention: 0, left: 0 }
  views.forEach(v => { out[v.status]++ })
  return out
}

function matchKeyword(v, keyword) {
  const k = String(keyword || '').trim()
  if (!k) return true
  if (v.name.indexOf(k) >= 0) return true
  return !!(v.binding && String(v.binding.cell).indexOf(k) >= 0)
}

// 有关键字时忽略状态筛选，在全部账号里搜
function filterStaff(views, status, keyword) {
  const k = String(keyword || '').trim()
  return views.filter(v => (k ? true : v.status === status) && matchKeyword(v, k))
}

// 离职会发生什么，给确认弹层逐条列出
function offboardEffects(s) {
  const lines = []
  const b = s.binding
  if (b && !b.is_private) lines.push('工作手机 ' + tail(b.cell) + ' 退回空闲，可以分给别人')
  if (b && b.is_private) lines.push('私人手机 ' + tail(b.cell) + ' 的绑定结束，这个微信不能再进后台')
  if (!b && s.pending_bind) lines.push('未使用的绑定码作废')
  lines.push('账号停用，历史订单里的经办人记录保留')
  return lines
}

// 工作手机：在用 / 空闲 / 微信未绑定 / 异常（离职员工仍占用）
const PHONE_STATUS = {
  in_use: { text: '在用', tone: 'ok' },
  idle: { text: '空闲', tone: 'blue' },
  no_wechat: { text: '微信未绑定', tone: 'warn' },
  orphan: { text: '离职员工仍占用', tone: 'danger' }
}
function phoneStatus(p) {
  if (p.holder) return p.holder.valid ? 'in_use' : 'orphan'
  return p.has_wechat ? 'idle' : 'no_wechat'
}
function viewPhone(p) {
  const status = phoneStatus(p)
  return Object.assign({}, p, {
    status, statusTag: PHONE_STATUS[status], tail: tail(p.cell),
    holderLabel: p.holder ? p.holder.name : '',
    assignable: status === 'idle'
  })
}
function summarizePhones(views) {
  const out = { total: views.length, in_use: 0, idle: 0, no_wechat: 0, orphan: 0 }
  views.forEach(v => { out[v.status]++ })
  return out
}
function assignablePhones(phones) {
  return phones.map(viewPhone).filter(p => p.assignable)
}

function historyRows(history) {
  return (history || []).map(h => Object.assign({}, h, {
    tail: tail(h.cell),
    typeTag: phoneType(h.is_private),
    range: dateLabel(h.start_date) + ' 至 ' + (h.end_date ? dateLabel(h.end_date) : '今'),
    current: !h.end_date
  }))
}

module.exports = {
  TITLE_OPTIONS, FILTERS, STATUS, PHONE_STATUS,
  today, dateLabel, titleLabel, tail, phoneType, seasonMemo,
  classify, viewStaff, summarize, filterStaff, offboardEffects,
  phoneStatus, viewPhone, summarizePhones, assignablePhones, historyRows
}

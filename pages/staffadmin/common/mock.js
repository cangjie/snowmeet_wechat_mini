// 原型用的演示数据：结构照搬 staff / social_account_for_job / staff_social_account 三张表，外加一次性绑定码
// 全部是虚构的姓名和手机号。页面上的操作只改内存，重启小程序后恢复初始状态
const view = require('./staff-view.js')

const SHOPS = [{ id: 4, name: '万龙店' }, { id: 10, name: '崇礼店' }, { id: 12, name: '多呆一会儿吧' }]
const CODE_MINUTES = 30

function stamp(ms) {
  const d = new Date(ms)
  const p = n => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

function seed() {
  const st = (id, name, gender, title_level, valid, base_shop_id) => ({ id, name, gender, title_level, valid, base_shop_id, create_date: '2025-10-01' })
  const acc = (id, cell, is_private, openid) => ({ id, cell, is_private, wechat_mini_openid: openid, member_id: 0 })
  const ln = (id, staff_id, social_account_id, start_date, end_date) =>
    ({ id, staff_id, social_account_id, start_date, end_date, valid: 1, season_memo: view.seasonMemo(start_date) })
  return {
    seq: 100,
    staff: [
      st(1, '李明-工作号', '男', 100, 1, 4),
      st(2, '周婷-工作号', '女', 200, 1, 10),
      st(3, '李明（个人）', '男', 100, 1, 4),
      st(4, '孙悦', '女', 300, 1, null),
      st(5, '吴芳', '女', 50, 1, 4),
      st(6, '郑浩', '男', 0, 0, null),
      st(7, '王强-工作号', '男', 100, 1, 4),
      st(8, '刘洋', '男', 100, 1, 10),
      st(9, '赵磊-工作号', '男', 100, 0, 4),
      st(10, '钱进', '男', 100, 0, 10),
      st(11, '陈晨（个人）', '女', 100, 0, 12)
    ],
    accounts: [
      acc(1, '13900007440', 0, 'o-demo-01'),
      acc(2, '13900001129', 0, 'o-demo-02'),
      acc(3, '13900006973', 0, 'o-demo-03'),
      acc(4, '13900001480', 0, 'o-demo-04'),
      acc(5, '13900008217', 0, ''),
      acc(6, '13900006240', 0, 'o-demo-06'),
      acc(7, '13811112222', 1, 'o-demo-07'),
      acc(8, '13822223333', 1, 'o-demo-08'),
      acc(9, '13833334444', 1, 'o-demo-09'),
      acc(10, '13844445555', 1, 'o-demo-10'),
      acc(11, '13855556666', 1, 'o-demo-11')
    ],
    links: [
      ln(1, 1, 1, '2025-11-01', null),
      ln(2, 2, 6, '2024-11-01', '2025-10-31'),
      ln(3, 2, 2, '2025-11-01', null),
      ln(4, 3, 7, '2024-12-01', null),
      ln(5, 4, 8, '2023-10-01', null),
      ln(6, 5, 9, '2025-11-15', null),
      ln(7, 6, 10, '2026-09-29', null),
      ln(8, 7, 3, '2024-11-01', '2025-05-01'),
      ln(9, 9, 3, '2025-11-01', '2026-04-30'),
      ln(10, 10, 4, '2025-12-15', null),
      ln(11, 11, 11, '2024-12-01', '2026-04-15')
    ],
    codes: [
      { token: 'demo-liuyang', purpose: 'private', staff_id: 8, account_id: null, used: false, cancelled: false,
        expire_ms: Date.now() + CODE_MINUTES * 60000 }
    ]
  }
}

let db = seed()
function reset() { db = seed() }

function fail(message) { throw new Error(message) }
function nextId() { return ++db.seq }
function findStaff(id) { return db.staff.find(s => s.id === Number(id)) || fail('找不到这个账号') }
function findAccount(id) { return db.accounts.find(a => a.id === Number(id)) || fail('找不到这部手机') }
function shopName(id) { const s = SHOPS.find(x => x.id === id); return s ? s.name : '' }
function activeLinkOfStaff(id) { return db.links.find(l => l.staff_id === id && l.valid && !l.end_date) }
function activeLinkOfAccount(id) { return db.links.find(l => l.social_account_id === id && l.valid && !l.end_date) }
function openCode(staffId) {
  return db.codes.find(c => c.staff_id === staffId && c.purpose === 'private' && !c.used && !c.cancelled && c.expire_ms > Date.now())
}
function cancelCodes(staffId) { db.codes.forEach(c => { if (c.staff_id === staffId && !c.used) c.cancelled = true }) }
function addLink(staffId, accountId, date) {
  const start = date || view.today()
  db.links.push({ id: nextId(), staff_id: staffId, social_account_id: accountId, start_date: start, end_date: null, valid: 1, season_memo: view.seasonMemo(start) })
}
function endLink(link, date) { if (link) link.end_date = date || view.today() }
function newCode(purpose, staffId, accountId) {
  const code = { token: 'demo-' + nextId(), purpose, staff_id: staffId || null, account_id: accountId || null, used: false, cancelled: false,
    expire_ms: Date.now() + CODE_MINUTES * 60000 }
  db.codes.push(code)
  return code.token
}
// 原型拿不到解密后的手机号，按序号编一个
function demoCell() { return '1370000' + String(nextId()).padStart(4, '0') }

function staffDto(s) {
  const link = activeLinkOfStaff(s.id)
  const a = link ? findAccount(link.social_account_id) : null
  const code = openCode(s.id)
  return {
    id: s.id, name: s.name, gender: s.gender, title_level: s.title_level, valid: !!s.valid,
    base_shop_id: s.base_shop_id, shop_name: shopName(s.base_shop_id), create_date: s.create_date,
    binding: a ? { link_id: link.id, account_id: a.id, cell: a.cell, is_private: !!a.is_private, has_wechat: !!a.wechat_mini_openid, start_date: link.start_date } : null,
    pending_bind: code ? { token: code.token, expire_at: stamp(code.expire_ms) } : null
  }
}

function phoneDto(a) {
  const link = activeLinkOfAccount(a.id)
  const holder = link ? findStaff(link.staff_id) : null
  return {
    id: a.id, cell: a.cell, has_wechat: !!a.wechat_mini_openid,
    holder: holder ? { staff_id: holder.id, name: holder.name, valid: !!holder.valid, title_level: holder.title_level } : null,
    history: db.links.filter(l => l.social_account_id === a.id)
      .sort((x, y) => (y.start_date > x.start_date ? 1 : -1))
      .map(l => ({ staff_id: l.staff_id, name: findStaff(l.staff_id).name, start_date: l.start_date, end_date: l.end_date }))
  }
}

function listShops() { return SHOPS }
function listStaff() { return db.staff.map(staffDto) }

function getStaff(id) {
  const s = staffDto(findStaff(id))
  const history = db.links.filter(l => l.staff_id === s.id)
    .sort((x, y) => (y.start_date > x.start_date ? 1 : -1))
    .map(l => { const a = findAccount(l.social_account_id); return { id: l.id, cell: a.cell, is_private: !!a.is_private, start_date: l.start_date, end_date: l.end_date, season_memo: l.season_memo } })
  return { staff: s, history, related: view.relatedAccounts(s, listStaff()) }
}

function listPhones() { return db.accounts.filter(a => !a.is_private).map(phoneDto) }

function checkBasic(p) {
  if (!String(p.name || '').trim()) fail('请填写姓名')
  if (p.gender !== '男' && p.gender !== '女') fail('请选择性别')
  if (!view.TITLE_OPTIONS.some(o => o.level === Number(p.title_level))) fail('请选择职级')
}

function onboard(p) {
  checkBasic(p)
  if (p.type !== 'job' && p.type !== 'private') fail('请选择工作号或个人号')
  if (p.type === 'job') {
    const a = findAccount(p.account_id)
    if (a.is_private || view.phoneStatus(phoneDto(a)) !== 'idle') fail('这部工作手机不能分配，请重新选择')
  }
  const s = { id: nextId(), name: String(p.name).trim(), gender: p.gender, title_level: Number(p.title_level), valid: 1,
    base_shop_id: p.base_shop_id || null, create_date: view.today() }
  db.staff.push(s)
  if (p.type === 'job') {
    addLink(s.id, Number(p.account_id), p.start_date)
    return { staff_id: s.id }
  }
  return { staff_id: s.id, token: newCode('private', s.id) }
}

function updateStaff(p) {
  const s = findStaff(p.id)
  checkBasic(p)
  Object.assign(s, { name: String(p.name).trim(), gender: p.gender, title_level: Number(p.title_level), base_shop_id: p.base_shop_id || null })
  return { staff_id: s.id }
}

function changePhone(p) {
  const s = findStaff(p.staff_id)
  const link = activeLinkOfStaff(s.id)
  if (!s.valid) fail('账号已停用')
  if (link && findAccount(link.social_account_id).is_private) fail('个人号只能重新绑定微信，不能换成工作手机')
  const a = findAccount(p.account_id)
  if (a.is_private || view.phoneStatus(phoneDto(a)) !== 'idle') fail('这部工作手机不能分配，请重新选择')
  endLink(link)
  cancelCodes(s.id)
  addLink(s.id, a.id)
  return { staff_id: s.id }
}

function rebind(staffId) {
  const s = findStaff(staffId)
  const link = activeLinkOfStaff(s.id)
  if (!s.valid) fail('账号已停用')
  if (link && !findAccount(link.social_account_id).is_private) fail('工作号请更换工作手机')
  cancelCodes(s.id)
  return { token: newCode('private', s.id) }
}

function offboard(p) {
  const ids = (p.staff_ids || []).map(Number)
  if (!ids.length) fail('请选择要离职的账号')
  ids.forEach(id => {
    const s = findStaff(id)
    endLink(activeLinkOfStaff(s.id), p.date)
    cancelCodes(s.id)
    s.valid = 0
  })
  return { staff_ids: ids }
}

function approve(p) {
  const s = findStaff(p.staff_id)
  if (s.valid || s.title_level !== 0 || !activeLinkOfStaff(s.id)) fail('这个账号不是待开通状态')
  if (!view.TITLE_OPTIONS.some(o => o.level === Number(p.title_level))) fail('请选择职级')
  Object.assign(s, { valid: 1, title_level: Number(p.title_level), base_shop_id: p.base_shop_id || null })
  return { staff_id: s.id }
}

function reject(staffId) {
  const s = findStaff(staffId)
  if (s.valid || s.title_level !== 0) fail('这个账号不是待开通状态')
  endLink(activeLinkOfStaff(s.id))
  return { staff_id: s.id }
}

function reclaimPhone(accountId) {
  const a = findAccount(accountId)
  if (view.phoneStatus(phoneDto(a)) !== 'orphan') fail('这部手机不需要收回')
  endLink(activeLinkOfAccount(a.id))
  return { account_id: a.id }
}

function addJobPhone(cell) {
  const c = String(cell || '').trim()
  if (!/^1\d{10}$/.test(c)) fail('请填写 11 位手机号')
  if (db.accounts.some(a => !a.is_private && a.cell === c)) fail('这部工作手机已经登记过')
  const a = { id: nextId(), cell: c, is_private: 0, wechat_mini_openid: '', member_id: 0 }
  db.accounts.push(a)
  return { account_id: a.id, token: newCode('job_phone', null, a.id) }
}

function bindJobPhone(accountId) {
  const a = findAccount(accountId)
  if (a.is_private) fail('只有工作手机需要单独绑定微信')
  return { token: newCode('job_phone', null, a.id) }
}

function codeStatus(c) {
  if (c.used) return 'used'
  if (c.cancelled) return 'cancelled'
  return c.expire_ms > Date.now() ? 'ok' : 'expired'
}

function getCode(token) {
  if (token === 'selfreg') return { token, purpose: 'selfreg', status: 'ok', expire_at: '' }
  const c = db.codes.find(x => x.token === token) || fail('绑定码不存在')
  const out = { token, purpose: c.purpose, status: codeStatus(c), expire_at: stamp(c.expire_ms) }
  if (c.staff_id) {
    const s = findStaff(c.staff_id)
    out.staff = { id: s.id, name: s.name, title_label: view.titleLabel(s.title_level), shop_name: shopName(s.base_shop_id) }
  }
  if (c.account_id) out.phone = { id: c.account_id, tail: view.tail(findAccount(c.account_id).cell) }
  return out
}

// 扫码的那部手机确认绑定：个人号新建一套私人手机并替换旧的；工作手机只补上微信
function confirmBind(p) {
  const c = db.codes.find(x => x.token === p.token) || fail('绑定码不存在')
  const status = codeStatus(c)
  if (status !== 'ok') fail(status === 'used' ? '这个码已经用过了' : '这个码已失效，请让管理员重新生成')
  const openid = 'o-demo-' + nextId()
  if (c.purpose === 'job_phone') {
    findAccount(c.account_id).wechat_mini_openid = openid
  } else {
    const s = findStaff(c.staff_id)
    if (!s.valid) fail('账号已停用')
    const a = { id: nextId(), cell: p.cell || demoCell(), is_private: 1, wechat_mini_openid: openid, member_id: 0 }
    db.accounts.push(a)
    endLink(activeLinkOfStaff(s.id))
    addLink(s.id, a.id)
  }
  c.used = true
  return { staff_id: c.staff_id, account_id: c.account_id }
}

function selfRegister(p) {
  if (!String(p.name || '').trim()) fail('请填写姓名')
  if (p.gender !== '男' && p.gender !== '女') fail('请选择性别')
  const s = { id: nextId(), name: String(p.name).trim(), gender: p.gender, title_level: 0, valid: 0, base_shop_id: null, create_date: view.today() }
  const a = { id: nextId(), cell: p.cell || demoCell(), is_private: 1, wechat_mini_openid: 'o-demo-' + nextId(), member_id: 0 }
  db.staff.push(s)
  db.accounts.push(a)
  addLink(s.id, a.id)
  return { staff_id: s.id }
}

module.exports = {
  reset, listShops, listStaff, getStaff, listPhones,
  onboard, updateStaff, changePhone, rebind, offboard, approve, reject,
  reclaimPhone, addJobPhone, bindJobPhone, getCode, confirmBind, selfRegister
}

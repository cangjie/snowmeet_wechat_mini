// 员工账号管理页面测试用的假后端：按 SnowmeetApi StaffAdminController 的接口和返回结构在内存里实现（规则与
// Services/StaffAccounts/StaffAccountService.cs 一致），全部是虚构的姓名和手机号。不随小程序发布
const view = require('../pages/staffadmin/common/staff-view.js')

const SHOPS = [{ id: 4, name: '万龙店' }, { id: 10, name: '崇礼店' }, { id: 12, name: '多呆一会儿吧' }]
const CODE_MINUTES = 30

function stamp(ms) {
  const d = new Date(ms)
  const p = n => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

function seed() {
  const st = (id, name, gender, title_level, valid, base_shop_id) => ({ id, name, gender, title_level, valid, base_shop_id, create_date: '2025-10-01' })
  const acc = (id, cell, is_private, openid) => ({ id, cell, is_private, wechat_mini_openid: openid })
  const ln = (id, staff_id, social_account_id, start_date, end_date, valid) =>
    ({ id, staff_id, social_account_id, start_date, end_date, valid: valid === undefined ? (end_date ? 0 : 1) : valid, season_memo: view.seasonMemo(start_date) })
  const later = Date.now() + CODE_MINUTES * 60000
  return {
    seq: 100,
    session: { openid: 'o-demo-new', admin: true },
    members: ['o-demo-01', 'o-demo-02', 'o-demo-03', 'o-demo-04', 'o-demo-06', 'o-demo-07', 'o-demo-08', 'o-demo-10', 'o-demo-11', 'o-demo-12', 'o-demo-new'],
    staff: [
      st(1, '李明', '男', 100, 1, 4), st(2, '周婷', '女', 200, 1, 10), st(3, '张伟', '男', 100, 1, 4),
      st(4, '孙悦', '女', 300, 1, null), st(5, '吴芳', '女', 50, 1, 4), st(6, '郑浩', '男', 0, 0, null),
      st(7, '王强', '男', 100, 1, 4), st(8, '刘洋', '男', 100, 1, 10), st(9, '赵磊', '男', 100, 0, 4),
      st(10, '钱进', '男', 100, 0, 10), st(11, '陈晨', '女', 100, 0, 12), st(12, '老板', '男', 1000, 1, null)
    ],
    accounts: [
      acc(1, '13900007440', 0, 'o-demo-01'), acc(2, '13900001129', 0, 'o-demo-02'), acc(3, '13900006973', 0, 'o-demo-03'),
      acc(4, '13900001480', 0, 'o-demo-04'), acc(5, '13900008217', 0, ''), acc(6, '13900006240', 0, 'o-demo-06'),
      acc(7, '13811112222', 1, 'o-demo-07'), acc(8, '13822223333', 1, 'o-demo-08'), acc(9, '13833334444', 1, 'o-demo-09'),
      acc(10, '13844445555', 1, 'o-demo-10'), acc(11, '13855556666', 1, 'o-demo-11'), acc(12, '13866667777', 1, 'o-demo-12')
    ],
    links: [
      ln(1, 1, 1, '2025-11-01', null), ln(2, 2, 6, '2024-11-01', '2025-10-31'), ln(3, 2, 2, '2025-11-01', null),
      ln(4, 3, 7, '2024-12-01', null), ln(5, 4, 8, '2023-10-01', null), ln(6, 5, 9, '2025-11-15', null),
      ln(7, 6, 10, '2026-09-29', null, 0), ln(8, 7, 3, '2024-11-01', '2025-05-01'), ln(9, 9, 3, '2025-11-01', '2026-04-30'),
      ln(10, 10, 4, '2025-12-15', null), ln(11, 11, 11, '2024-12-01', '2026-04-15'), ln(12, 12, 12, '2023-10-01', null)
    ],
    codes: [
      { token: 'demo-liuyang', purpose: 'private', staff_id: 8, account_id: null, used: false, cancelled: false, expire_ms: later },
      { token: 'demo-selfreg-6', purpose: 'selfreg', staff_id: 6, account_id: 10, used: false, cancelled: false, expire_ms: later }
    ]
  }
}

let db = seed()
function reset() { db = seed() }
// 当前扫码 / 操作的这部手机：openid 和是否系统管理员
function setSession(patch) { Object.assign(db.session, patch) }

function fail(message, code) { throw { code: code || 1, message } }
function nextId() { return ++db.seq }
function today() { return view.today() }
function findStaff(id) { return db.staff.find(s => s.id === Number(id)) || fail('找不到这个账号') }
function findAccount(id) { return db.accounts.find(a => a.id === Number(id)) || fail('找不到这部手机') }
function shopName(id) { const s = SHOPS.find(x => x.id === id); return s ? s.name : '' }
function activeLinkOfStaff(id) { return db.links.find(l => l.staff_id === id && l.valid && !l.end_date) }
function activeLinkOfAccount(id) { return db.links.find(l => l.social_account_id === id && l.valid && !l.end_date) }
function openCode(purpose, staffId) {
  return db.codes.find(c => c.purpose === purpose && c.staff_id === staffId && !c.used && !c.cancelled && c.expire_ms > Date.now())
}
function cancelCodes(purpose, staffId, accountId) {
  db.codes.forEach(c => { if (c.purpose === purpose && !c.used && (staffId == null || c.staff_id === staffId) && (accountId == null || c.account_id === accountId)) c.cancelled = true })
}
function addLink(staffId, accountId, valid) {
  db.links.push({ id: nextId(), staff_id: staffId, social_account_id: accountId, start_date: today(), end_date: null, valid: valid === undefined ? 1 : valid, season_memo: view.seasonMemo(today()) })
}
function endLink(link, date) { if (link) { link.end_date = date || today(); link.valid = 0 } }
function newCode(purpose, staffId, accountId) {
  const code = { token: 'demo-' + nextId(), purpose, staff_id: staffId || null, account_id: accountId || null, used: false, cancelled: false,
    expire_ms: Date.now() + CODE_MINUTES * 60000 }
  db.codes.push(code)
  return code.token
}
function requireMember(openid) { if (db.members.indexOf(openid) < 0) fail('这个微信还不是会员，请先在小程序里注册会员后再扫码', 5) }
function phoneStatus(a) {
  const link = activeLinkOfAccount(a.id)
  if (link) return findStaff(link.staff_id).valid ? 'in_use' : 'orphan'
  return a.wechat_mini_openid ? 'idle' : 'no_wechat'
}

function staffDto(s) {
  const pendingReg = !s.valid && !!openCode('selfreg', s.id)
  let link = activeLinkOfStaff(s.id)
  if (!link && pendingReg) link = db.links.find(l => l.staff_id === s.id && !l.valid && !l.end_date)
  const a = link ? findAccount(link.social_account_id) : null
  const code = openCode('private', s.id)
  return {
    id: s.id, name: s.name, gender: s.gender, title_level: s.title_level, valid: !!s.valid,
    base_shop_id: s.base_shop_id, shop_name: shopName(s.base_shop_id), create_date: s.create_date,
    binding: a ? { link_id: link.id, account_id: a.id, cell: a.cell, is_private: !!a.is_private, has_wechat: !!a.wechat_mini_openid,
      start_date: link.start_date, login_ok: db.members.indexOf(a.wechat_mini_openid) >= 0 } : null,
    pending_bind: code ? { token: code.token, expire_at: stamp(code.expire_ms) } : null,
    pending_reg: pendingReg
  }
}

function phoneDto(a) {
  const link = activeLinkOfAccount(a.id)
  const holder = link ? findStaff(link.staff_id) : null
  return {
    id: a.id, cell: a.cell, has_wechat: !!a.wechat_mini_openid,
    holder: holder ? { staff_id: holder.id, name: holder.name, valid: !!holder.valid, title_level: holder.title_level } : null,
    history: db.links.filter(l => l.social_account_id === a.id && (l.valid || l.end_date))
      .sort((x, y) => (y.start_date > x.start_date ? 1 : -1))
      .map(l => ({ staff_id: l.staff_id, name: findStaff(l.staff_id).name, start_date: l.start_date, end_date: l.end_date }))
  }
}

function checkBasic(p) {
  if (!String(p.name || '').trim()) fail('请填写姓名')
  if (p.gender !== '男' && p.gender !== '女') fail('请选择性别')
  if (!view.TITLE_OPTIONS.some(o => o.level === Number(p.title_level))) fail('请选择职级')
}
function assignable(id) {
  const a = findAccount(id)
  if (a.is_private || phoneStatus(a) !== 'idle') fail('这部工作手机不能分配，请重新选择')
  return a
}

const ADMIN_ACTIONS = {
  ListShops: () => SHOPS,
  ListStaff: () => db.staff.map(staffDto),
  GetStaff: q => {
    const s = staffDto(findStaff(q.id))
    const history = db.links.filter(l => l.staff_id === s.id && (l.valid || l.end_date))
      .sort((x, y) => (y.start_date > x.start_date ? 1 : -1))
      .map(l => { const a = findAccount(l.social_account_id); return { id: l.id, cell: a.cell, is_private: !!a.is_private, start_date: l.start_date, end_date: l.end_date, season_memo: l.season_memo } })
    return { staff: s, history }
  },
  ListPhones: () => db.accounts.filter(a => !a.is_private).map(phoneDto),
  Onboard: (q, p) => {
    checkBasic(p)
    if (p.type !== 'job' && p.type !== 'private') fail('请选择分配工作手机还是用私人手机')
    const phone = p.type === 'job' ? assignable(p.account_id) : null
    const s = { id: nextId(), name: String(p.name).trim(), gender: p.gender, title_level: Number(p.title_level), valid: 1, base_shop_id: p.base_shop_id || null, create_date: today() }
    db.staff.push(s)
    if (phone) { addLink(s.id, phone.id); return { staff_id: s.id, token: null } }
    return { staff_id: s.id, token: newCode('private', s.id) }
  },
  UpdateStaff: (q, p) => {
    const s = findStaff(p.id)
    checkBasic(p)
    Object.assign(s, { name: String(p.name).trim(), gender: p.gender, title_level: Number(p.title_level), base_shop_id: p.base_shop_id || null })
    return { staff_id: s.id }
  },
  ChangePhone: (q, p) => {
    const s = findStaff(p.staff_id)
    if (!s.valid) fail('账号已停用')
    const a = assignable(p.account_id)
    endLink(activeLinkOfStaff(s.id))
    cancelCodes('private', s.id)
    addLink(s.id, a.id)
    return { staff_id: s.id }
  },
  Rebind: (q, p) => {
    const s = findStaff(p.staff_id)
    if (!s.valid) fail('账号已停用')
    cancelCodes('private', s.id)
    return { token: newCode('private', s.id) }
  },
  Offboard: (q, p) => {
    const s = findStaff(p.staff_id)
    if (!s.valid && !activeLinkOfStaff(s.id)) fail('账号已经离职')
    endLink(activeLinkOfStaff(s.id), p.date)
    cancelCodes('private', s.id)
    s.valid = 0
    return { staff_id: s.id }
  },
  Approve: (q, p) => {
    const s = findStaff(p.staff_id)
    const reg = openCode('selfreg', s.id)
    if (s.valid || !reg) fail('这个账号不是待开通状态')
    const link = db.links.find(l => l.staff_id === s.id && !l.valid && !l.end_date)
    link.valid = 1
    reg.used = true
    Object.assign(s, { valid: 1, title_level: Number(p.title_level), base_shop_id: p.base_shop_id || null })
    return { staff_id: s.id }
  },
  Reject: (q, p) => {
    const s = findStaff(p.staff_id)
    const reg = openCode('selfreg', s.id)
    if (s.valid || !reg) fail('这个账号不是待开通状态')
    reg.cancelled = true
    db.links.filter(l => l.staff_id === s.id && !l.valid && !l.end_date).forEach(l => endLink(l))
    return { staff_id: s.id }
  },
  ReclaimPhone: (q, p) => {
    const a = findAccount(p.account_id)
    if (phoneStatus(a) !== 'orphan') fail('这部手机不需要收回')
    endLink(activeLinkOfAccount(a.id))
    return { account_id: a.id }
  },
  AddJobPhone: (q, p) => {
    const c = String(p.cell || '').trim()
    if (!/^1\d{10}$/.test(c)) fail('请填写 11 位手机号')
    if (db.accounts.some(a => !a.is_private && a.cell === c)) fail('这部工作手机已经登记过')
    const a = { id: nextId(), cell: c, is_private: 0, wechat_mini_openid: '' }
    db.accounts.push(a)
    return { token: newCode('job_phone', null, a.id), account_id: a.id }
  },
  BindJobPhone: (q, p) => {
    const a = findAccount(p.account_id)
    if (a.is_private) fail('只有工作手机需要单独绑定微信')
    cancelCodes('job_phone', null, a.id)
    return { token: newCode('job_phone', null, a.id), account_id: a.id }
  }
}

function codeStatus(c) {
  if (c.used) return 'used'
  if (c.cancelled) return 'cancelled'
  return c.expire_ms > Date.now() ? 'ok' : 'expired'
}

// 假解密：测试把手机号直接放在 encData 里
function decrypt(p) { if (!p.encData || !p.iv) fail('手机号授权失败，请重新授权'); return p.encData }

const USER_ACTIONS = {
  GetBindCode: q => {
    const c = db.codes.find(x => x.token === q.token && x.purpose !== 'selfreg') || fail('绑定码不存在')
    const out = { token: c.token, purpose: c.purpose, status: codeStatus(c), expire_at: stamp(c.expire_ms), staff: null, phone: null }
    if (c.staff_id) { const s = findStaff(c.staff_id); out.staff = { id: s.id, name: s.name, title_label: view.titleLabel(s.title_level), shop_name: shopName(s.base_shop_id) } }
    if (c.account_id) out.phone = { id: c.account_id, tail: view.tail(findAccount(c.account_id).cell) }
    return out
  },
  ConfirmBind: (q, p) => {
    const cell = decrypt(p)
    const c = db.codes.find(x => x.token === p.token && x.purpose !== 'selfreg') || fail('绑定码不存在')
    const status = codeStatus(c)
    if (status !== 'ok') fail(status === 'used' ? '这个码已经用过了' : '这个码已失效，请让管理员重新生成')
    const openid = db.session.openid
    requireMember(openid)
    if (c.purpose === 'job_phone') {
      const phone = findAccount(c.account_id)
      if (cell !== phone.cell) fail('授权的手机号 ' + view.tail(cell) + ' 和工作手机 ' + view.tail(phone.cell) + ' 不一致')
      phone.wechat_mini_openid = openid
    } else {
      const s = findStaff(c.staff_id)
      if (!s.valid) fail('账号已停用')
      const a = { id: nextId(), cell, is_private: 1, wechat_mini_openid: openid }
      db.accounts.push(a)
      endLink(activeLinkOfStaff(s.id))
      addLink(s.id, a.id)
    }
    c.used = true
    return { staff_id: c.staff_id }
  },
  SelfRegister: (q, p) => {
    const cell = decrypt(p)
    if (!String(p.name || '').trim()) fail('请填写姓名')
    if (p.gender !== '男' && p.gender !== '女') fail('请选择性别')
    requireMember(db.session.openid)
    const s = { id: nextId(), name: String(p.name).trim(), gender: p.gender, title_level: 0, valid: 0, base_shop_id: null, create_date: today() }
    const a = { id: nextId(), cell, is_private: 1, wechat_mini_openid: db.session.openid }
    db.staff.push(s)
    db.accounts.push(a)
    addLink(s.id, a.id, 0)
    db.codes.push({ token: 'demo-selfreg-' + s.id, purpose: 'selfreg', staff_id: s.id, account_id: a.id, used: false, cancelled: false, expire_ms: Date.now() + 365 * 86400000 })
    return { staff_id: s.id }
  }
}

// 按 StaffAdminController 的信封返回：{ code, message, data }
function handle(action, query, body) {
  const fn = ADMIN_ACTIONS[action] || USER_ACTIONS[action]
  if (!fn) return { code: 1, message: '未模拟 ' + action }
  if (ADMIN_ACTIONS[action] && !db.session.admin) return { code: 3, message: '只有系统管理员可以管理员工账号' }
  try {
    return { code: 0, message: '', data: JSON.parse(JSON.stringify(fn(query, body || {}))) }
  } catch (e) {
    if (e && e.code) return { code: e.code, message: e.message }
    throw e
  }
}

function snapshot() { return db }

module.exports = { reset, setSession, handle, snapshot }

// 员工账号管理：真实 api.js 经 setTransport 接到假后端（tests/staffadmin_fake_backend.js），逐页 onLoad，
// 并走通入职（工作手机 / 私人手机扫码）、换手机、离职、收回手机、登记工作手机、自助登记开通
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fake = require('./staffadmin_fake_backend.js')
const api = require('../pages/staffadmin/common/api.js')

const PREFIX = 'https://x/api/'
let calls = []
let nav = []
let toasts = []
let modals = []

function installFakes(staff) {
  fake.reset()
  fake.setSession({ admin: !!(staff && staff.title_level >= 300) })
  calls = []
  nav = []
  toasts = []
  modals = []
  api.setTransport(function (options) {
    const [pathPart, query] = options.url.replace(PREFIX, '').split('?')
    const params = {}
    ;(query || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); params[k] = decodeURIComponent(v) })
    calls.push({ path: pathPart, method: options.method, data: options.data, params })
    const action = pathPart.replace('StaffAdmin/', '')
    setImmediate(() => options.success({ statusCode: 200, data: fake.handle(action, params, options.data) }))
  })
  global.wx = {
    showToast(o) { toasts.push(o.title) }, setNavigationBarTitle() {}, stopPullDownRefresh() {}, previewImage() {},
    navigateTo(o) { nav.push(o.url) }, redirectTo(o) { nav.push(o.url) }, navigateBack() { nav.push('back') },
    showModal(o) { modals.push(o.title); setImmediate(() => o.success && o.success({ confirm: true })) }
  }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { staff, sessionKey: 'sk%2B1', requestPrefix: PREFIX } })
}

function loadPage(name) {
  const file = path.join(__dirname, '../pages/staffadmin', name, name + '.js')
  delete require.cache[require.resolve(file)]
  let def = null
  global.Page = d => { def = d }
  require(file)
  delete global.Page
  const page = Object.assign({}, def, { data: JSON.parse(JSON.stringify(def.data)) })
  page.setData = function (patch) {
    Object.keys(patch).forEach(key => {
      const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.')
      let o = this.data
      parts.slice(0, -1).forEach(k => { if (o[k] === undefined || o[k] === null) o[k] = {}; o = o[k] })
      o[parts[parts.length - 1]] = patch[key]
    })
  }
  Object.keys(def).filter(k => typeof def[k] === 'function').forEach(k => { page[k] = def[k].bind(page) })
  return page
}

const settle = () => new Promise(r => setTimeout(r, 30))
const tap = (dataset) => ({ currentTarget: { dataset } })
const lastToken = () => nav[nav.length - 1].split('token=')[1]
const phoneEvent = cell => ({ detail: { errMsg: 'getPhoneNumber:ok', encryptedData: cell, iv: 'iv' } })
const ADMIN = { id: 4, valid: 1, title_level: 300 }

const PAGES = { list: {}, detail: { id: '1' }, onboard: {}, phones: {}, bindcode: { token: 'demo-liuyang' }, bind: { token: 'demo-liuyang' }, selfreg: {} }
for (const name of Object.keys(PAGES)) {
  test('页面 ' + name + '：系统管理员打开无报错', async () => {
    installFakes(ADMIN)
    const page = loadPage(name)
    page.onLoad(PAGES[name])
    await settle()
    assert.ok(!page.data.blocked, name + ' blocked: ' + page.data.blocked)
    assert.deepEqual(toasts, [], name + ' 报错：' + toasts.join(';'))
    assert.ok(calls.every(c => c.path.indexOf('StaffAdmin/') === 0), '请求路径')
    assert.ok(calls.every(c => c.params.sessionKey === 'sk+1'), 'sessionKey 原样传递')
  })
}

test('店长打开管理页被拦下，不发请求；扫码页不限身份', async () => {
  installFakes({ id: 2, valid: 1, title_level: 200 })
  const list = loadPage('list')
  list.onLoad({})
  await settle()
  assert.match(list.data.blocked, /系统管理员/)
  assert.equal(calls.length, 0)
  const bind = loadPage('bind')
  bind.onLoad({ token: 'demo-liuyang' })
  await settle()
  assert.equal(bind.data.state, 'confirm')
})

test('列表：各状态人数、筛选、搜索；登录认不出的绑定归入需处理', async () => {
  installFakes(ADMIN)
  const page = loadPage('list')
  page.onLoad({})
  await settle()
  // 吴芳的微信 o-demo-09 不是会员：login_ok=false → 需处理
  assert.deepEqual(page.data.counts, { active: 6, pending: 1, attention: 3, left: 2 })
  page.onFilter(tap({ key: 'attention' }))
  assert.deepEqual(page.data.rows.map(r => r.name), ['吴芳', '王强', '钱进'])
  assert.equal(page.data.rows[0].issues[0].code, 'login_fail')
  page.onSearch({ detail: { value: '7440' } })
  assert.deepEqual(page.data.rows.map(r => r.name), ['李明'])
  assert.equal(page.data.rows[0].typeTag.text, '工作手机')
})

test('入职（分配工作手机）：只能选空闲且已绑微信的手机，提交后进详情', async () => {
  installFakes(ADMIN)
  const page = loadPage('onboard')
  page.onLoad({})
  await settle()
  assert.deepEqual(page.data.phones.filter(p => p.assignable).map(p => p.tail), ['···6973', '···6240'])
  page.onPickPhone(tap({ id: 5 }))
  assert.equal(page.data.form.account_id, null, '微信未绑定的手机不能选')
  page.onName({ detail: { value: '新人甲' } })
  page.onGender(tap({ v: '女' }))
  page.onPickPhone(tap({ id: 6 }))
  page.onSubmit()
  await settle()
  const sent = calls.find(c => c.path === 'StaffAdmin/Onboard')
  assert.equal(sent.method, 'POST')
  assert.equal(sent.data.type, 'job')
  assert.equal(sent.data.account_id, 6)
  assert.match(nav[nav.length - 1], /^\.\.\/detail\/detail\?id=\d+$/)
  const id = Number(nav[nav.length - 1].split('id=')[1])
  const d = await api.getStaff(id)
  assert.equal(d.staff.binding.account_id, 6)
})

test('入职（私人手机）：出绑定码 → 对方扫码（options.q）授权 → 账号关联这部私人手机', async () => {
  installFakes(ADMIN)
  const page = loadPage('onboard')
  page.onLoad({})
  await settle()
  page.onType(tap({ type: 'private' }))
  page.onName({ detail: { value: '新人丙' } })
  page.onGender(tap({ v: '男' }))
  page.onSubmit()
  await settle()
  assert.match(nav[nav.length - 1], /^\.\.\/bindcode\/bindcode\?token=/)
  const token = lastToken()

  const code = loadPage('bindcode')
  code.onLoad({ token })
  await settle()
  assert.equal(code.data.code.status, 'ok')
  assert.match(code.data.title, /新人丙/)
  assert.equal(code.data.qrSrc, PREFIX + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent('https://mini.snowmeet.top/mapp/staff_bind?token=' + token))

  // 扫普通链接二维码进入：token 在 options.q 里
  const bind = loadPage('bind')
  bind.onLoad({ q: encodeURIComponent('https://mini.snowmeet.top/mapp/staff_bind?token=' + token) })
  await settle()
  assert.equal(bind.data.state, 'confirm')
  bind.onPhone(phoneEvent('13700001111'))
  await settle()
  assert.equal(bind.data.state, 'done')
  const sent = calls.find(c => c.path === 'StaffAdmin/ConfirmBind')
  assert.deepEqual(sent.data, { token, encData: '13700001111', iv: 'iv' })

  code.onShow()
  await settle()
  assert.equal(code.data.code.status, 'used')
  const d = await api.getStaff(code.data.code.staff.id)
  assert.equal(d.staff.binding.is_private, true)
  assert.equal(d.staff.binding.cell, '13700001111')
})

test('扫码：拒绝授权不提交；不是会员整页提示', async () => {
  installFakes(ADMIN)
  const bind = loadPage('bind')
  bind.onLoad({ token: 'demo-liuyang' })
  await settle()
  bind.onPhone({ detail: { errMsg: 'getPhoneNumber:fail user deny' } })
  await settle()
  assert.equal(bind.data.state, 'confirm')
  assert.match(toasts[0], /授权手机号/)
  assert.ok(!calls.some(c => c.path === 'StaffAdmin/ConfirmBind'))

  fake.setSession({ openid: 'o-stranger' })
  bind.onPhone(phoneEvent('13700001111'))
  await settle()
  assert.equal(bind.data.state, 'not_member')
})

test('离职：只停这一个账号，工作手机退回空闲', async () => {
  installFakes(ADMIN)
  const page = loadPage('detail')
  page.onLoad({ id: '1' })
  await settle()
  page.onOffboard()
  assert.match(page.data.offEffects[0], /工作手机 ···7440 退回空闲/)
  page.onConfirmOff()
  await settle()
  assert.deepEqual(calls.find(c => c.path === 'StaffAdmin/Offboard').data, { staff_id: 1, date: page.data.offDate })
  assert.equal(page.data.staff.status, 'left')
  assert.equal((await api.listPhones()).find(p => p.id === 1).holder, null)
})

test('换手机：私人手机换成工作手机、再换回私人手机，任何时候只关联一套', async () => {
  installFakes(ADMIN)
  const page = loadPage('detail')
  page.onLoad({ id: '3' })
  await settle()
  assert.equal(page.data.staff.binding.is_private, true)
  page.onChangePhone()
  await settle()
  page.onPickPhone(tap({ id: 6 }))
  page.onConfirmPhone()
  await settle()
  assert.equal(page.data.staff.binding.account_id, 6)
  assert.equal(page.data.history.filter(h => h.current).length, 1)

  page.onRebind()
  await settle()
  await api.confirmBind(lastToken(), '13800009999', 'iv')
  page.onShow()
  await settle()
  assert.equal(page.data.staff.binding.is_private, true)
  assert.equal(page.data.history.filter(h => h.current).length, 1)
  assert.equal((await api.listPhones()).find(p => p.id === 6).holder, null)
})

test('职级比自己高的账号只读', async () => {
  installFakes(ADMIN)
  fake.snapshot().staff.find(s => s.id === 12).title_level = 1000
  const page = loadPage('detail')
  page.onLoad({ id: '12' })
  await settle()
  assert.equal(page.data.staff.manageable, false)
})

test('工作手机：收回离职员工占用的手机', async () => {
  installFakes(ADMIN)
  const page = loadPage('phones')
  page.onLoad({})
  await settle()
  assert.equal(page.data.rows[0].status, 'orphan')
  page.onReclaim(tap({ id: page.data.rows[0].id }))
  await settle()
  assert.equal(page.data.rows.find(r => r.id === 4).status, 'idle')
})

test('工作手机：登记新手机后出绑定码，用那部手机扫码后变为空闲可分配', async () => {
  installFakes(ADMIN)
  const page = loadPage('phones')
  page.onLoad({})
  await settle()
  page.onAdd()
  page.onAddCell({ detail: { value: '13900005555' } })
  page.onConfirmAdd()
  await settle()
  const token = lastToken()
  await assert.rejects(api.confirmBind(token, '13900000000', 'iv'), err => /不一致/.test(err.message))
  await api.confirmBind(token, '13900005555', 'iv')
  page.onShow()
  await settle()
  assert.equal(page.data.rows.find(r => r.cell === '13900005555').status, 'idle')
})

test('自助登记码：显示公众号员工入职码', async () => {
  installFakes(ADMIN)
  const page = loadPage('bindcode')
  page.onLoad({ token: 'selfreg' })
  await settle()
  assert.equal(page.data.qrSrc, PREFIX + 'MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=snowmeet_staff_reg'))
  assert.equal(calls.length, 0)
})

test('自助登记 → 待开通 → 管理员开通', async () => {
  installFakes(null)
  const reg = loadPage('selfreg')
  reg.onLoad({})
  await settle()
  reg.onName({ detail: { value: '新人乙' } })
  reg.onGender(tap({ v: '男' }))
  reg.onPhone(phoneEvent('13700003333'))
  await settle()
  assert.equal(reg.data.state, 'done')
  assert.deepEqual(calls.find(c => c.path === 'StaffAdmin/SelfRegister').data, { name: '新人乙', gender: '男', encData: '13700003333', iv: 'iv' })

  fake.setSession({ admin: true })
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { staff: ADMIN, sessionKey: 'sk', requestPrefix: PREFIX } })
  const created = (await api.listStaff()).find(s => s.name === '新人乙')
  const page = loadPage('detail')
  page.onLoad({ id: String(created.id) })
  await settle()
  assert.equal(page.data.staff.status, 'pending')
  page.onApprove()
  page.onApproveLevel(tap({ level: 200 }))
  page.onConfirmApprove()
  await settle()
  assert.equal(page.data.staff.status, 'active')
  assert.equal(page.data.staff.title_level, 200)
})

test('自助登记：不是会员整页提示', async () => {
  installFakes(null)
  fake.setSession({ openid: 'o-stranger' })
  const reg = loadPage('selfreg')
  reg.onLoad({})
  await settle()
  reg.onName({ detail: { value: '新人丁' } })
  reg.onGender(tap({ v: '女' }))
  reg.onPhone(phoneEvent('13700004444'))
  await settle()
  assert.equal(reg.data.state, 'not_member')
})

test('登录失效（code 2）提示重新进入', async () => {
  installFakes(ADMIN)
  api.setTransport(o => setImmediate(() => o.success({ statusCode: 200, data: { code: 2, message: '登录已失效' } })))
  const page = loadPage('list')
  page.onLoad({})
  await settle()
  assert.deepEqual(modals, ['登录已失效'])
})

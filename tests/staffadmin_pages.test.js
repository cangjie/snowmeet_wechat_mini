// 员工账号管理原型：假 wx 逐页 onLoad，并走通入职（工作手机 / 私人手机扫码）、换手机、离职、收回手机、开通、自助登记
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const mock = require('../pages/staffadmin/common/mock.js')
const api = require('../pages/staffadmin/common/api.js')

let nav = []
let toasts = []
function installFakes(titleLevel) {
  mock.reset()
  nav = []
  toasts = []
  global.wx = {
    showToast(o) { toasts.push(o.title) }, setNavigationBarTitle() {}, stopPullDownRefresh() {},
    navigateTo(o) { nav.push(o.url) }, redirectTo(o) { nav.push(o.url) }, navigateBack() { nav.push('back') },
    showModal(o) { setImmediate(() => o.success && o.success({ confirm: true })) }
  }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { staff: titleLevel === null ? null : { id: 99, title_level: titleLevel } } })
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
const lastToken = () => { const u = nav[nav.length - 1]; return u.split('token=')[1] }
const ADMIN = 300

const PAGES = { list: {}, detail: { id: '1' }, onboard: {}, phones: {}, bindcode: { token: 'demo-liuyang' }, bind: { token: 'demo-liuyang' }, selfreg: {} }
for (const name of Object.keys(PAGES)) {
  test('页面 ' + name + '：系统管理员打开无报错', async () => {
    installFakes(ADMIN)
    const page = loadPage(name)
    page.onLoad(PAGES[name])
    await settle()
    assert.ok(!page.data.blocked, name + ' blocked: ' + page.data.blocked)
    assert.equal(page.data.prototype, true)
    assert.deepEqual(toasts, [], name + ' 报错：' + toasts.join(';'))
  })
}

test('店长打开管理页被拦下；扫码页不限身份', async () => {
  installFakes(200)
  const list = loadPage('list')
  list.onLoad({})
  await settle()
  assert.match(list.data.blocked, /系统管理员/)
  const bind = loadPage('bind')
  bind.onLoad({ token: 'demo-liuyang' })
  await settle()
  assert.equal(bind.data.state, 'confirm')
})

test('列表：各状态人数、筛选、搜索', async () => {
  installFakes(ADMIN)
  const page = loadPage('list')
  page.onLoad({})
  await settle()
  assert.deepEqual(page.data.counts, { active: 6, pending: 1, attention: 2, left: 2 })
  page.onFilter(tap({ key: 'attention' }))
  assert.deepEqual(page.data.rows.map(r => r.name), ['王强', '钱进'])
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
  assert.match(nav[nav.length - 1], /^\.\.\/detail\/detail\?id=\d+$/)
  const id = Number(nav[nav.length - 1].split('id=')[1])
  const d = await api.getStaff(id)
  assert.equal(d.staff.binding.account_id, 6)
  assert.equal(d.staff.binding.is_private, false)
})

test('入职（私人手机）：出绑定码 → 员工扫码授权 → 账号关联这部私人手机，码作废', async () => {
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

  const bind = loadPage('bind')
  bind.onLoad({ token })
  await settle()
  bind.onPhone({ detail: { errMsg: 'getPhoneNumber:ok' } })
  await settle()
  assert.equal(bind.data.state, 'done')

  code.onShow()
  await settle()
  assert.equal(code.data.code.status, 'used')
  const d = await api.getStaff(code.data.code.staff.id)
  assert.equal(d.staff.binding.is_private, true)
  assert.equal(d.staff.binding.has_wechat, true)
})

test('扫码时拒绝授权手机号：不绑定', async () => {
  installFakes(ADMIN)
  const bind = loadPage('bind')
  bind.onLoad({ token: 'demo-liuyang' })
  await settle()
  bind.onPhone({ detail: { errMsg: 'getPhoneNumber:fail user deny' } })
  await settle()
  assert.equal(bind.data.state, 'confirm')
  assert.match(toasts[0], /授权手机号/)
})

test('离职：只停这一个账号，工作手机退回空闲，其他账号不受影响', async () => {
  installFakes(ADMIN)
  const page = loadPage('detail')
  page.onLoad({ id: '1' })
  await settle()
  page.onOffboard()
  assert.match(page.data.offEffects[0], /工作手机 ···7440 退回空闲/)
  page.onConfirmOff()
  await settle()
  assert.equal(page.data.staff.status, 'left')
  const phone = (await api.listPhones()).find(p => p.id === 1)
  assert.equal(phone.holder, null)
  const others = (await api.listStaff()).filter(s => s.id !== 1 && s.valid)
  assert.equal(others.length, 6)
})

test('工作手机：收回离职员工占用的手机', async () => {
  installFakes(ADMIN)
  const page = loadPage('phones')
  page.onLoad({})
  await settle()
  assert.equal(page.data.rows[0].status, 'orphan')
  assert.equal(page.data.counts.attention, 2)
  page.onReclaim(tap({ id: page.data.rows[0].id }))
  await settle()
  assert.equal(page.data.rows.find(r => r.id === 4).status, 'idle')
  assert.equal((await api.getStaff(10)).staff.binding, null)
})

test('工作手机：登记新手机后出绑定码，扫码后变为空闲可分配', async () => {
  installFakes(ADMIN)
  const page = loadPage('phones')
  page.onLoad({})
  await settle()
  page.onAdd()
  page.onAddCell({ detail: { value: '13900005555' } })
  page.onConfirmAdd()
  await settle()
  const token = lastToken()
  await api.confirmBind(token)
  page.onShow()
  await settle()
  const added = page.data.rows.find(r => r.cell === '13900005555')
  assert.equal(added.status, 'idle')
})

test('自助登记 → 待开通 → 管理员开通', async () => {
  installFakes(null)
  const reg = loadPage('selfreg')
  reg.onLoad({})
  await settle()
  reg.onName({ detail: { value: '新人乙' } })
  reg.onGender(tap({ v: '男' }))
  reg.onPhone({ detail: { errMsg: 'getPhoneNumber:ok' } })
  await settle()
  assert.equal(reg.data.submitted, true)

  const created = (await api.listStaff()).find(s => s.name === '新人乙')
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { staff: { id: 99, title_level: ADMIN } } })
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

test('换手机：私人手机换成工作手机、再换回私人手机，任何时候账号只关联一套', async () => {
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
  assert.equal(page.data.staff.typeTag.text, '工作手机')
  assert.equal(page.data.history.filter(h => h.current).length, 1)

  page.onRebind()
  await settle()
  const token = lastToken()
  await api.confirmBind(token)
  page.onShow()
  await settle()
  assert.equal(page.data.staff.binding.is_private, true)
  assert.equal(page.data.history.filter(h => h.current).length, 1)
  assert.equal((await api.listPhones()).find(p => p.id === 6).holder, null, '换走后工作手机退回空闲')
})

test('工作手机不能同时分给两个账号', async () => {
  installFakes(ADMIN)
  await assert.rejects(api.changePhone(3, 1), /不能分配/)
})

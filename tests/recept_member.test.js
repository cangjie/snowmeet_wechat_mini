// 接待·顾客信息页（pages/admin/reception/recept_member）：
//   老顾客直接显示、新顾客授权后弹窗、改电话称呼只进订单、「更新顾客信息」才改会员、散客、选店铺和业务进开单
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle, tap } = require('./reception_harness.js')

const PAGE = 'pages/admin/reception/recept_member.js'
const VERIFIED = { code: 0, data: { stage: 'verified', memberId: 42, name: '张三', gender: '男', cell: '13800138000', maskedCell: '138****8000' } }

function memberRecord() {
  return {
    id: 42, real_name: '张三', gender: '男', cell: '13800138000',
    contactNums: [
      { id: 1, member_id: 42, type: 'cell', num: '13800138000', valid: 1 },
      { id: 2, member_id: 42, type: 'contact', num: '13700137000', valid: 1 }
    ],
    availableDeposit: 120, avaliablePoints: 30
  }
}

function setup(pollResult, options) {
  const opts = options || {}
  const calls = { poll: [], getMember: [], update: [], lookup: [] }
  const nav = []
  const modals = []
  const actionSheets = []
  const toasts = []
  const storage = {}
  const events = []
  const stored = JSON.parse(JSON.stringify(opts.memberRecord || memberRecord()))
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk' } })
  global.wx = {
    navigateTo(o) { nav.push(o.url); events.push('navigate') },
    setStorageSync(k, v) { storage[k] = v },
    showToast(o) { toasts.push(o.title) },
    showLoading() {},
    hideLoading() {},
    showModal(o) { modals.push(o); if (o.success) o.success({ confirm: true }) },
    showActionSheet(o) { actionSheets.push(o) }
  }
  const fakeData = {
    getReceptCheckinByStaffPromise(id) { calls.poll.push(id); return Promise.resolve(pollResult()) },
    getMemberPromise(id) { calls.getMember.push(id); return Promise.resolve(JSON.parse(JSON.stringify(stored))) },
    updateMemberInfoByStaffPromise(member, scene) {
      calls.update.push({ member, scene })
      events.push('update')
      if (opts.updateFails) return Promise.reject(new Error('保存失败'))
      stored.real_name = member.real_name
      stored.gender = member.gender
      if (member.currentContactNum && !stored.contactNums.some(contact => contact.num === member.currentContactNum)) {
        stored.contactNums.push({ id: 3, member_id: 42, type: 'contact', num: member.currentContactNum, valid: 1 })
      }
      return Promise.resolve(JSON.parse(JSON.stringify(stored)))
    },
    getMemberByNumSilentPromise(cell) { calls.lookup.push(cell); return Promise.resolve(opts.lookup ? opts.lookup(cell) : null) }
  }
  const page = loadPage(PAGE, fakeData)
  return { page, calls, nav, modals, actionSheets, events, toasts, storage }
}

function cleanup(page) {
  page.onUnload()
  delete global.getApp
  delete global.wx
}

async function openVerified(env) {
  env.page.onLoad({ checkinId: '5', stage: 'verified' })
  env.page.onShow()
  await settle()
  await settle()
}

async function chooseAction(env, tapIndex) {
  env.actionSheets[0].success({ tapIndex })
  await settle()
  await settle()
}

test('老顾客扫码：直接显示会员信息，不弹窗，资料一致时不能「更新顾客信息」', async () => {
  const env = setup(() => VERIFIED)
  await openVerified(env)
  const { page, calls, modals } = env
  assert.deepEqual(calls.poll, [5])
  assert.deepEqual(calls.getMember, [42])
  assert.equal(page.data.waitingPhone, false)
  assert.deepEqual(page.data.form, { name: '张三', gender: '男', cell: '13800138000' })
  assert.equal(page.data.member.cell, '13800138000')
  assert.match(page.data.member.availableDepositStr, /120/)
  assert.equal(page.data.member.availablePoints, 30)
  assert.deepEqual(page.data.otherNums, ['13700137000'])
  assert.equal(page.data.needUpdate, false)
  assert.equal(page._pollTimer, null)
  assert.deepEqual(modals, [])
  cleanup(page)
})

test('新顾客扫码：授权前不能开单，授权后弹窗提示店员，再选店铺和业务进开单', async () => {
  let result = { code: 0, data: { stage: 'need_phone' } }
  const { page, nav, modals, toasts, storage } = setup(() => result)
  page.onLoad({ checkinId: '5', stage: 'need_phone' })
  page.onShow()
  await settle()
  assert.equal(page.data.waitingPhone, true)
  assert.notEqual(page._pollTimer, null)

  page.shopSelected({ detail: { shop: '万龙体验中心', sale: 1, rent: 1, care: 0 } })
  page.onBizTap(tap({ type: 'rent' }))
  assert.deepEqual(toasts, ['请等顾客授权手机号'])
  assert.deepEqual(nav, [])

  result = VERIFIED
  page.pollCheckin()
  await settle()
  await settle()
  assert.equal(page.data.waitingPhone, false)
  assert.equal(page._pollTimer, null)
  assert.equal(modals.length, 1)
  assert.equal(modals[0].title, '顾客已授权手机号')
  assert.match(modals[0].content, /138\*\*\*\*8000/)

  // 万龙体验中心不做养护（care=0），养护不能开；换到万龙服务中心再开
  page.onBizTap(tap({ type: 'maintain' }))
  assert.deepEqual(toasts, ['请等顾客授权手机号', '当前店铺不支持养护'])
  assert.deepEqual(nav, [])
  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 0, care: 1 } })
  page.onBizTap(tap({ type: 'maintain' }))
  assert.equal(nav.length, 1)
  assert.match(nav[0], /^\/pages\/admin\/reception\/recept_new\?bizType=maintain/)
  assert.match(nav[0], /memberId=42/)
  assert.match(nav[0], /customerCell=13800138000/)
  assert.match(nav[0], /shop=%E4%B8%87%E9%BE%99%E6%9C%8D%E5%8A%A1%E4%B8%AD%E5%BF%83/)
  assert.equal(storage.reception_draft.shopName, '万龙服务中心')
  cleanup(page)
})

test('店员输手机号已授权：直接显示会员信息，不弹窗', async () => {
  const env = setup(() => ({ code: 0, data: { stage: 'phone_authed', memberId: 42, name: '张三', gender: '男', cell: '13800138000', maskedCell: '138****8000' } }))
  env.page.onLoad({ checkinId: '5', stage: 'phone_authed' })
  env.page.onShow()
  await settle()
  await settle()
  assert.equal(env.page.data.waitingPhone, false)
  assert.equal(env.page.data.member.id, 42)
  assert.equal(env.page.data.form.cell, '13800138000')
  assert.deepEqual(env.modals, [])
  cleanup(env.page)
})

test('已编辑的称呼和电话可选择只作为本次订单联系人', async () => {
  const env = setup(() => VERIFIED)
  await openVerified(env)
  const { page, calls, nav, actionSheets } = env
  page.onNameInput({ detail: { value: '张三丰' } })
  page.onGenderTap(tap({ value: '女' }))
  page.onCellInput({ detail: { value: '13900139000' } })
  assert.equal(page.data.needUpdate, true)
  assert.deepEqual(page.data.otherNums, ['13800138000', '13700137000'])

  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })
  page.onBizTap(tap({ type: 'rent' }))
  assert.equal(actionSheets.length, 1)
  assert.deepEqual(actionSheets[0].itemList, ['更新会员信息', '保存为本订单临时联系人', '放弃修改'])
  assert.deepEqual(nav, [])
  await chooseAction(env, 1)
  assert.match(nav[0], /customerName=%E5%BC%A0%E4%B8%89%E4%B8%B0/)
  assert.match(nav[0], /gender=%E5%A5%B3/)
  assert.match(nav[0], /customerCell=13900139000/)
  assert.match(nav[0], /memberId=42/)
  assert.deepEqual(calls.update, [])
  cleanup(page)
})

test('称呼性别重复点选保持选中，点另一项时切换', async () => {
  const env = setup(() => VERIFIED)
  await openVerified(env)
  const { page } = env

  page.onGenderTap(tap({ value: '男' }))
  assert.equal(page.data.form.gender, '男')
  page.onGenderTap(tap({ value: '女' }))
  assert.equal(page.data.form.gender, '女')
  page.onGenderTap(tap({ value: '女' }))
  assert.equal(page.data.form.gender, '女')

  cleanup(page)
})

test('已有会员姓名和性别都为空时，填写后点业务自动保存再导航', async () => {
  const emptyMember = memberRecord()
  emptyMember.real_name = ''
  emptyMember.gender = ''
  const env = setup(() => VERIFIED, { memberRecord: emptyMember })
  const { page, calls, nav, events } = env
  await openVerified(env)
  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })

  page.onBizTap(tap({ type: 'maintain' }))
  assert.deepEqual(nav, [])
  await settle()
  await settle()

  assert.equal(calls.update.length, 1)
  assert.equal(calls.update[0].member.real_name, '张三')
  assert.equal(calls.update[0].member.gender, '男')
  assert.equal(events.indexOf('update') < events.indexOf('navigate'), true)
  assert.equal(nav.length, 1)
  assert.match(nav[0], /memberId=42/)
  assert.deepEqual(env.toasts, ['会员信息已自动保存'])
  cleanup(page)
})

test('修改已有会员资料后选择更新，保存成功后才进入业务', async () => {
  const env = setup(() => VERIFIED)
  const { page, calls, nav, actionSheets, events } = env
  await openVerified(env)
  page.onNameInput({ detail: { value: '张三丰' } })
  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })

  page.onBizTap(tap({ type: 'retail' }))
  assert.equal(actionSheets.length, 1)
  assert.deepEqual(nav, [])
  await chooseAction(env, 0)

  assert.equal(calls.update.length, 1)
  assert.equal(calls.update[0].member.real_name, '张三丰')
  assert.equal(events.indexOf('update') < events.indexOf('navigate'), true)
  assert.equal(nav.length, 1)
  assert.match(nav[0], /bizType=retail/)
  cleanup(page)
})

test('放弃修改恢复原会员资料后继续开单', async () => {
  const env = setup(() => VERIFIED)
  const { page, calls, nav } = env
  await openVerified(env)
  page.onNameInput({ detail: { value: '临时姓名' } })
  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })

  page.onBizTap(tap({ type: 'rent' }))
  await chooseAction(env, 2)

  assert.deepEqual(calls.update, [])
  assert.deepEqual(page.data.form, { name: '张三', gender: '男', cell: '13800138000' })
  assert.match(nav[0], /customerName=%E5%BC%A0%E4%B8%89/)
  assert.match(nav[0], /bizType=rent/)
  cleanup(page)
})

test('取消三项选择留在顾客信息页', async () => {
  const env = setup(() => VERIFIED)
  const { page, nav, actionSheets } = env
  await openVerified(env)
  page.onNameInput({ detail: { value: '临时姓名' } })
  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })

  page.onBizTap(tap({ type: 'rent' }))
  actionSheets[0].fail({ errMsg: 'showActionSheet:fail cancel' })

  assert.deepEqual(nav, [])
  assert.deepEqual(page.data.form, { name: '临时姓名', gender: '男', cell: '13800138000' })
  cleanup(page)
})

test('更新会员失败时不进入业务', async () => {
  const env = setup(() => VERIFIED, { updateFails: true })
  const { page, calls, nav, toasts } = env
  await openVerified(env)
  page.onNameInput({ detail: { value: '张三丰' } })
  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })

  page.onBizTap(tap({ type: 'rent' }))
  await chooseAction(env, 0)

  assert.equal(calls.update.length, 1)
  assert.deepEqual(nav, [])
  assert.equal(toasts.includes('会员信息保存失败，请重试'), true)
  cleanup(page)
})

test('点「更新顾客信息」确认后才改会员：姓名性别写回，新电话追加为联系号码', async () => {
  const env = setup(() => VERIFIED)
  await openVerified(env)
  const { page, calls, modals, toasts } = env
  page.onNameInput({ detail: { value: '张三丰' } })
  page.onCellInput({ detail: { value: '13900139000' } })
  page.onUpdateMemberTap()
  assert.equal(modals[0].title, '更新顾客信息')
  assert.equal(modals[0].content, '姓名改为：张三丰\n增加联系电话：13900139000')
  await settle()
  await settle()
  assert.equal(calls.update.length, 1)
  assert.equal(calls.update[0].scene, '开单')
  const sent = calls.update[0].member
  assert.equal(sent.id, 42)
  assert.equal(sent.real_name, '张三丰')
  assert.equal(sent.gender, '男')
  assert.equal(sent.currentContactNum, '13900139000')
  assert.deepEqual(sent.memberSocialAccounts.map(m => m.num), ['13800138000', '13700137000'])
  // 更新后重新拉会员，资料已一致
  assert.equal(page.data.member.realName, '张三丰')
  assert.equal(page.data.needUpdate, false)
  assert.deepEqual(toasts, ['已更新顾客信息'])
  cleanup(page)
})

test('点选会员登记过的其他号码作为联系电话，不算资料改动', async () => {
  const env = setup(() => VERIFIED)
  await openVerified(env)
  const { page } = env
  page.onPickNum(tap({ num: '13700137000' }))
  assert.equal(page.data.form.cell, '13700137000')
  assert.deepEqual(page.data.otherNums, ['13800138000'])
  assert.equal(page.data.needUpdate, false)
  cleanup(page)
})

test('顾客不方便授权：改按散客开单，之后的授权结果不再挂会员', async () => {
  let result = { code: 0, data: { stage: 'need_phone' } }
  const { page, nav, modals } = setup(() => result)
  page.onLoad({ checkinId: '5', stage: 'need_phone' })
  page.onShow()
  await settle()
  page.onWalkInInstead()
  assert.equal(modals[0].title, '按散客开单')
  assert.equal(page.data.mode, 'walkin')
  assert.equal(page.data.waitingPhone, false)
  assert.equal(page._pollTimer, null)

  result = VERIFIED
  page.pollCheckin()
  await settle()
  assert.equal(page.data.member, null)

  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })
  page.onBizTap(tap({ type: 'retail' }))
  assert.doesNotMatch(nav[0], /memberId=/)
  cleanup(page)
})

test('散客填会员手机号后匹配到会员：保留已填称呼并要求选择保存方式', async () => {
  const env = setup(() => VERIFIED, { lookup: () => ({ id: 42 }) })
  const { page, calls, nav, actionSheets } = env
  page.onLoad({ walkin: '1' })
  page.onShow()
  await settle()
  assert.equal(page.data.mode, 'walkin')
  assert.deepEqual(calls.poll, [])
  assert.equal(page.data.member, null)

  page.onNameInput({ detail: { value: '李四' } })
  page.onCellInput({ detail: { value: '1380013' } })
  await new Promise(r => setTimeout(r, 500))
  assert.deepEqual(calls.lookup, [])

  page.onCellInput({ detail: { value: '13800138000' } })
  await new Promise(r => setTimeout(r, 500))
  await settle()
  assert.deepEqual(calls.lookup, ['13800138000'])
  assert.equal(page.data.member.id, 42)
  assert.deepEqual(page.data.form, { name: '李四', gender: '男', cell: '13800138000' })
  assert.equal(page.data.needUpdate, true)

  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })
  page.onBizTap(tap({ type: 'rent' }))
  assert.equal(actionSheets.length, 1)
  await chooseAction(env, 1)
  assert.match(nav[0], /customerName=%E6%9D%8E%E5%9B%9B/)
  assert.match(nav[0], /memberId=42/)
  cleanup(page)
})

test('手机号查询晚到时放弃修改恢复数据库会员资料', async () => {
  const env = setup(() => VERIFIED, { lookup: () => ({ id: 42 }) })
  const { page, calls, nav, actionSheets } = env
  page.onLoad({ walkin: '1' })
  page.onNameInput({ detail: { value: '李四' } })
  page.onCellInput({ detail: { value: '13800138000' } })
  await new Promise(resolve => setTimeout(resolve, 500))
  await settle()
  assert.equal(page.data.member.id, 42)

  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })
  page.onBizTap(tap({ type: 'rent' }))
  assert.equal(actionSheets.length, 1)
  await chooseAction(env, 2)

  assert.deepEqual(calls.update, [])
  assert.match(nav[0], /customerName=%E5%BC%A0%E4%B8%89/)
  assert.match(nav[0], /memberId=42/)
  cleanup(page)
})

test('手机号会员查询未完成时阻止进入业务', () => {
  const env = setup(() => VERIFIED, { lookup: () => new Promise(() => {}) })
  const { page, nav, toasts } = env
  page.onLoad({ walkin: '1' })
  page.onCellInput({ detail: { value: '13800138000' } })
  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })

  page.onBizTap(tap({ type: 'retail' }))

  assert.deepEqual(nav, [])
  assert.equal(toasts.includes('正在查询会员资料，请稍候'), true)
  cleanup(page)
})

test('没选店铺、门店不支持或电话格式不对时不进开单', () => {
  const { page, nav, toasts } = setup(() => VERIFIED)
  page.onLoad({ walkin: '1' })
  page.onBizTap(tap({ type: 'rent' }))
  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 0, care: 1 } })
  page.onBizTap(tap({ type: 'rent' }))
  page.onCellInput({ detail: { value: '12ab' } })
  page.onBizTap(tap({ type: 'retail' }))
  assert.deepEqual(toasts, ['请先选择店铺', '当前店铺不支持租赁', '请输入正确手机号'])
  assert.deepEqual(nav, [])
  cleanup(page)
})

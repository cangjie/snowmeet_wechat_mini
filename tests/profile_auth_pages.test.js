// 顾客验证手机号之后授权头像和昵称（2026-11-14 用户要求）：所有顾客端手机号入口都接上 profile-auth 弹层。
//   1. 防遗漏：扫描所有非 legacy、非 staffadmin（店员绑定）且有 open-type="getPhoneNumber" 按钮的 wxml，
//      必须同时放 <profile-auth id="profileAuth" />，并且它的 js 里调 profileAuth.ensureOn(...)。以后谁新加手机号入口忘了接，这里失败。
//      例外：付款 / 收款环节一律不问（2026-11-15 用户：不论什么情况，付款的环节都不要询问，让顾客授权昵称和头像）——
//      付款页、支付身份确认、收银身份核验、次卡购买；这几处有另一组测试保证它们永远不弹，谁想加回去会失败。
//   2. 顺序：手机号验证成功后，先等弹层处理完（保存或跳过），才继续页面自己的后续步骤（核验、领券、购买、支付……）；
//      手机号没授权成功时不弹。弹层没弹出来（组件取不到）时后续步骤照常走，不被拦住。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { loadPage, loadComponent, settle } = require('./reception_harness.js')

const ROOT = path.join(__dirname, '..')

// ---------- 1. 防遗漏扫描 ----------

function walk(dir, out) {
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, name)
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (name.endsWith('.wxml')) out.push(rel)
  }
  return out
}

const PHONE_BUTTON = /open-type=["']getPhoneNumber["']/
// staffadmin：店员绑定 / 自助注册，不是顾客；legacy：旧版演示分包
const allPhoneEntries = [...walk('pages', []), ...walk('components', [])]
  .filter(rel => !/^pages[\\/](staffadmin|legacy)[\\/]/.test(rel) && !/^components[\\/]legacy[\\/]/.test(rel))
  .filter(rel => PHONE_BUTTON.test(fs.readFileSync(path.join(ROOT, rel), 'utf8')))

// 付款 / 收款环节：永远不弹头像昵称。payment_entry 是付款页（没有手机号按钮，授权在 pay-identity-confirm 里）
const PAYMENT_FLOW_ENTRIES = ['pages/order/identity_verify.wxml', 'pages/punchcard/punchcard_detail.wxml', 'components/pay-identity-confirm/index.wxml']
const PAYMENT_FLOW_FILES = [...PAYMENT_FLOW_ENTRIES, 'pages/order/payment_entry.wxml']
const norm = rel => rel.replace(/\\/g, '/')
const phoneEntries = allPhoneEntries.filter(rel => !PAYMENT_FLOW_ENTRIES.includes(norm(rel)))

test('扫描能找到已知的顾客端手机号入口（防止扫描规则本身失效）', () => {
  const names = allPhoneEntries.map(norm)
  for (const expected of [
    'pages/order/recept_checkin.wxml', 'pages/order/care_pick_verify.wxml', 'pages/order/identity_verify.wxml',
    'pages/coach/claim/claim.wxml', 'pages/mine/ticket/ticket_claim_mini/ticket_claim_mini.wxml',
    'pages/mine/ticket/ticket_share_mini.wxml', 'pages/mine/ticket/ticket_detail.wxml', 'pages/punchcard/punchcard_detail.wxml',
    'pages/ski_pass/skipass_detail_new.wxml', 'components/pay-identity-confirm/index.wxml', 'components/user_info/auth_cell.wxml',
  ]) assert.ok(names.includes(expected), expected + ' 应该被扫描到')
  assert.ok(!names.some(n => n.includes('staffadmin')), '店员绑定页不在范围内')
})

test('每个手机号入口的 wxml 都放了 <profile-auth id="profileAuth" />，js 里在手机号成功后调 profileAuth.ensureOn', () => {
  for (const rel of phoneEntries) {
    const wxml = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    assert.match(wxml, /<profile-auth\s+id="profileAuth"\s*(\/>|><\/profile-auth>)/, `${rel} 缺 <profile-auth id="profileAuth" />`)
    const jsFile = rel.replace(/\.wxml$/, '.js')
    const js = fs.readFileSync(path.join(ROOT, jsFile), 'utf8')
    assert.match(js, /profileAuth\.ensureOn\(/, `${jsFile} 手机号成功后要调 profileAuth.ensureOn(...)`)
    assert.match(js, /require\(['"](\.\.\/)+utils\/profile_auth\.js['"]\)/, `${jsFile} 要引入 utils/profile_auth.js`)
  }
})

test('付款 / 收款环节的 wxml 和 js 里没有头像昵称弹层（付款页、支付身份确认、收银身份核验、次卡购买）', () => {
  for (const rel of PAYMENT_FLOW_FILES) {
    const wxml = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    assert.doesNotMatch(wxml, /<profile-auth/, `${rel} 付款环节不能放头像昵称弹层`)
    const jsFile = rel.replace(/\.wxml$/, '.js')
    const js = fs.readFileSync(path.join(ROOT, jsFile), 'utf8')
    assert.doesNotMatch(js, /profile_auth|profileAuth/, `${jsFile} 付款环节不能调头像昵称弹层`)
  }
})

// ---------- 2. 顺序：先弹层处理完，再继续后续步骤 ----------

const PHONE_OK = { detail: { errMsg: 'getPhoneNumber:ok', encryptedData: 'enc', iv: 'iv' } }
const PHONE_DENIED = { detail: { errMsg: 'getPhoneNumber:fail user deny' } }

function deferred() {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}

function installGlobals(t, extraWx) {
  const app = { loginPromiseNew: Promise.resolve({ authenticated: true }), globalData: { sessionKey: 'sk', requestPrefix: 'https://t.test/api/', domainName: 't.test' },
    retryLogin() { return Promise.resolve() } }
  global.getApp = () => app
  global.wx = Object.assign({ showToast() {}, showLoading() {}, hideLoading() {}, navigateTo() {}, redirectTo() {}, navigateBack() {},
    getStorageSync() { return '' }, setStorageSync() {}, request() {}, getSystemInfoSync() { return { windowWidth: 375 } } }, extraWx || {})
  t.after(() => { delete global.getApp; delete global.wx })
  return app
}

// 把页面 / 组件上的 selectComponent('#profileAuth') 换成一个可控的弹层：ensure() 要等 gate 放开才完成
function withProfileGate(owner, log) {
  const gate = deferred()
  owner.selectComponent = selector => {
    assert.equal(selector, '#profileAuth')
    return { ensure() { log.push('ensure'); return gate.promise } }
  }
  return gate
}

// 每个入口：怎么装载、手机号成功要调哪个处理函数、成功之后「下一步」是哪个函数（装成记号）
const PAGE_CASES = [
  {
    name: 'care_pick_verify（扫码取板）', file: 'pages/order/care_pick_verify.js', handler: 'onBindCell', next: 'verifyNow',
    data: { bindWechatCellPromise: () => Promise.resolve({ id: 7 }), verifyCarePickPromise: async () => ({}) },
  },
  {
    name: 'coach/claim（学员卡领取）', file: 'pages/coach/claim/claim.js', handler: 'onPhone', next: 'onClaim',
    data: { bindWechatCellPromise: () => Promise.resolve({ id: 7, cell: '13800000000' }) },
  },
  {
    name: 'ticket_claim_mini（领券）', file: 'pages/mine/ticket/ticket_claim_mini/ticket_claim_mini.js', handler: 'onGetCell', next: 'load',
    data: { bindWechatCellPromise: () => Promise.resolve({ id: 7, cell: '13800000000' }) },
  },
  {
    name: 'ticket_share_mini（接受转赠）', file: 'pages/mine/ticket/ticket_share_mini.js', handler: 'onGetCell', next: 'load',
    data: { bindWechatCellPromise: () => Promise.resolve({ id: 7, cell: '13800000000' }) },
  },
  {
    name: 'ticket_detail（优惠券详情）', file: 'pages/mine/ticket/ticket_detail.js', handler: 'onGetCell', next: '_checkCell',
    data: { bindWechatCellPromise: () => Promise.resolve({ id: 7, cell: '13800000000' }) },
  },
]

for (const c of PAGE_CASES) {
  test(`${c.name}：手机号验证成功后先等头像昵称弹层处理完，再继续后续步骤`, async t => {
    installGlobals(t)
    const page = loadPage(c.file, Object.assign({}, c.data))
    if (c.prepare) c.prepare(page)
    const log = []
    page[c.next] = () => { log.push('next'); return Promise.resolve() }
    const gate = withProfileGate(page, log)

    const done = page[c.handler](PHONE_OK)
    await settle()
    assert.deepEqual(log, ['ensure'], '手机号一成功就弹，弹层没处理完不能往下走')
    gate.resolve()
    await done
    await settle()
    assert.deepEqual(log, ['ensure', 'next'], '弹层处理完（保存或跳过）才继续')
  })

  test(`${c.name}：页面里取不到弹层组件时不拦流程，后续步骤照常走`, async t => {
    installGlobals(t)
    const page = loadPage(c.file, Object.assign({}, c.data))
    if (c.prepare) c.prepare(page)
    const log = []
    page[c.next] = () => { log.push('next'); return Promise.resolve() }
    page.selectComponent = () => null

    await page[c.handler](PHONE_OK)
    await settle()
    assert.deepEqual(log, ['next'])
  })

  test(`${c.name}：没授权手机号不弹层`, async t => {
    installGlobals(t)
    const page = loadPage(c.file, Object.assign({}, c.data))
    if (c.prepare) c.prepare(page)
    const log = []
    page[c.next] = () => { log.push('next') }
    withProfileGate(page, log)

    await page[c.handler](PHONE_DENIED)
    await settle()
    assert.deepEqual(log, [], '没验证手机号：不弹、也不往下走')
  })
}

test('skipass_detail_new（雪票预订，自动获取手机号）：绑定成功后弹层处理完，才把手机号填进页面', async t => {
  installGlobals(t, {
    request(o) { o.success({ statusCode: 200, data: { currentCell: '13800000000' } }) },
  })
  const page = loadPage('pages/ski_pass/skipass_detail_new.js', {})
  const log = []
  const gate = withProfileGate(page, log)
  const done = page.getCell(PHONE_OK)
  await settle()
  assert.deepEqual(log, ['ensure'])
  assert.notEqual(page.data.cell, '13800000000')
  gate.resolve()
  await done
  await settle()
  assert.equal(page.data.cell, '13800000000')
})

// ---------- 3. 组件里的手机号入口 ----------

test('user_info/auth_cell（注册页的授权手机号按钮）：验证成功后先弹层，再把 Verified 事件交给页面', async t => {
  installGlobals(t)
  const comp = loadComponent('components/user_info/auth_cell.js', { verifyMemberCellPromise: () => Promise.resolve(true) })
  const log = []
  comp.triggerEvent = (name, detail) => log.push(name + ':' + detail)
  const gate = withProfileGate(comp, log)
  const done = comp.getCell(PHONE_OK)
  await settle()
  assert.deepEqual(log, ['ensure'])
  gate.resolve()
  await done
  await settle()
  assert.deepEqual(log, ['ensure', 'Verified:true'])
})

test('user_info/auth_cell：验证失败不弹层，照旧把失败交给页面', async t => {
  installGlobals(t)
  const comp = loadComponent('components/user_info/auth_cell.js', { verifyMemberCellPromise: () => Promise.reject(new Error('x')) })
  const log = []
  comp.triggerEvent = (name, detail) => log.push(name + ':' + detail)
  withProfileGate(comp, log)
  await comp.getCell(PHONE_OK)
  await settle()
  assert.deepEqual(log, ['Verified:false'])
})

// ---------- 4. 付款 / 收款环节：不论什么情况都不弹 ----------

const NO_PROMPT_PAGE_CASES = [
  { name: 'identity_verify（收银身份核验）', file: 'pages/order/identity_verify.js', handler: 'onBindCell', next: 'verifyNow',
    data: { bindWechatCellPromise: () => Promise.resolve({ id: 7 }), verifyWechatIdentityPromise: async () => ({}) } },
  { name: 'punchcard_detail（次卡购买）', file: 'pages/punchcard/punchcard_detail.js', handler: 'onGetCell', next: 'onBuyNow',
    data: { bindWechatCellPromise: () => Promise.resolve({ id: 7, cell: '13800000000' }) } },
]

// 万一有人把弹层加回来：selectComponent 一被调就记下来，并且永远不放行，页面要是还在等它，后续步骤就会走不到
function trapPrompt(owner, log) {
  owner.selectComponent = () => ({ ensure() { log.push('ensure'); return new Promise(() => {}) } })
}

for (const c of NO_PROMPT_PAGE_CASES) {
  test(`${c.name}：手机号验证成功后直接继续，不弹头像昵称`, async t => {
    installGlobals(t)
    const page = loadPage(c.file, Object.assign({}, c.data))
    const log = []
    page[c.next] = () => { log.push('next'); return Promise.resolve() }
    trapPrompt(page, log)
    await page[c.handler](PHONE_OK)
    await settle()
    assert.deepEqual(log, ['next'])
  })
}

function payIdentity(t, confirmResults) {
  installGlobals(t)
  const calls = []
  const comp = loadComponent('components/pay-identity-confirm/index.js', {
    confirmPayIdentityPromise: async body => { calls.push(body.action + (body.choice ? ':' + body.choice : '')); return confirmResults[body.action] || { status: 'direct' } },
  }, { paymentId: 5, payerType: 'wechat', scannerId: 's' })
  const log = []
  const origTrigger = comp.triggerEvent
  comp.triggerEvent = (name, detail) => { log.push(name); return origTrigger.call(comp, name, detail) }
  trapPrompt(comp, log)
  return { comp, calls, log }
}

test('pay-identity-confirm（支付身份确认）：授权手机号、正常支付、替人代付，成功后都直接通知父页继续（自动支付），不弹头像昵称', async t => {
  global.wx = null
  for (const action of [
    c => c.onGetPhoneNumber(PHONE_OK),
    c => c.onGetPhoneNumberAndConfirmDirect(PHONE_OK),
    c => c.onGetPhoneNumberAndChooseSelf(PHONE_OK),
    c => { global.wx.showModal = o => o.success({ confirm: true }); return c.onGetPhoneNumberAndChooseProxy(PHONE_OK) },
    c => c.onGetPhoneNumberAndConfirmDirect(PHONE_DENIED),
    c => c.onConfirmDirect(),
    c => c.onChooseSelf(),
  ]) {
    const { comp, log } = payIdentity(t, {})
    await action(comp)
    await settle()
    assert.ok(!log.includes('ensure'), '付款环节不弹')
    assert.ok(log.includes('refreshed'), '直接通知父页继续')
  }
})

// ---------- 5. 接待报到：先手机号，无论授权还是跳过，等约 5 秒再问昵称和头像（2026-11-15 用户定的顾客侧流程） ----------
// 顾客扫码后：第一，没授权手机号的先提示授权手机号；第二，无论授权还是跳过，大概等 5 秒，再提示授权昵称，最后授权头像
// （昵称和头像在同一个弹层里：昵称在上、自动获得焦点，头像在下）。手机号早就绑过的会员没有第一步，扫码报到成功后同样等 5 秒再问。
// 付款阶段（wepay / alipay）不问；离开页面、去付款页就不再问。

const PROFILE_DELAY_FOR_TEST = 5

function checkinPage(t, view, verifyView) {
  installGlobals(t)
  const page = loadPage('pages/order/recept_checkin.js', {
    scanReceptCheckinPromise: async () => view,
    verifyReceptCheckinPhonePromise: async () => verifyView || { stage: 'waiting' },
    getReceptCheckinByCustomerPromise: async () => null,
  })
  page.setData({ code: 'rc_x' })
  const log = []
  page._startPolling = () => { log.push('poll') }
  page._stopPolling = () => {}
  page.gotoPay = () => { log.push('pay') }
  page.profilePromptDelay = PROFILE_DELAY_FOR_TEST
  t.after(() => { if (page._stopProfileTimer) page._stopProfileTimer() })
  return { page, log }
}

const afterDelay = () => new Promise(resolve => setTimeout(resolve, PROFILE_DELAY_FOR_TEST * 6 + 20))

test('接待报到：间隔默认是 5 秒', () => {
  installGlobals({ after() {} })
  const page = loadPage('pages/order/recept_checkin.js', {})
  assert.equal(page.profilePromptDelay, 5000)
})

test('接待报到：手机号已绑的会员扫码后进入等待开单，页面状态和轮询立刻定下来，约 5 秒后才弹昵称头像', async t => {
  const { page, log } = checkinPage(t, { stage: 'waiting', maskedCell: '189****2780' })
  page.profilePromptDelay = 60
  const gate = withProfileGate(page, log)
  page.checkin()
  await settle()
  assert.equal(page.data.state, 'waiting')
  assert.deepEqual(log, ['poll'], '刚扫完码还不弹')
  await new Promise(resolve => setTimeout(resolve, 120))
  assert.deepEqual(log.sort(), ['ensure', 'poll'], '过了间隔才弹')
  gate.resolve()
})

test('接待报到：没授权手机号的先提示授权手机号，这时不弹昵称头像', async t => {
  const { page, log } = checkinPage(t, { stage: 'need_phone' })
  withProfileGate(page, log)
  page.checkin()
  await afterDelay()
  assert.equal(page.data.state, 'need_phone')
  assert.deepEqual(log, [], '手机号这一步没做完，不抢着问昵称头像')
})

test('接待报到：授权了手机号 → 先继续等店员开单，等间隔之后才弹昵称头像（不是授权完立刻弹）', async t => {
  const { page, log } = checkinPage(t, { stage: 'need_phone' }, { stage: 'waiting' })
  page.profilePromptDelay = 60
  withProfileGate(page, log)
  await page.onGetPhoneNumber(PHONE_OK)
  await settle()
  assert.equal(page.data.state, 'waiting')
  assert.ok(!log.includes('ensure'), '授权完立刻不弹')
  await new Promise(resolve => setTimeout(resolve, 120))
  assert.ok(log.includes('ensure'), '过了间隔才弹')
})

test('接待报到：跳过 / 拒绝授权手机号，一样等间隔之后问昵称头像；页面还停在授权手机号，之后仍可以授权', async t => {
  const { page, log } = checkinPage(t, { stage: 'need_phone' })
  page.profilePromptDelay = 60
  withProfileGate(page, log)
  page.checkin()
  await settle()
  await page.onGetPhoneNumber(PHONE_DENIED)
  assert.equal(page.data.state, 'need_phone')
  assert.deepEqual(log, [], '拒绝后立刻不弹')
  await new Promise(resolve => setTimeout(resolve, 120))
  assert.deepEqual(log, ['ensure'])
  assert.equal(page.data.state, 'need_phone', '还在等他授权手机号')
})

test('接待报到：付款阶段（微信付款、支付宝）、过期、异常都不问；微信付款直接去付款页', async t => {
  for (const view of [{ stage: 'alipay' }, { stage: 'wepay', paymentId: 9 }, { stage: 'expired' }, { stage: 'bogus' }]) {
    const { page, log } = checkinPage(t, view)
    withProfileGate(page, log)
    page.checkin()
    await afterDelay()
    assert.ok(!log.includes('ensure'), JSON.stringify(view))
  }
})

test('接待报到：等待期间离开页面（隐藏、销毁、去付款页）就不再问', async t => {
  for (const leave of [p => p.onHide(), p => p.onUnload(), p => { p._leaving = true }]) {
    const { page, log } = checkinPage(t, { stage: 'waiting' })
    page.profilePromptDelay = 60
    withProfileGate(page, log)
    page.checkin()
    await settle()
    leave(page)
    await new Promise(resolve => setTimeout(resolve, 120))
    assert.ok(!log.includes('ensure'))
  }
})

test('接待报到：每次回到前台都会重新报到，但只有一个计时，不会叠出好几次；弹层组件记着已处理', async t => {
  const { page, log } = checkinPage(t, { stage: 'waiting' })
  page.profilePromptDelay = 60
  withProfileGate(page, log)
  page.checkin()
  page.checkin()
  page.checkin()
  await new Promise(resolve => setTimeout(resolve, 150))
  assert.equal(log.filter(x => x === 'ensure').length, 1)
})

test('接待报到：取不到弹层组件时不影响等待开单', async t => {
  const { page, log } = checkinPage(t, { stage: 'waiting' })
  page.selectComponent = () => null
  page.checkin()
  await afterDelay()
  assert.equal(page.data.state, 'waiting')
  assert.deepEqual(log, ['poll'])
})

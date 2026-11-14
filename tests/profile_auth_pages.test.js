// 顾客验证手机号之后授权头像和昵称（2026-11-14 用户要求）：所有顾客端手机号入口都接上 profile-auth 弹层。
//   1. 防遗漏：扫描所有非 legacy、非 staffadmin（店员绑定）且有 open-type="getPhoneNumber" 按钮的 wxml，
//      必须同时放 <profile-auth id="profileAuth" />，并且它的 js 里调 profileAuth.ensureOn(...)。以后谁新加手机号入口忘了接，这里失败。
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
const phoneEntries = [...walk('pages', []), ...walk('components', [])]
  .filter(rel => !/^pages[\\/](staffadmin|legacy)[\\/]/.test(rel) && !/^components[\\/]legacy[\\/]/.test(rel))
  .filter(rel => PHONE_BUTTON.test(fs.readFileSync(path.join(ROOT, rel), 'utf8')))

test('扫描能找到已知的顾客端手机号入口（防止扫描规则本身失效）', () => {
  const names = phoneEntries.map(p => p.replace(/\\/g, '/'))
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
    name: 'recept_checkin（接待报到）', file: 'pages/order/recept_checkin.js', handler: 'onGetPhoneNumber', next: 'applyView',
    data: { verifyReceptCheckinPhonePromise: () => Promise.resolve({ stage: 'waiting' }), getReceptCheckinByCustomerPromise: async () => null },
    prepare: page => { page.setData({ code: 'rc_x' }) },
  },
  {
    name: 'care_pick_verify（扫码取板）', file: 'pages/order/care_pick_verify.js', handler: 'onBindCell', next: 'verifyNow',
    data: { bindWechatCellPromise: () => Promise.resolve({ id: 7 }), verifyCarePickPromise: async () => ({}) },
  },
  {
    name: 'identity_verify（支付身份核验）', file: 'pages/order/identity_verify.js', handler: 'onBindCell', next: 'verifyNow',
    data: { bindWechatCellPromise: () => Promise.resolve({ id: 7 }), verifyWechatIdentityPromise: async () => ({}) },
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
  {
    name: 'punchcard_detail（次卡详情）', file: 'pages/punchcard/punchcard_detail.js', handler: 'onGetCell', next: 'onBuyNow',
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

function payIdentity(t, confirmResults) {
  installGlobals(t)
  const calls = []
  const comp = loadComponent('components/pay-identity-confirm/index.js', {
    confirmPayIdentityPromise: async body => { calls.push(body.action + (body.choice ? ':' + body.choice : '')); return confirmResults[body.action] || { status: 'direct' } },
  }, { paymentId: 5, payerType: 'wechat', scannerId: 's' })
  const log = []
  const origTrigger = comp.triggerEvent
  comp.triggerEvent = (name, detail) => { log.push(name); return origTrigger.call(comp, name, detail) }
  return { comp, calls, log }
}

for (const entry of [
  { handler: 'onGetPhoneNumber', desc: '手机号一键授权（phone_required）' },
  { handler: 'onGetPhoneNumberAndConfirmDirect', desc: '确认并继续（direct_to_scanner）' },
  { handler: 'onGetPhoneNumberAndChooseSelf', desc: '正常支付（choose_identity，没绑手机号）' },
]) {
  test(`pay-identity-confirm ${entry.desc}：手机号提交成功后先弹层，处理完才通知父页继续（refreshed）`, async t => {
    const { comp, log } = payIdentity(t, {})
    const gate = withProfileGate(comp, log)
    const done = comp[entry.handler](PHONE_OK)
    await settle()
    assert.ok(log.includes('ensure'), '提交手机号成功后要弹')
    assert.ok(!log.includes('refreshed'), '弹层没处理完，父页（付款页）不能继续自动支付')
    gate.resolve()
    await done
    await settle()
    assert.deepEqual(log.filter(x => x === 'ensure' || x === 'refreshed'), ['ensure', 'refreshed'])
  })
}

test('pay-identity-confirm 替人代付（没绑手机号）：手机号提交成功后同样先弹层再继续', async t => {
  const { comp, log } = payIdentity(t, {})
  global.wx.showModal = o => o.success({ confirm: true })
  const gate = withProfileGate(comp, log)
  comp.onGetPhoneNumberAndChooseProxy(PHONE_OK)
  await settle()
  assert.ok(log.includes('ensure'))
  assert.ok(!log.includes('refreshed'))
  gate.resolve()
  await settle()
  assert.deepEqual(log.filter(x => x === 'ensure' || x === 'refreshed'), ['ensure', 'refreshed'])
})

test('pay-identity-confirm：用户拒绝授权手机号 / 点普通确认按钮，不弹层，直接通知父页', async t => {
  for (const action of [c => c.onGetPhoneNumberAndConfirmDirect(PHONE_DENIED), c => c.onConfirmDirect(), c => c.onChooseSelf(),
    c => c.onGetPhoneNumberAndChooseSelf(PHONE_DENIED)]) {
    const { comp, log } = payIdentity(t, {})
    withProfileGate(comp, log)
    await action(comp)
    await settle()
    assert.ok(!log.includes('ensure'), '没验证手机号不弹')
    assert.ok(log.includes('refreshed'))
  }
})

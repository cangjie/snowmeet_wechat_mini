const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle } = require('./reception_harness.js')

const SHARE = 'pages/mine/ticket/ticket_share_mini.js'
const CLAIM = 'pages/mine/ticket/ticket_claim_mini/ticket_claim_mini.js'

function setup(t, file, options = {}) {
  const previous = { getApp: global.getApp, wx: global.wx }
  const calls = { follow: 0, accept: 0, shared: 0, fixed: 0, bind: 0, batch: [], redirects: [], toasts: [] }
  const app = {
    loginPromiseNew: Promise.resolve({ authenticated: options.authenticated !== false }),
    globalData: { sessionKey: options.emptySession ? '' : 'mini-session', member: options.newVisitor ? null : { id: 10 }, domainName: 'test.invalid', requestPrefix: 'https://test.invalid/api/' },
    retryLogin() {
      app.globalData.sessionKey = 'new-session'
      app.loginPromiseNew = Promise.resolve({ authenticated: true })
      return app.loginPromiseNew
    }
  }
  global.getApp = () => app
  global.wx = {
    showToast(value) { calls.toasts.push(value.title) },
    showModal(value) { calls.toasts.push(value.content) },
    redirectTo(value) { calls.redirects.push(value.url) }
  }
  const info = Object.assign({ batchId: 7, shareType: 'group', templateName: '测试券', claimed: false, soldOut: false }, options.info)
  const fake = {
    getTicket() { return Promise.resolve(options.ticket || { code: 'T1', member_id: 20, shared: 1, name: '测试券', memo: '规则一;规则二' }) },
    checkTransferFollowPromise() { calls.follow++; return Promise.resolve(false) },
    acceptMiniTicketPromise(code, memo, key) { calls.accept++; calls.acceptKey = key; return options.accept ? options.accept() : Promise.resolve({ code }) },
    getMiniShareBatchPromise(id, key) { calls.batch.push([id, key]); return Promise.resolve(info) },
    bindWechatCellPromise(encData, iv, key) { calls.bind++; calls.bindArgs = [encData, iv, key]; return Promise.resolve({ id: 20, cell: '13800000000' }) },
    claimMiniSharedTicketPromise(id, key) { calls.shared++; calls.sharedArgs = [id, key]; return options.claim ? options.claim() : Promise.resolve({ code: 'SHARED' }) },
    claimMiniQrCodeTicketPromise(id, key) { calls.fixed++; calls.fixedArgs = [id, key]; return options.claim ? options.claim() : Promise.resolve({ code: 'FIXED' }) }
  }
  const page = loadPage(file, fake)
  t.after(() => {
    if (page.onUnload) page.onUnload()
    if (previous.getApp === undefined) delete global.getApp; else global.getApp = previous.getApp
    if (previous.wx === undefined) delete global.wx; else global.wx = previous.wx
  })
  return { page, app, calls, info }
}

test('转赠页登录后直接展示接受，不查询公众号状态或启动轮询', async t => {
  const { page, calls } = setup(t, SHARE)
  page.onLoad({ code: 'T1' })
  await settle()
  assert.equal(calls.follow, 0)
  assert.equal(page.data.loading, false)
  assert.equal(page.data.canAccept, true)
  assert.equal(page._statusTimer, undefined)
})

test('转赠接受使用小程序会话，成功提示入账并进入券包', async t => {
  const { page, calls } = setup(t, SHARE)
  page.onLoad({ code: 'T1' })
  await settle()
  await page.accept()
  assert.equal(calls.accept, 1)
  assert.equal(calls.acceptKey, 'mini-session')
  assert.ok(calls.toasts.includes('优惠券已经入账'))
  assert.ok(calls.redirects.some(url => /ticket_list/.test(url)))
})

test('连续点击接受只提交一次，失败后允许手动重试', async t => {
  let reject
  const { page, calls } = setup(t, SHARE, { accept: () => new Promise((_, no) => { reject = no }) })
  page.onLoad({ code: 'T1' })
  await settle()
  const first = page.accept()
  page.accept()
  assert.equal(calls.accept, 1)
  reject('网络不通')
  await first
  await settle()
  assert.equal(page.data.accepting, false)
  assert.equal(page.data.canAccept, true)
})

test('已结束的转赠明确提示领取或撤回，不继续接受', async t => {
  const { page, calls } = setup(t, SHARE, { ticket: { code: 'T1', member_id: 20, shared: 0, memo: null } })
  page.onLoad({ code: 'T1' })
  await settle()
  assert.equal(page.data.canAccept, false)
  assert.match(page.data.message, /已被领取|撤回/)
  await page.accept()
  assert.equal(calls.accept, 0)
})

test('不能接受自己分享的券', async t => {
  const { page, calls } = setup(t, SHARE, { ticket: { code: 'T1', member_id: 10, shared: 1, memo: '' } })
  page.onLoad({ code: 'T1' })
  await settle()
  assert.equal(page.data.canAccept, false)
  await page.accept()
  assert.equal(calls.accept, 0)
})

test('未登录的转赠页不请求券详情，重新登录后才展示接受', async t => {
  const { page, calls } = setup(t, SHARE, { emptySession: true, authenticated: false })
  page.onLoad({ code: 'T1' })
  await settle()
  assert.equal(page.data.loginError, true)
  assert.equal(page.data.canAccept, false)
  await page.onRetry()
  assert.equal(page.data.canAccept, true)
  assert.equal(calls.follow, 0)
})

test('普通分享登录后显示领取按钮，不自动发券或要求关注', async t => {
  const { page, calls } = setup(t, CLAIM)
  page.onLoad({ batch: '7' })
  await settle()
  assert.deepEqual(calls.batch, [[7, 'mini-session']])
  assert.equal(calls.shared, 0)
  assert.equal(calls.fixed, 0)
  assert.equal(page.data.loading, false)
  assert.equal(page._timer, undefined)
  await page.onClaim()
  assert.equal(calls.shared, 1)
  assert.equal(page.data.doneCode, 'SHARED')
})

test('新访客先授权手机号建立会员，再加载并领取原卡片的券', async t => {
  const { page, app, calls } = setup(t, CLAIM, { newVisitor: true })
  page.onLoad({ batch: '7' })
  await settle()
  assert.equal(page.data.needMember, true)
  assert.equal(page.data.batchId, 7)
  assert.deepEqual(calls.batch, [])
  await page.onGetCell({ detail: { errMsg: 'getPhoneNumber:ok', encryptedData: 'encrypted', iv: 'iv' } })
  assert.deepEqual(calls.bindArgs, ['encrypted', 'iv', 'mini-session'])
  assert.equal(app.globalData.member.id, 20)
  assert.deepEqual(calls.batch, [[7, 'mini-session']])
  assert.equal(page.data.needMember, false)
  await page.onClaim()
  assert.equal(calls.shared, 1)
})

test('固定小程序码解析 scene，调用独立的固定码领取接口', async t => {
  const { page, calls } = setup(t, CLAIM, { info: { shareType: 'qrcode' } })
  page.onLoad({ scene: encodeURIComponent('batch=7') })
  await settle()
  assert.deepEqual(calls.batch, [[7, 'mini-session']])
  await page.onClaim()
  assert.equal(calls.shared, 0)
  assert.equal(calls.fixed, 1)
  assert.deepEqual(calls.fixedArgs, [7, 'mini-session'])
  assert.equal(page.data.doneCode, 'FIXED')
})

test('普通链接二维码正确解析 q 中的 batch', async t => {
  const { page, calls } = setup(t, CLAIM)
  page.onLoad({ q: encodeURIComponent('https://test.invalid/ticket?batch=7&channel=test') })
  await settle()
  assert.deepEqual(calls.batch, [[7, 'mini-session']])
})

test('缺失或畸形批次参数不发请求', async t => {
  const { page, calls } = setup(t, CLAIM)
  for (const options of [{}, { batch: '7x' }, { scene: '%' }, { batch: '-7' }, { batch: '2147483648' }]) {
    page.onLoad(options)
    await settle()
  }
  assert.deepEqual(calls.batch, [])
  assert.equal(page.data.loading, false)
})

test('已领过或领完时不能再次提交', async t => {
  const { page, calls } = setup(t, CLAIM, { info: { claimed: true, claimedCode: 'EXISTING' } })
  page.onLoad({ batch: '7' })
  await settle()
  await page.onClaim()
  assert.equal(calls.shared, 0)
  assert.equal(calls.fixed, 0)
  assert.equal(page.data.doneCode, 'EXISTING')
})

test('超过上限等业务失败只显示原因，不自动循环发券', async t => {
  const { page, calls } = setup(t, CLAIM, { claim: () => Promise.reject('同款券已达上限') })
  page.onLoad({ batch: '7' })
  await settle()
  await page.onClaim()
  await settle()
  assert.equal(calls.shared, 1)
  assert.match(page.data.errMsg, /上限/)
  assert.equal(page.data.claiming, false)
  assert.equal(calls.batch.length, 1)
})

test('登录失败不会查询批次或发券，可重新登录加载', async t => {
  const { page, calls } = setup(t, CLAIM, { emptySession: true, authenticated: false })
  page.onLoad({ batch: '7' })
  await settle()
  assert.deepEqual(calls.batch, [])
  assert.equal(page.data.loginError, true)
  await page.onRetry()
  assert.deepEqual(calls.batch, [[7, 'new-session']])
})

test('领取页连续点击只提交一次', async t => {
  let complete
  const { page, calls } = setup(t, CLAIM, { claim: () => new Promise(resolve => { complete = resolve }) })
  page.onLoad({ batch: '7' })
  await settle()
  const first = page.onClaim()
  page.onClaim()
  assert.equal(calls.shared, 1)
  complete({ code: 'DONE' })
  await first
  await settle()
  assert.equal(page.data.doneCode, 'DONE')
})

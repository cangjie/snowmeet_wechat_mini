// 分销商优惠券批次的领取页（用户 2026-11-18）：解析 token（c / scene / q）、各状态画面、领取时才生成券（服务端）、
// 还不是会员先授权手机号、每天一次 / 同批次一次 / 领完 / 过期 / 失效 / 本人 各给对应画面。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const api = require('../pages/coach/common/api.js')
const { loadPage } = require('./reception_harness.js')

const ROOT = path.join(__dirname, '..')
const PREFIX = 'https://x/api/'
const TOKEN = 'abcdef0123456789abcdef01'
const settle = () => new Promise(r => setTimeout(r, 40))
const OK = data => ({ code: 0, message: '', data })
const ERR = (code, message, data) => ({ code, message, data: data === undefined ? null : data })
const VIEW = (state, over) => ({
  view: Object.assign({ state, message: '', name: '某机构 万龙单项68元一口价券', memo: '凭券做养护', distributorName: '某机构', total: 10, claimed: 3, remaining: 7, validUntil: '2027-04-30T00:00:00' }, over),
  needMember: false
})

function setup(t, handler, extraApp) {
  const previous = { wx: global.wx, getApp: global.getApp }
  const calls = [], toasts = [], nav = []
  api.setTransport(options => {
    const [pathPart, query] = options.url.replace(PREFIX, '').split('?')
    const [controller, action] = pathPart.split('/')
    const params = {}
    ;(query || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); params[k] = decodeURIComponent(v) })
    calls.push({ controller, action, method: options.method, params, body: options.data })
    setImmediate(() => options.success({ statusCode: 200, data: handler(controller, action, params) }))
  })
  global.wx = { showToast: o => toasts.push(o.title), redirectTo: o => nav.push(o.url) }
  global.getApp = () => Object.assign({ loginPromiseNew: Promise.resolve(), retryLogin: () => Promise.resolve({ authenticated: true }), globalData: { sessionKey: 'sk%2B1', requestPrefix: PREFIX } }, extraApp)
  t.after(() => {
    api.setTransport(function (o) { wx.request(o) })
    if (previous.wx === undefined) delete global.wx; else global.wx = previous.wx
    if (previous.getApp === undefined) delete global.getApp; else global.getApp = previous.getApp
  })
  return { calls, toasts, nav }
}
const load = (fake) => loadPage('pages/coach/coupon_claim/coupon_claim.js', fake || {})

test('领取页：解析 token（c / scene / q），格式不对不请求', async t => {
  const s = setup(t, () => OK(VIEW('claimable')))
  const ok = load(); ok.onLoad({ c: TOKEN }); await settle()
  assert.equal(ok.data.token, TOKEN)
  assert.deepEqual([s.calls[0].controller, s.calls[0].action, s.calls[0].params.c], ['CouponBatch', 'GetShare', TOKEN])
  const viaScene = load(); viaScene.onLoad({ scene: encodeURIComponent('c=' + TOKEN) }); await settle()
  assert.equal(viaScene.data.token, TOKEN)
  const viaQ = load(); viaQ.onLoad({ q: encodeURIComponent('https://x/?c=' + TOKEN) }); await settle()
  assert.equal(viaQ.data.token, TOKEN)
  const before = s.calls.length
  for (const options of [{ c: 'x' }, { scene: 't=' + TOKEN }, {}, undefined]) {      // 会籍卡的 t= 不能当优惠券批次用
    const bad = load(); bad.onLoad(options); await settle()
    assert.equal(bad.data.errMsg, '领取链接不完整')
  }
  assert.equal(s.calls.length, before)
})

test('领取页：可领取显示券名、说明、分销商、剩余；点领取才调领取接口，成功显示券码', async t => {
  let claimed = false
  const s = setup(t, (c, a) => a === 'GetShare' ? OK(VIEW('claimable'))
    : (claimed = true, OK(VIEW('claimed_by_me', { code: 'AB12CD34E', claimed: 4, remaining: 6, message: '' }))))
  const page = load(); page.onLoad({ c: TOKEN }); await settle()
  assert.equal(page.data.state, 'claimable')
  assert.deepEqual([page.data.name, page.data.distributorName, page.data.total, page.data.remaining, page.data.validUntil], ['某机构 万龙单项68元一口价券', '某机构', 10, 7, '2027-04-30'])
  assert.equal(claimed, false, '打开页面只查看，不领取')
  await page.onClaim()
  assert.equal(claimed, true)
  const claim = s.calls.find(c => c.action === 'Claim')
  assert.deepEqual([claim.method, claim.params.c], ['POST', TOKEN])
  assert.equal(page.data.state, 'claimed_by_me'); assert.equal(page.data.code, 'AB12CD34E')
  assert.ok(s.toasts.includes('领取成功'))
  page.onGoMine(); assert.equal(s.nav.at(-1), '/pages/mine/ticket/ticket_list')
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/coach/coupon_claim/coupon_claim.wxml'), 'utf8')
  assert.match(wxml, /每人每天只能领取一张机构优惠券，同一批次只能领取一次/)
  assert.match(wxml, /券码 \{\{code\}\}/)
})

test('领取页：今天已领过 / 已领完 / 已过期 / 已失效 / 本人 / 已领取过这批 各显示对应画面，且不能再领', async t => {
  let state = 'daily_limit'
  const s = setup(t, () => OK(VIEW(state, { message: '提示文案', code: state === 'claimed_by_me' ? 'AB12CD34E' : null })))
  for (const st of ['daily_limit', 'sold_out', 'expired', 'invalid', 'self', 'claimed_by_me']) {
    state = st
    const p = load(); p.onLoad({ c: TOKEN }); await settle()
    assert.equal(p.data.state, st)
    const claimsBefore = s.calls.filter(c => c.action === 'Claim').length
  }
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/coach/coupon_claim/coupon_claim.wxml'), 'utf8')
  for (const st of ['daily_limit', 'sold_out', 'expired', 'invalid', 'self', 'claimed_by_me', 'claimable']) assert.match(wxml, new RegExp("state === '" + st + "'"), st)
  // 领取接口返回的状态（领取时才发现已经领完 / 今天领过了）同样显示对应画面，不是通用错误
  state = 'claimable'
  const racer = load(); racer.onLoad({ c: TOKEN }); await settle()
  api.setTransport(o => setImmediate(() => o.success({ statusCode: 200, data: o.url.includes('/Claim') ? OK(VIEW('sold_out', { message: '这批优惠券已经被领完了' })) : OK(VIEW('claimable')) })))
  await racer.onClaim()
  assert.equal(racer.data.state, 'sold_out')
  assert.equal(racer.data.errMsg, '')
})

test('领取页：还不是会员 → 授权手机号后弹头像昵称授权（可跳过，不强制）再自动领取；拒绝授权给出提示', async t => {
  let member = false; const bound = [], log = []
  const s = setup(t, (c, a) => a === 'GetShare' ? OK(Object.assign(VIEW('claimable'), { needMember: !member }))
    : (member ? OK(VIEW('claimed_by_me', { code: 'AB12CD34E' })) : ERR(5, '请先授权手机号')))
  const page = load({ bindWechatCellPromise: (enc, iv, sk) => { bound.push([enc, iv, sk]); member = true; return Promise.resolve({ id: 9 }) } })
  page.selectComponent = sel => { assert.equal(sel, '#profileAuth'); return { ensure(force) { log.push(force === true ? 'force' : 'ensure'); return Promise.resolve() } } }
  page.onLoad({ c: TOKEN }); await settle()
  assert.equal(page.data.needMember, true)
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/coach/coupon_claim/coupon_claim.wxml'), 'utf8')
  assert.match(wxml, /open-type="getPhoneNumber"[^>]*bindgetphonenumber="onPhone"/); assert.match(wxml, /<profile-auth id="profileAuth"/)
  await page.onPhone({ detail: {} }); assert.match(page.data.errMsg, /需要授权手机号/); assert.equal(bound.length, 0)
  await page.onPhone({ detail: { encryptedData: 'ENC', iv: 'IV' } })
  assert.deepEqual(bound, [['ENC', 'IV', 'sk%2B1']])
  assert.deepEqual(log, ['ensure'], '领取优惠券不强制头像昵称，只请顾客完善一次')
  assert.equal(page.data.state, 'claimed_by_me'); assert.equal(page.data.needMember, false); assert.equal(page.data.code, 'AB12CD34E')
  // 直接点领取时服务端说还不是会员（code 5）：转成手机号授权
  member = false
  const early = load(); early.onLoad({ c: TOKEN }); await settle()
  early.setData({ needMember: false })
  await early.onClaim()
  assert.equal(early.data.needMember, true); assert.equal(early.data.state, 'claimable')
})

test('领取页：登录失败可重试；登录失效（code 2）和网络错误给出提示；重复点击不会并发领取', async t => {
  const failing = setup(t, () => OK(VIEW('claimable')), { loginPromiseNew: Promise.resolve({ authenticated: false }) })
  const p = load(); p.onLoad({ c: TOKEN }); await settle()
  assert.equal(p.data.loginError, true); assert.equal(failing.calls.length, 0)

  let mode = 'busy'
  const s = setup(t, (c, a) => a === 'GetShare' ? OK(VIEW('claimable')) : mode === 'expired' ? ERR(2, '登录已失效，请重新进入小程序') : ERR(1, '服务暂时繁忙'))
  const q = load(); q.onLoad({ c: TOKEN }); await settle()
  await q.onClaim(); assert.equal(q.data.errMsg, '服务暂时繁忙'); assert.equal(q.data.state, 'claimable')
  mode = 'expired'
  await q.onClaim(); assert.equal(q.data.loginError, true)
  mode = 'busy'; q.setData({ loginError: false })
  const first = q.onClaim(); q.onClaim()                                           // 连点两下
  await first
  assert.equal(s.calls.filter(c => c.action === 'Claim').length, 3)                // 前两次 + 这一次连点只发一次
})

test('领取页：优惠券领取页注册在 coach 分包里，文件齐全，wxml 里的事件处理函数都在页面里', () => {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
  const coach = app.subPackages.find(x => x.root === 'pages/coach')
  assert.ok(coach.pages.includes('coupon_claim/coupon_claim'), '没有在 app.json 的 coach 分包里注册，扫码会打不开')
  const dir = 'pages/coach/coupon_claim/coupon_claim'
  for (const ext of ['js', 'wxml', 'json', 'wxss']) assert.ok(fs.existsSync(path.join(ROOT, dir + '.' + ext)), ext)
  JSON.parse(fs.readFileSync(path.join(ROOT, dir + '.json'), 'utf8'))
  const wxml = fs.readFileSync(path.join(ROOT, dir + '.wxml'), 'utf8')
  const js = fs.readFileSync(path.join(ROOT, dir + '.js'), 'utf8')
  for (const m of wxml.matchAll(/bind(?:tap|getphonenumber)="(\w+)"/g)) assert.match(js, new RegExp('\\b' + m[1] + '\\s*\\('), m[1])
  // 后端二维码落地页必须和这里一致
  assert.equal(require('../pages/coach/common/api.js').getCouponShare.length, 1)
})

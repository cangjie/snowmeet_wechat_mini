// 会员详情「扫码绑定」二维码下面加「转发给客人」按钮（2026-11-23 用户）：把绑定二维码以小程序卡片发给客人，客人点开卡片就是绑定页，授权手机号即可绑定。
// 卡片路径 /pages/member/wechat_bind?scene=<绑定码>，绑定页本来就从 options.scene 取绑定码，所以扫码和点卡片走同一条路。
// 绑定码由后端 MemberWechatBind/Create 返回（token）；旧后端没有这个字段时不显示转发按钮。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage } = require('./reception_harness.js')

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
const FILE = 'pages/admin/member/member_detail.js'
const TOKEN = '0123456789abcdef01234567'

function setup(t) {
  const previous = { wx: global.wx, getApp: global.getApp }
  global.getApp = () => ({ globalData: { sessionKey: 'sk', domainName: 'mini.snowmeet.top', requestPrefix: 'https://mini.snowmeet.top/api/', staff: { valid: 1, title_level: 300 } }, loginPromiseNew: Promise.resolve() })
  global.wx = { showToast() {}, getAccountInfoSync() { return { miniProgram: { envVersion: 'release' } } } }
  const page = loadPage(FILE, {})
  t.after(() => {
    if (previous.wx === undefined) delete global.wx; else global.wx = previous.wx
    if (previous.getApp === undefined) delete global.getApp; else global.getApp = previous.getApp
  })
  return page
}

test('模板：二维码弹层里有「转发给客人」按钮（open-type="share"），只在有绑定码时显示，放在二维码下面、关闭按钮上面', () => {
  const wxml = read('pages/admin/member/member_detail.wxml')
  const popup = wxml.slice(wxml.indexOf('wechatBindShow'), wxml.indexOf('标签编辑弹层'))
  const button = popup.match(/<button[^>]*open-type="share"[^>]*>[^<]*<\/button>/)
  assert.ok(button, '转发按钮')
  assert.match(button[0], /wx:if="\{\{wechatBindToken\}\}"/)
  assert.match(button[0], /class="bind-share-btn"/)
  assert.doesNotMatch(button[0], /size="mini"/)
  assert.match(button[0], /转发给客人/)
  assert.ok(popup.indexOf('bind-qr-image') < popup.indexOf('open-type="share"'), '在二维码下面')
  assert.ok(popup.indexOf('open-type="share"') < popup.indexOf('modal-foot'), '在关闭/重新生成按钮上面')
})

test('样式：转发按钮用自己的样式（高度 88rpx、行高一致、无上下内边距、无边框），不被 app.wxss 的全局按钮样式切字', () => {
  const wxss = read('pages/admin/member/member_detail.wxss')
  const rule = (wxss.match(/\.modal \.bind-share-btn\s*\{([^}]*)\}/) || [])[1] || ''
  assert.match(rule, /height:\s*88rpx/)
  assert.match(rule, /line-height:\s*88rpx/)
  assert.match(rule, /padding:\s*0\b/)
  assert.match(rule, /border:\s*none/)
  assert.match(wxss, /\.modal \.bind-share-btn::after\s*\{[^}]*border:\s*none/)
})

test('生成二维码成功后记下绑定码；关闭、过期、图片失败、重新生成、离开页面时清掉', () => {
  const js = read(FILE)
  assert.match(js, /showPoints:\s*false/)                                   // 别的改动不能被冲掉
  assert.match(js, /wechatBindToken:\s*''/)                                 // data 里有这个字段，默认空
  assert.match(js, /wechatBindToken:\s*\(qr && qr\.token\)\s*\|\|\s*''/)    // 创建成功：取后端返回的 token，没有就是空
  const clears = (js.match(/wechatBindToken:\s*''/g) || []).length
  assert.ok(clears >= 5, '至少在 data 初始值、重新生成、关闭、过期、图片失败 5 处写成空，实际 ' + clears)
})

test('转发：卡片路径是绑定页 + 绑定码，标题写清楚怎么做，用公司 logo 做封面', t => {
  const page = setup(t)
  page.setData({ wechatBindToken: TOKEN })
  const card = page.onShareAppMessage({ from: 'button', target: {} })
  assert.equal(card.path, '/pages/member/wechat_bind?scene=' + TOKEN)
  assert.match(card.title, /绑定微信/)
  assert.match(card.title, /手机号/)
  assert.equal(card.imageUrl, 'https://mini.snowmeet.top/images/snowmeet_logo.png')
})

test('转发的路径正是绑定页认得的格式：绑定页从 options.scene 取 24 位十六进制绑定码', () => {
  assert.ok(/^\/pages\/member\/wechat_bind\?scene=[0-9a-f]{24}$/.test('/pages/member/wechat_bind?scene=' + TOKEN))
  assert.match(read('pages/member/wechat_bind.js'), /\^\[0-9a-f\]\{24\}\$/)
  assert.match(read('pages/member/wechat_bind.js'), /options\.scene/)
  const app = JSON.parse(read('app.json'))
  assert.ok(app.pages.includes('pages/member/wechat_bind'), '绑定页已注册')
})

test('没有绑定码（旧后端、已关闭）时不转发任何会员页面：返回空', t => {
  const page = setup(t)
  assert.deepEqual(page.onShareAppMessage({ from: 'button', target: {} }), {})
  page.setData({ wechatBindToken: 'not-a-token' })
  assert.deepEqual(page.onShareAppMessage({ from: 'button', target: {} }), {})   // 不是 24 位十六进制不信
  page.setData({ wechatBindToken: TOKEN })
  assert.deepEqual(page.onShareAppMessage({ from: 'menu' }), {})                  // 右上角菜单转发不带绑定码
})

test('页面右上角菜单的「转发」隐藏：会员详情是店员页面，不能被随手转发出去', () => {
  const js = read(FILE)
  assert.match(js, /wx\.hideShareMenu/)
})

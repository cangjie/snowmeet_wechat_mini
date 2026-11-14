// 接待·顾客信息页「这是测试订单」勾选：
//   · 放在顾客信息卡片里「联系电话」那一行的右边（不再单独占一行）；
//   · 测试号（登录会员手机尾号 7897）勾选直接生效；其他店员勾选先弹窗确认，确认才勾上，取消保持未勾；
//   · 取消勾选不需要确认；勾上以后开单仍带 isTest=1。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, tap } = require('./reception_harness.js')

const PAGE = 'pages/admin/reception/recept_member.js'
const wxml = fs.readFileSync(path.join(__dirname, '..', PAGE.replace('.js', '.wxml')), 'utf8')

function load(staffMember, modalAnswer) {
  const modals = []
  const nav = []
  const globalData = { sessionKey: 'sk' }
  if (staffMember !== undefined) globalData.member = staffMember
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData })
  global.wx = {
    showModal(o) { modals.push(o); if (modalAnswer !== 'pending' && o.success) o.success({ confirm: modalAnswer !== 'cancel' }) },
    showToast() {},
    setStorageSync() {},
    navigateTo(o) { nav.push(o.url) }
  }
  const page = loadPage(PAGE, {})
  delete global.getApp
  return { page, modals, nav, globalData }
}
function done() { delete global.wx }

// ---- 位置 ----
test('勾选框放在页面内容的最上面：是内容区的第一个元素，在顾客信息卡片之前；页面上只有这一处', () => {
  const main = wxml.slice(wxml.indexOf('<view class="main">') + '<view class="main">'.length)
  const first = main.match(/<view\b[^>]*>/)[0]
  assert.match(first, /class="test-row[^"]*"/)
  assert.match(first, /bindtap="onTestToggle"/)
  assert.ok(main.indexOf('onTestToggle') < main.indexOf('顾客基本信息'), '在顾客信息卡片之前')
  assert.ok(main.indexOf('onTestToggle') < main.indexOf('member-waiting'), '在等待授权提示之前')
  assert.ok(main.indexOf('onTestToggle') < main.indexOf('当前店铺'), '在选店铺之前')
  assert.equal((wxml.match(/bindtap="onTestToggle"/g) || []).length, 1)
  assert.equal((wxml.match(/这是测试订单/g) || []).length, 1)
})

test('勾选框不在顾客信息卡片里，也不在店铺和业务类型之间；等顾客授权手机号时同样看得到', () => {
  const card = wxml.slice(wxml.indexOf('<!-- 顾客基本信息 -->'), wxml.indexOf('<!-- 选择店铺'))
  assert.doesNotMatch(card, /test-row|onTestToggle|这是测试订单/)
  const between = wxml.slice(wxml.indexOf('<!-- 选择店铺'), wxml.indexOf('<!-- 选择业务 -->'))
  assert.doesNotMatch(between, /test-row|onTestToggle|这是测试订单/)
  const row = wxml.slice(wxml.indexOf('<view class="test-row'), wxml.indexOf('<!-- 新顾客'))
  assert.doesNotMatch(row, /wx:if="\{\{!?waitingPhone/)
  assert.match(row, /test-note/)   // 勾上后的小字提示还在
})

// ---- 勾选规则 ----
test('不是测试号的店员勾选：先弹窗确认，点确认才勾上', () => {
  const { page, modals } = load({ id: 9, cell: '13800138000' }, 'confirm')
  page.onTestToggle()
  assert.equal(modals.length, 1)
  assert.equal(modals[0].title, '确认测试订单')
  assert.match(modals[0].content, /确认这是一张测试订单吗/)
  assert.equal(modals[0].confirmText, '确认')
  assert.equal(modals[0].cancelText, '取消')
  assert.equal(page.data.isTest, true)
  done()
})

test('不是测试号的店员勾选后在弹窗点取消：保持未勾选；弹窗还没回答之前也不会先勾上', () => {
  const cancelled = load({ id: 9, cell: '13800138000' }, 'cancel')
  cancelled.page.onTestToggle()
  assert.equal(cancelled.modals.length, 1)
  assert.equal(cancelled.page.data.isTest, false)
  done()
  const pending = load({ id: 9, cell: '13800138000' }, 'pending')
  pending.page.onTestToggle()
  assert.equal(pending.modals.length, 1)
  assert.equal(pending.page.data.isTest, false)
  done()
})

test('手机尾号 7897 的店员（绑定号）勾选：直接勾上，不弹窗', () => {
  const { page, modals } = load({ id: 28, cell: '13501177897' }, 'confirm')
  page.onTestToggle()
  assert.deepEqual(modals, [])
  assert.equal(page.data.isTest, true)
  done()
})

test('登记的号码里有尾号 7897 的也算测试号；只有「尾号」是 7897 才算，号码中间出现 7897 不算', () => {
  const viaAccount = load({ id: 28, cell: '13800138000', memberSocialAccounts: [{ type: 'cell', num: '18601197897' }] }, 'confirm')
  viaAccount.page.onTestToggle()
  assert.deepEqual(viaAccount.modals, [])
  assert.equal(viaAccount.page.data.isTest, true)
  done()
  const middle = load({ id: 9, cell: '13789712345', memberSocialAccounts: [{ type: 'cell', num: '15878971234' }] }, 'confirm')
  middle.page.onTestToggle()
  assert.equal(middle.modals.length, 1)
  done()
})

test('登录会员信息缺失（没有会员 / 没有手机号）：按普通店员处理，要确认', () => {
  for (const member of [undefined, null, {}, { id: 3, cell: null }, { id: 3, cell: '' }]) {
    const { page, modals } = load(member, 'cancel')
    page.onTestToggle()
    assert.equal(modals.length, 1, JSON.stringify(member))
    assert.equal(page.data.isTest, false)
    done()
  }
})

test('取消勾选不需要确认（普通店员也是）；再勾又要确认', () => {
  const { page, modals } = load({ id: 9, cell: '13800138000' }, 'confirm')
  page.onTestToggle()
  assert.equal(page.data.isTest, true)
  assert.equal(modals.length, 1)
  page.onTestToggle()
  assert.equal(page.data.isTest, false)
  assert.equal(modals.length, 1)
  page.onTestToggle()
  assert.equal(modals.length, 2)
  assert.equal(page.data.isTest, true)
  done()
})

// ---- 勾上以后开单照旧带 isTest=1 ----
function openBiz(page) {
  page.setData({ waitingPhone: false, shop: '万龙服务中心', care: 1, sale: 1, rent: 1, form: { cell: '', name: '', gender: '' }, member: null })
  page.onBizTap(tap({ type: 'maintain' }))
}

test('确认过的测试单，进开单页的地址带 isTest=1；没勾（或取消了）就不带', () => {
  const yes = load({ id: 9, cell: '13800138000' }, 'confirm')
  yes.page.onTestToggle()
  openBiz(yes.page)
  assert.equal(yes.nav.length, 1)
  assert.match(yes.nav[0], /[?&]isTest=1(&|$)/)
  done()
  const no = load({ id: 9, cell: '13800138000' }, 'cancel')
  no.page.onTestToggle()
  openBiz(no.page)
  assert.equal(no.nav.length, 1)
  assert.doesNotMatch(no.nav[0], /isTest/)
  done()
})

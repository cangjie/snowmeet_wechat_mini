// 「我的优惠券」按券种分组（2026-11-19 用户要求）：同一种券合并成一张「免费打蜡券 × N」，点开看每一张；
// 只有一张的券种照旧直接显示那张券。只改前端：后端接口、券的字段都不动。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const helper = require('../pages/mine/ticket/ticket_helper.js')
const { loadPage, settle, tap } = require('./reception_harness.js')

const WAX = { name: '免费打蜡券', template_id: 12, bannerLabel: '机打蜡', bannerCls: 'wax' }
const OLD = { name: '老顾客优惠券', template_id: 16, bannerLabel: '优惠', bannerCls: 'discount' }
const EDGE = { name: '修刃体验券', template_id: 20, bannerLabel: '修刃', bannerCls: 'edge' }
const T = (code, kind, over) => Object.assign({ code, expireText: '2027.4.30', expireUrgent: false, displayTimeText: '2026-08-15 17:02',
  displayTimeLabel: '领取时间', memo: '', used: 0, shared: 0, muted: false }, kind, over)

// ---------- 纯函数：groupTickets / buildRows ----------

test('按券种名分组：时间相同时组按「第一张出现的位置」排，组内保持原来的顺序', () => {
  const list = [T('a1', WAX), T('o1', OLD), T('a2', WAX), T('e1', EDGE), T('a3', WAX), T('o2', OLD)]
  const groups = helper.groupTickets(list, {}, 'pending')
  assert.deepEqual(groups.map(g => [g.name, g.count]), [['免费打蜡券', 3], ['老顾客优惠券', 2], ['修刃体验券', 1]])
  assert.deepEqual(groups[0].tickets.map(t => t.code), ['a1', 'a2', 'a3'])
  assert.deepEqual(groups[1].tickets.map(t => t.code), ['o1', 'o2'])
})

test('同一券种多张才是「组」；只有一张的照旧直接显示那张券', () => {
  const groups = helper.groupTickets([T('a1', WAX), T('a2', WAX), T('e1', EDGE)], {}, 'pending')
  assert.equal(groups[0].single, false)
  assert.equal(groups[0].countText, '× 2')
  assert.equal(groups[1].single, true)
})

test('组头沿用这个券种的 banner（类别字、图案、券名）', () => {
  const g = helper.groupTickets([T('a1', WAX), T('a2', WAX)], {}, 'pending')[0]
  assert.deepEqual([g.bannerLabel, g.bannerCls, g.name], ['机打蜡', 'wax', '免费打蜡券'])
})

test('汇总文字：未使用「N 张可用」，已使用「N 张已使用」，已分享「N 张已分享」', () => {
  const two = [T('a1', WAX), T('a2', WAX)]
  assert.equal(helper.groupTickets(two, {}, 'pending')[0].summaryText, '2 张可用')
  assert.equal(helper.groupTickets(two, {}, 'used')[0].summaryText, '2 张已使用')
  assert.equal(helper.groupTickets(two, {}, 'shared')[0].summaryText, '2 张已分享')
})

test('未使用的组头写最近到期日；有临期的另外标红说明几张 30 天内到期', () => {
  const list = [T('a1', WAX, { expireText: '2027.4.30' }), T('a2', WAX, { expireText: '2026.12.5', expireUrgent: true }), T('a3', WAX, { expireText: '2026.12.20', expireUrgent: true })]
  const g = helper.groupTickets(list, {}, 'pending')[0]
  assert.equal(g.expireLine, '最近到期 2026.12.5')
  assert.equal(g.urgentCount, 2)
  assert.equal(g.urgentLine, '其中 2 张 30 天内到期')
  const none = helper.groupTickets([T('a1', WAX), T('a2', WAX)], {}, 'pending')[0]
  assert.equal(none.urgentCount, 0)
  assert.equal(none.urgentLine, '')
})

test('到期日按真实日期比，不按字符串比（2026.12.5 早于 2026.12.20，2027.4.30 最晚）', () => {
  const list = [T('a1', WAX, { expireText: '2026.12.20' }), T('a2', WAX, { expireText: '2026.12.5' }), T('a3', WAX, { expireText: '2027.4.30' })]
  assert.equal(helper.groupTickets(list, {}, 'pending')[0].expireLine, '最近到期 2026.12.5')
})

test('长期有效的券和有到期日的券放一组：以有到期日的为准；全是长期有效就写长期有效', () => {
  const mixed = helper.groupTickets([T('a1', WAX, { expireText: '长期有效' }), T('a2', WAX, { expireText: '2027.4.30' })], {}, 'pending')[0]
  assert.equal(mixed.expireLine, '最近到期 2027.4.30')
  const forever = helper.groupTickets([T('a1', WAX, { expireText: '长期有效' }), T('a2', WAX, { expireText: '长期有效' })], {}, 'pending')[0]
  assert.equal(forever.expireLine, '长期有效')
})

test('已使用、已分享的组头不写到期日', () => {
  for (const tab of ['used', 'shared']) {
    const g = helper.groupTickets([T('a1', WAX), T('a2', WAX)], {}, tab)[0]
    assert.equal(g.expireLine, '')
    assert.equal(g.urgentLine, '')
  }
})

test('展开状态按券种记：openKeys 里有的组 open = true', () => {
  const groups = helper.groupTickets([T('a1', WAX), T('a2', WAX), T('o1', OLD), T('o2', OLD)], { '免费打蜡券': true }, 'pending')
  assert.deepEqual(groups.map(g => g.open), [true, false])
})

test('整组都失效（已使用/对方已接受）才降灰；有一张还有效就不降灰', () => {
  assert.equal(helper.groupTickets([T('a1', WAX, { muted: true }), T('a2', WAX, { muted: true })], {}, 'used')[0].muted, true)
  assert.equal(helper.groupTickets([T('a1', WAX, { muted: true }), T('a2', WAX)], {}, 'shared')[0].muted, false)
})

test('没有券名的券按模板 id 分，不会全混成一组', () => {
  const groups = helper.groupTickets([T('x1', { name: '', template_id: 5 }), T('x2', { name: '', template_id: 6 }), T('x3', { name: '  ', template_id: 5 })], {}, 'pending')
  assert.deepEqual(groups.map(g => g.count), [2, 1])
})

test('buildRows：收起的组只有一行组头；展开后组头后面跟着每一张；单张的券直接一行', () => {
  const list = [T('a1', WAX), T('a2', WAX), T('e1', EDGE)]
  const collapsed = helper.buildRows(helper.groupTickets(list, {}, 'pending'))
  assert.deepEqual(collapsed.map(r => [r.rowType, r.rowKey]), [['group', 'g:免费打蜡券'], ['card', 'e1']])
  const open = helper.buildRows(helper.groupTickets(list, { '免费打蜡券': true }, 'pending'))
  assert.deepEqual(open.map(r => [r.rowType, r.rowKey]), [['group', 'g:免费打蜡券'], ['card', 'a1'], ['card', 'a2'], ['card', 'e1']])
  assert.equal(open[1].inGroup, true)
  assert.equal(open[3].inGroup, false)
  assert.equal(open[1].name, '免费打蜡券')          // 卡片行带着券自己的全部字段，模板里照旧写 item.xxx
  assert.equal(open[1].code, 'a1')
})

// ---------- 页面：onLoad / 展开 / 排序 / 移除 ----------

function setup(t, tickets, tab) {
  const previous = { wx: global.wx, getApp: global.getApp }
  global.getApp = () => ({ globalData: { sessionKey: 'sk', domainName: 'test.invalid' }, loginPromiseNew: Promise.resolve() })
  global.wx = { showToast() {}, showModal() {}, navigateTo(o) { global.__navigated = (global.__navigated || []).concat(o.url) } }
  const fake = {
    getMyTickets() { return Promise.resolve(JSON.parse(JSON.stringify(tickets))) },
    getMySharedTicketsPromise() { return Promise.resolve(JSON.parse(JSON.stringify(tickets))) },
    getMyAcceptedTicketsPromise(sessionKey) { fake.acceptedCalls.push(sessionKey); return Promise.resolve(JSON.parse(JSON.stringify(tickets))) },
    acceptedCalls: []
  }
  const page = loadPage('pages/mine/ticket/ticket_list.js', fake)
  page._fake = fake
  page.onLoad({ tab: tab || 'pending' })
  t.after(() => {
    if (previous.wx === undefined) delete global.wx; else global.wx = previous.wx
    if (previous.getApp === undefined) delete global.getApp; else global.getApp = previous.getApp
  })
  return page
}

const MANY = [T('a1', WAX), T('a2', WAX), T('a3', WAX), T('o1', OLD), T('o2', OLD), T('e1', EDGE)]

test('页面：未使用 tab 按券种分组，汇总行和角标仍按总张数算', async t => {
  const page = setup(t, MANY)
  await settle()
  assert.equal(page.data.ticketArr.length, 6)                    // 平铺的券一张不少，转赠、详情、分享都靠它
  assert.equal(page.data.summaryText, '6 张可用')
  assert.equal(page.data.pendingCount, 6)
  assert.deepEqual(page.data.rowArr.map(r => r.rowType + ':' + r.rowKey), ['group:g:免费打蜡券', 'group:g:老顾客优惠券', 'card:e1'])
})

test('页面：点组头展开，再点收起；展开的是这一组', async t => {
  const page = setup(t, MANY)
  await settle()
  page.onToggleGroup(tap({ key: '免费打蜡券' }))
  assert.deepEqual(page.data.rowArr.map(r => r.rowKey), ['g:免费打蜡券', 'a1', 'a2', 'a3', 'g:老顾客优惠券', 'e1'])
  assert.equal(page.data.rowArr[0].open, true)
  page.onToggleGroup(tap({ key: '免费打蜡券' }))
  assert.deepEqual(page.data.rowArr.map(r => r.rowKey), ['g:免费打蜡券', 'g:老顾客优惠券', 'e1'])
})

test('页面：分享出去一张后，组里的张数跟着减；减到只剩一张就变回普通的券', async t => {
  const page = setup(t, [T('o1', OLD), T('o2', OLD), T('e1', EDGE)])
  await settle()
  assert.equal(page.data.rowArr[0].count, 2)
  page._removeTicketFromList('o1')
  assert.deepEqual(page.data.rowArr.map(r => r.rowType + ':' + r.rowKey), ['card:o2', 'card:e1'])
  assert.equal(page.data.summaryText, '2 张可用')
})

test('页面：切换排序只改组里每一张的顺序，组的顺序始终按最新获得时间（见下面「券种排序」）', async t => {
  const list = [T('a1', WAX, { expireText: '2027.4.30', displayTimeText: '2026-08-01 10:00' }), T('o1', OLD, { expireText: '2026.12.1', displayTimeText: '2026-09-01 10:00' }),
    T('a2', WAX, { expireText: '2027.5.1', displayTimeText: '2026-10-01 10:00' }), T('o2', OLD, { expireText: '2026.12.2', displayTimeText: '2026-07-01 10:00' })]
  const page = setup(t, list)
  await settle()
  page.onToggleGroup(tap({ key: '免费打蜡券' }))
  assert.deepEqual(page.data.rowArr.map(r => r.rowKey), ['g:免费打蜡券', 'a1', 'a2', 'g:老顾客优惠券'])      // 免费打蜡券最新获得 10-01 > 老顾客券 09-01；组里按有效期
  page.onToggleSort()
  assert.deepEqual(page.data.rowArr.map(r => r.rowKey), ['g:免费打蜡券', 'a2', 'a1', 'g:老顾客优惠券'])      // 组还在最前，组里改按获得时间（新的在前）
})

test('页面：已使用、已分享 tab 也分组；已使用的组整组降灰', async t => {
  const used = [T('a1', WAX, { used: 1 }), T('a2', WAX, { used: 1 })]
  const page = setup(t, used, 'used')
  await settle()
  assert.equal(page.data.rowArr.length, 1)
  assert.equal(page.data.rowArr[0].summaryText, '2 张已使用')
  assert.equal(page.data.rowArr[0].muted, true)
  const shared = setup(t, [T('a1', WAX, { shared: 1 }), T('a2', WAX, { shared: 1 })], 'shared')
  await settle()
  assert.equal(shared.data.rowArr[0].summaryText, '2 张已分享')
})

// ---------- 模板 ----------

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')

test('模板：列表遍历 rowArr；组头有 × N、汇总、展开收起；卡片里的转赠、撤回分享、使用说明、详情都还在', () => {
  const wxml = read('pages/mine/ticket/ticket_list.wxml')
  assert.match(wxml, /wx:for="\{\{rowArr\}\}"[^>]*wx:key="rowKey"/)
  assert.match(wxml, /rowType == 'group'/)
  assert.match(wxml, /bindtap="onToggleGroup"/)
  assert.match(wxml, /\{\{item\.countText\}\}/)
  assert.match(wxml, /\{\{item\.summaryText\}\}/)
  assert.match(wxml, /\{\{item\.expireLine\}\}/)
  assert.match(wxml, /\{\{item\.urgentLine\}\}/)
  for (const keep of ['bindtap="onTransferTap"', 'bindtap="onCancelShare"', 'bindtap="onToggleUsage"', 'bindtap="showDetail"', '转赠好友', '撤回分享']) {
    assert.ok(wxml.includes(keep), keep)
  }
  assert.doesNotMatch(wxml, /wx:for="\{\{ticketArr\}\}"/)
  assert.match(wxml, /ticketArr\.length == 0/)                   // 空状态仍按券的总数判断
})

test('样式：组头的数量、展开箭头、组内券的缩进都有样式', () => {
  const wxss = read('pages/mine/ticket/ticket_list.wxss')
  for (const cls of ['.group-count', '.group-summary', '.group-arrow', '.ticket-card--in-group']) assert.ok(wxss.includes(cls), cls)
})

// ---------- 2026-11-19 用户：展开后重复的内容不要显示；按钮文字样式要修（文字偏上、太粗） ----------

test('模板：展开后组里的券不再显示 banner（券种名和类别字和组头重复）；单张的券、独立显示的券仍有 banner', () => {
  const wxml = read('pages/mine/ticket/ticket_list.wxml')
  const card = wxml.slice(wxml.indexOf('<view wx:else class="ticket-card'))
  assert.match(card, /<view wx:if="\{\{!item\.inGroup\}\}" class="tk-banner tk-banner--\{\{item\.bannerCls\}\}/)
  // 组头那张汇总卡的 banner 照旧有
  assert.match(wxml.slice(0, wxml.indexOf('<view wx:else class="ticket-card')), /class="tk-banner tk-banner--\{\{item\.bannerCls\}\}/)
  // 点券看详情不靠 banner：票根那一行也能点
  assert.match(card, /<view class="stub-row[^"]*"[^>]*id="\{\{item\.code\}\}"[^>]*bindtap="showDetail"/)
})

test('样式：卡片按钮文字垂直居中——固定高度 + 同高的行高 + 不留上下内边距，字重不要太粗', () => {
  const wxss = read('pages/mine/ticket/ticket_card.wxss')
  const rule = (wxss.match(/\n\.btn\s*\{([^}]*)\}/) || [])[1] || ''
  assert.match(rule, /display:\s*block/)
  assert.match(rule, /height:\s*88rpx/)
  assert.match(rule, /line-height:\s*88rpx/)
  assert.match(rule, /padding:\s*0\b/)
  assert.doesNotMatch(rule, /font-weight:\s*700/)
})

// ---------- 2026-11-19 用户（第二次）：按钮文字还是偏上，而且要大一些 ----------
// 根因：按钮写了 size="mini"，微信内置的 button[size=mini]（字号 13px、行高 2.3、左右内边距 1.34em）优先级比 .btn 高，
// 上一次改的行高和字号被盖掉了。所以这里不能再用 size="mini"，字号也要比原来的大。

test('模板：券卡片上的操作按钮不用 size="mini"（它的内置样式会盖掉 .btn 的字号和行高）', () => {
  for (const file of ['pages/mine/ticket/ticket_list.wxml', 'pages/mine/ticket/ticket_detail.wxml', 'pages/mine/ticket/ticket_share_mini.wxml', 'pages/mine/ticket/ticket_share.wxml']) {
    const wxml = read(file)
    const buttons = wxml.match(/<button[^>]*class="btn[^"]*"[^>]*>/g) || []
    assert.ok(buttons.length > 0, file)
    for (const b of buttons) assert.doesNotMatch(b, /size="mini"/, file + '：' + b)
  }
})

test('样式：.btn 字号 34rpx（比原来的 30rpx 大），行高和高度仍同为 88rpx', () => {
  const wxss = read('pages/mine/ticket/ticket_card.wxss')
  const rule = (wxss.match(/\n\.btn\s*\{([^}]*)\}/) || [])[1] || ''
  assert.match(rule, /font-size:\s*34rpx/)
  assert.match(rule, /line-height:\s*88rpx/)
  assert.match(rule, /height:\s*88rpx/)
})

// ---------- 2026-11-19 用户：券种按「最后得到的时间」倒序 ----------
// 不论是系统赠送、订单赠送还是别人转赠，只要某个券种有刚得到的券，这个券种就排到最前。
// 时间用后端下发的 displayTimeText（未使用：转赠来的是领取时间、自己获得的是获得时间；格式 yyyy-MM-dd HH:mm，可以直接比大小）。

test('券种排序：按各券种里「最后得到的那张」的时间倒序', () => {
  const list = [T('a1', WAX, { displayTimeText: '2026-08-15 17:02' }), T('a2', WAX, { displayTimeText: '2026-08-20 09:00' }),
    T('o1', OLD, { displayTimeText: '2026-10-31 23:01' }), T('o2', OLD, { displayTimeText: '2026-09-01 10:00' }), T('e1', EDGE, { displayTimeText: '2026-11-18 10:22' })]
  assert.deepEqual(helper.groupTickets(list, {}, 'pending').map(g => g.name), ['修刃体验券', '老顾客优惠券', '免费打蜡券'])
})

test('券种排序：看的是券种里最新的一张，不是第一张；别人转赠来的新券也会把这个券种顶到最前', () => {
  const list = [T('o1', OLD, { displayTimeText: '2026-10-31 23:01' }),
    T('a1', WAX, { displayTimeText: '2026-08-01 10:00' }), T('a2', WAX, { displayTimeText: '2026-11-19 10:18', displayTimeLabel: '领取时间' })]
  const groups = helper.groupTickets(list, {}, 'pending')
  assert.deepEqual(groups.map(g => g.name), ['免费打蜡券', '老顾客优惠券'])
  assert.equal(groups[0].latestTime, '2026-11-19 10:18')
})

test('券种排序：和传进来的顺序无关；时间一样的保持原来的先后；没有时间的排最后', () => {
  const a = T('a1', WAX, { displayTimeText: '2026-09-01 10:00' }), o = T('o1', OLD, { displayTimeText: '2026-09-01 10:00' })
  const none = T('x1', { name: '没时间的券', template_id: 99, bannerLabel: '', bannerCls: '' }, { displayTimeText: '' })
  const e = T('e1', EDGE, { displayTimeText: '2026-10-01 10:00' })
  assert.deepEqual(helper.groupTickets([none, a, o, e], {}, 'pending').map(g => g.name), ['修刃体验券', '免费打蜡券', '老顾客优惠券', '没时间的券'])
  assert.deepEqual(helper.groupTickets([e, o, a, none], {}, 'pending').map(g => g.name), ['修刃体验券', '老顾客优惠券', '免费打蜡券', '没时间的券'])   // 同时间按传入先后
})

test('券种排序：已使用、已分享 tab 同样按各券种里最新的那个时间（核销时间、分享时间）倒序', () => {
  const list = [T('a1', WAX, { displayTimeText: '2026-09-01 10:00' }), T('o1', OLD, { displayTimeText: '2026-10-01 10:00' })]
  for (const tab of ['used', 'shared']) {
    assert.deepEqual(helper.groupTickets(list, {}, tab).map(g => g.name), ['老顾客优惠券', '免费打蜡券'])
  }
})

test('页面：未使用 tab 一进来券种就按最新获得时间倒序（默认的按有效期排序只影响组里）', async t => {
  const list = [T('a1', WAX, { expireText: '2026.12.1', displayTimeText: '2026-08-15 17:02' }), T('o1', OLD, { expireText: '2032.2.17', displayTimeText: '2026-10-31 23:01' }),
    T('e1', EDGE, { expireText: '2027.4.30', displayTimeText: '2026-11-18 10:22' })]
  const page = setup(t, list)
  await settle()
  assert.deepEqual(page.data.rowArr.map(r => r.rowKey), ['e1', 'o1', 'a1'])     // 即使免费打蜡券最先到期，它的券最早得到，排最后
})

// ---------- 2026-11-19 用户：新增「已接受」tab，列出我通过别人分享收到的券 ----------
// 数据来自新接口 Ticket/GetMyAcceptedTickets（后端先部署；旧后端没有这个接口时页面静默显示空状态）。

test('data.js：getMyAcceptedTicketsPromise 请求 Ticket/GetMyAcceptedTickets，带会话', () => {
  const src = read('utils/data.js')
  assert.match(src, /const getMyAcceptedTicketsPromise = function \(sessionKey\)/)
  assert.match(src, /'Ticket\/GetMyAcceptedTickets\?sessionKey=' \+ encodeURIComponent\(sessionKey\)/)
  assert.match(src, /^\s+getMyAcceptedTicketsPromise,$/m)
})

test('模板：顶部多一个「已接受」tab，链接带 tab=accepted，高亮按 activeTab', () => {
  const wxml = read('pages/mine/ticket/ticket_list.wxml')
  assert.match(wxml, /<navigator class="tab-item \{\{activeTab == 'accepted' \? 'tab-active' : 'tab-inactive'\}\}" url="ticket_list\?tab=accepted" open-type="redirect"[^>]*>已接受<\/navigator>/)
  assert.equal((wxml.match(/class="tab-item /g) || []).length, 4)
  // 顺序：未使用、已使用、已分享、已接受
  const order = ['tab=pending', 'tab=used', 'tab=shared', 'tab=accepted'].map(k => wxml.indexOf(k))
  assert.deepEqual(order, order.slice().sort((a, b) => a - b))
})

test('页面：已接受 tab 用新接口拉券，按券种分组，汇总文字「N 张已接受」，不显示汇总行和排序', async t => {
  const list = [T('a1', WAX, { displayTimeText: '2026-11-10 10:00', displayTimeLabel: '领取时间' }), T('a2', WAX, { displayTimeText: '2026-11-05 08:30', displayTimeLabel: '领取时间' }),
    T('e1', EDGE, { displayTimeText: '2026-11-12 18:00', displayTimeLabel: '领取时间' })]
  const page = setup(t, list, 'accepted')
  await settle()
  assert.deepEqual(page._fake.acceptedCalls, ['sk'])
  assert.deepEqual(page.data.rowArr.map(r => r.rowType + ':' + r.rowKey), ['card:e1', 'group:g:免费打蜡券'])     // 按领取时间：修刃券最新，排最前
  assert.equal(page.data.rowArr[1].summaryText, '2 张已接受')
  assert.equal(page.data.rowArr[1].expireLine, '')
  assert.equal(page.data.summaryText, '')
  assert.equal(page.data.pendingCount, 0)
})

test('已接受 tab 的券：未使用是待使用、已使用降灰、已过期降灰；都只读（不能转赠、撤回分享）', () => {
  const unused = helper.annotateTicket(T('a1', WAX, { template_id: 12 }), 'accepted')
  assert.deepEqual([unused.statusText, unused.muted, unused.canTransfer, unused.canCancelShare], ['待使用', false, false, false])
  const used = helper.annotateTicket(T('a2', WAX, { used: 1, template_id: 12 }), 'accepted')
  assert.deepEqual([used.statusText, used.statusClass, used.muted, used.canTransfer], ['已使用', 'status-used', true, false])
  const expired = helper.annotateTicket(T('a3', WAX, { expired: true, expireText: '2018.5.1', template_id: 12 }), 'accepted')
  assert.deepEqual([expired.statusText, expired.statusClass, expired.muted, expired.canTransfer], ['已过期', 'status-used', true, false])
  assert.equal(expired.metaLine, '已过期 · 2018.5.1')
})

test('已接受 tab：能用的券点进详情（按未使用的口径），已使用、已过期的不跳转', async t => {
  global.__navigated = []
  const page = setup(t, [helper.annotateTicket(T('u1', WAX), 'accepted'), helper.annotateTicket(T('d1', WAX, { used: 1 }), 'accepted'),
    helper.annotateTicket(T('x1', WAX, { expired: true }), 'accepted')], 'accepted')
  await settle()
  page.showDetail({ currentTarget: { id: 'd1' } })
  page.showDetail({ currentTarget: { id: 'x1' } })
  assert.deepEqual(global.__navigated, [])
  page.showDetail({ currentTarget: { id: 'u1' } })
  assert.match(global.__navigated[0], /^ticket_detail\?code=u1&tab=pending&transferred=0$/)
  delete global.__navigated
})

test('已接受 tab 没有券：空状态写「朋友转赠给你的券会出现在这里」', async t => {
  const page = setup(t, [], 'accepted')
  await settle()
  assert.equal(page.data.emptyText, '朋友转赠给你的券会出现在这里')
  const pending = setup(t, [], 'pending')
  await settle()
  assert.equal(pending.data.emptyText, '到店养护或参与活动可获得体验券')
  assert.match(read('pages/mine/ticket/ticket_list.wxml'), /\{\{emptyText\}\}/)
})

test('已接受的分组：不写到期日；整组都已使用才降灰', () => {
  const g = helper.groupTickets([T('a1', WAX, { muted: true }), T('a2', WAX)], {}, 'accepted')[0]
  assert.equal(g.summaryText, '2 张已接受')
  assert.equal(g.expireLine, '')
  assert.equal(g.urgentLine, '')
  assert.equal(g.muted, false)
})

test('样式：四个 tab 并排，字号 26rpx、间距 6rpx，放得下未使用的数量角标', () => {
  const wxss = read('pages/mine/ticket/ticket_list.wxss')
  const rule = (wxss.match(/\n\.tab-item\s*\{([^}]*)\}/) || [])[1] || ''
  assert.match(rule, /font-size:\s*26rpx/)
  assert.match(rule, /gap:\s*6rpx/)
})

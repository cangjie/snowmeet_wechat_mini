// 会员列表页的「VIP」快捷筛选（2026-11-09 用户要求「很快把 VIP 会员筛选出来」，且查询一定要高效率）。
// 筛选面板默认折叠（展开 → 点标签 → 查询）不够快，所以在列表上方放一个一点即查的「VIP」按钮：
// 点一下只看 VIP 会员，再点取消，和其它筛选条件是「且」的关系。
// VIP 是 member.is_vip 字段（带索引）：查询带 vip=true 参数，后端直接按字段筛；不再借道标签（标签要关联标签表，没法这么快）。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, settle } = require('./reception_harness.js')

const FILE = 'pages/admin/member/member_list.js'
const WXML = fs.readFileSync(path.join(__dirname, '../pages/admin/member/member_list.wxml'), 'utf8')

function setup(options = {}) {
  const queries = []
  const toasts = []
  global.getApp = () => ({ globalData: { sessionKey: 'sk-1' } })
  global.wx = { showToast(o) { toasts.push(o.title) } }
  const fake = {
    getTagLibraryPromise() { return Promise.resolve({ tags: options.library || [{ tag: '黑名单' }] }) },
    searchMembersByStaffPromise(param, page, pageSize) {
      queries.push({ param: Object.assign({}, param), page, pageSize })
      return options.hang ? new Promise(() => {}) : Promise.resolve({ items: [], total: 0 })
    }
  }
  const page = loadPage(FILE, fake)
  return { page, queries, toasts }
}
function cleanup() { delete global.getApp; delete global.wx }

test('默认不筛 VIP：查询参数里 vip 为 false，也没有 VIP 标签', async t => {
  t.after(cleanup)
  const { page, queries } = setup()
  page.getData(1, 20); await settle()
  assert.equal(page.data.vipOnly, false)
  assert.equal(queries[0].param.vip, false)
  assert.equal(queries[0].param.tags, '')
})

test('点「VIP」：立即从第 1 页查，带 vip=true，不再往标签里加 VIP', async t => {
  t.after(cleanup)
  const { page, queries } = setup()
  page.setData({ page: 3 })
  page.onToggleVipOnly(); await settle()
  assert.equal(page.data.vipOnly, true)
  assert.equal(queries.length, 1)
  assert.equal(queries[0].page, 1)
  assert.equal(queries[0].param.vip, true)
  assert.equal(queries[0].param.tags, '')
})

test('再点一次：取消只看 VIP，重新查询', async t => {
  t.after(cleanup)
  const { page, queries } = setup()
  page.onToggleVipOnly(); await settle()
  page.onToggleVipOnly(); await settle()
  assert.equal(page.data.vipOnly, false)
  assert.equal(queries.length, 2)
  assert.equal(queries[1].param.vip, false)
})

test('和面板里选的其它标签是「且」的关系：标签照常传，VIP 单独传', async t => {
  t.after(cleanup)
  const { page, queries } = setup({ library: [{ tag: '黑名单' }, { tag: 'VIP' }] })
  page._loadTagLibrary(); await settle()
  page.setData({ 'presetTags[0].on': true })               // 黑名单
  page.onToggleVipOnly(); await settle()
  assert.equal(queries[0].param.tags, '黑名单')
  assert.equal(queries[0].param.vip, true)
  page.setData({ 'presetTags[1].on': true })               // 面板里勾了名字叫 VIP 的普通标签：照普通标签传，不当 VIP 字段
  page.getData(1, 20); await settle()
  assert.equal(queries[1].param.tags, '黑名单,VIP')
})

test('「筛选条件」角标把 VIP 也算一项；重置会清掉 VIP', async t => {
  t.after(cleanup)
  const { page } = setup()
  page.onToggleVipOnly(); await settle()
  assert.equal(page.data.activeCount, 1)
  page.onResetFilter()
  assert.equal(page.data.vipOnly, false)
})

test('上一次查询还没回来时点按钮：忽略，不会出现按钮状态和结果对不上', async t => {
  t.after(cleanup)
  const { page, queries } = setup({ hang: true })
  page.getData(1, 20)                                      // 一直不返回
  page.onToggleVipOnly(); await settle()
  assert.equal(page.data.vipOnly, false)
  assert.equal(queries.length, 1)
})

test('模板：列表上方有「VIP」快捷按钮，选中态随 vipOnly 切换', () => {
  assert.match(WXML, /bindtap="onToggleVipOnly"/)
  assert.match(WXML, /vipOnly \? 'quick-chip--on' : ''/)
  // 按钮在默认折叠的筛选面板之外：位于面板最后的「重置/查询」之后、统计条之前
  const quickAt = WXML.indexOf('onToggleVipOnly')
  assert.ok(quickAt > WXML.indexOf('bindtap="onQuery"'), '在筛选面板之后')
  assert.ok(quickAt < WXML.indexOf('<!-- 统计条 -->'), '在统计条之前')
})

test('data.js：搜索会员只有 vip 为真时才带 &vip=true，其余参数照旧', async t => {
  const requests = []
  global.getApp = () => ({ globalData: { requestPrefix: 'https://api.test/api/', domainName: 'api.test', sessionKey: 'sk' } })
  global.wx = {
    request(o) { requests.push(o); o.success({ statusCode: 200, data: { code: 0, message: '', data: { items: [], total: 0 } } }) },
    showToast() {}
  }
  t.after(() => { cleanup(); delete require.cache[require.resolve('../utils/data.js')] })
  delete require.cache[require.resolve('../utils/data.js')]
  const data = require('../utils/data.js')
  await data.searchMembersByStaffPromise({ name: '李', vip: true }, 2, 20, 'sk')
  await data.searchMembersByStaffPromise({ name: '李', vip: false }, 1, 20, 'sk')
  await data.searchMembersByStaffPromise({}, 1, 20, 'sk')
  assert.equal(requests[0].url, 'https://api.test/api/MemberAdmin/SearchMembersByStaff?sessionKey=sk&pageIndex=2&pageSize=20&name=%E6%9D%8E&vip=true')
  assert.equal(requests[1].url, 'https://api.test/api/MemberAdmin/SearchMembersByStaff?sessionKey=sk&pageIndex=1&pageSize=20&name=%E6%9D%8E')
  assert.equal(requests[2].url, 'https://api.test/api/MemberAdmin/SearchMembersByStaff?sessionKey=sk&pageIndex=1&pageSize=20')
})

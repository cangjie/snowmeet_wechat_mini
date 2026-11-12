// 会员详情页的「设为 VIP」按钮（2026-11-09 用户要求）。
// VIP 是 member 表自己的字段 is_vip（带索引，会员列表按它筛选要快），不是标签：
// 会员明细接口返回 isVip；按钮调 MemberAdmin/SetMemberVip（memberId + vip=true|false）；已经是 VIP 时按钮变「取消VIP」。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, settle } = require('./reception_harness.js')

const FILE = 'pages/admin/member/member_detail.js'
const WXML = fs.readFileSync(path.join(__dirname, '../pages/admin/member/member_detail.wxml'), 'utf8')

function setup(options = {}) {
  const calls = { vip: [], tags: [], modals: [], toasts: [], loads: 0 }
  global.getApp = () => ({ globalData: { sessionKey: 'sk-1', staff: { id: 28, title_level: 300 } }, loginPromiseNew: Promise.resolve() })
  global.wx = {
    showToast(o) { calls.toasts.push(o.title) },
    showModal(o) { calls.modals.push(o); if (o.success) o.success({ confirm: options.confirm !== false }) },
    showLoading() {}, hideLoading() {}
  }
  const fake = {
    getMemberDetailByStaffPromise() { calls.loads++; return Promise.resolve(options.member || { id: 41374, name: '李', isVip: false, custom: [], sys: ['租赁'] }) },
    getTagLibraryPromise() { return Promise.resolve({ tags: [] }) },
    setMemberVipPromise(id, vip, key) {
      calls.vip.push([id, vip, key])
      return options.setFails ? Promise.reject('没有权限') : Promise.resolve({ isVip: vip })
    },
    // VIP 不再走标签：这两个不应该被调用
    addMemberTagPromise(id, tag) { calls.tags.push(['add', id, tag]); return Promise.resolve({}) },
    removeMemberTagPromise(id, tag) { calls.tags.push(['remove', id, tag]); return Promise.resolve({}) }
  }
  const page = loadPage(FILE, fake)
  page.setData({ memberId: 41374 })
  return { page, calls }
}
function cleanup() { delete global.getApp; delete global.wx }

test('明细接口 isVip 为 false / 缺省：页面 isVip 为 false', async t => {
  t.after(cleanup)
  const { page } = setup({ member: { id: 41374, name: '李', isVip: false, custom: ['黑名单'] } })
  page.getData(); await settle()
  assert.equal(page.data.member.isVip, false)
  const old = setup({ member: { id: 41374, name: '李', custom: [] } })   // 旧后端没有这个字段
  old.page.getData(); await settle()
  assert.equal(old.page.data.member.isVip, false)
})

test('明细接口 isVip 为 true：页面 isVip 为 true；自定义标签里叫「VIP」的标签不再算 VIP', async t => {
  t.after(cleanup)
  const { page } = setup({ member: { id: 41374, name: '李', isVip: true, custom: [] } })
  page.getData(); await settle()
  assert.equal(page.data.member.isVip, true)
  const tagOnly = setup({ member: { id: 41374, name: '李', isVip: false, custom: ['VIP'] } })
  tagOnly.page.getData(); await settle()
  assert.equal(tagOnly.page.data.member.isVip, false)
})

test('点「设为VIP」：调 SetMemberVip(vip=true)，然后重新加载并提示，不碰标签接口', async t => {
  t.after(cleanup)
  const { page, calls } = setup()
  page.getData(); await settle()
  calls.loads = 0
  page.onToggleVip(); await settle()
  assert.deepEqual(calls.vip, [[41374, true, 'sk-1']])
  assert.deepEqual(calls.tags, [])
  assert.equal(calls.loads, 1)
  assert.ok(calls.toasts.includes('已设为VIP'))
})

test('已是 VIP 时点「取消VIP」：先确认，确认后调 SetMemberVip(vip=false) 并重新加载', async t => {
  t.after(cleanup)
  const { page, calls } = setup({ member: { id: 41374, name: '李', isVip: true, custom: [] } })
  page.getData(); await settle()
  calls.loads = 0
  page.onToggleVip(); await settle()
  assert.equal(calls.modals.length, 1)
  assert.deepEqual(calls.vip, [[41374, false, 'sk-1']])
  assert.deepEqual(calls.tags, [])
  assert.equal(calls.loads, 1)
  assert.ok(calls.toasts.includes('已取消VIP'))
})

test('取消 VIP 时在确认框点取消：什么都不改', async t => {
  t.after(cleanup)
  const { page, calls } = setup({ member: { id: 41374, name: '李', isVip: true, custom: [] }, confirm: false })
  page.getData(); await settle()
  page.onToggleVip(); await settle()
  assert.deepEqual(calls.vip, [])
})

test('请求失败：不再叠一个笼统的失败提示（请求层已提示真实原因），并且可以再点', async t => {
  t.after(cleanup)
  const { page, calls } = setup({ setFails: true })
  page.getData(); await settle()
  page.onToggleVip(); await settle()
  assert.equal(calls.toasts.some(m => /失败|已设为/.test(m)), false)
  page.onToggleVip(); await settle()
  assert.equal(calls.vip.length, 2)
})

test('请求还没回来时再点：只发一次请求', async t => {
  t.after(cleanup)
  const { page, calls } = setup()
  page.getData(); await settle()
  page.onToggleVip(); page.onToggleVip(); await settle()
  assert.equal(calls.vip.length, 1)
})

test('模板：标签卡片里有绑定 onToggleVip 的按钮，文案随是否 VIP 切换', () => {
  assert.match(WXML, /bindtap="onToggleVip"/)
  assert.match(WXML, /member\.isVip \? '取消VIP' : '设为VIP'/)
})

test('data.js：设置 VIP 是 GET MemberAdmin/SetMemberVip?memberId=&vip=true|false，带会话', async t => {
  const requests = []
  global.getApp = () => ({ globalData: { requestPrefix: 'https://api.test/api/', domainName: 'api.test', sessionKey: 'sk' } })
  global.wx = {
    request(o) { requests.push(o); o.success({ statusCode: 200, data: { code: 0, message: '', data: { isVip: true } } }) },
    showToast() {}
  }
  t.after(() => { cleanup(); delete require.cache[require.resolve('../utils/data.js')] })
  delete require.cache[require.resolve('../utils/data.js')]
  const data = require('../utils/data.js')
  assert.deepEqual(await data.setMemberVipPromise(41374, true, 'sk'), { isVip: true })
  await data.setMemberVipPromise(41374, false, 'sk')
  assert.equal(requests[0].url, 'https://api.test/api/MemberAdmin/SetMemberVip?sessionKey=sk&memberId=41374&vip=true')
  assert.equal(requests[1].url, 'https://api.test/api/MemberAdmin/SetMemberVip?sessionKey=sk&memberId=41374&vip=false')
})

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, settle } = require('./reception_harness.js')

function setup(t) {
  global.getApp = () => ({ globalData: { sessionKey: 'session', staff: { title_level: 300 } }, loginPromiseNew: Promise.resolve() })
  global.wx = { showToast() {}, navigateTo(o) { global.wx.lastUrl = o.url } }
  t.after(() => { delete global.getApp; delete global.wx })
}

test('会员列表保留姓名和手机号，显示昵称及头像；头像失败时回退且不影响其他会员', async t => {
  setup(t)
  const page = loadPage('pages/admin/member/member_list.js', {
    searchMembersByStaffPromise: () => Promise.resolve({ total: 2, items: [
      { id: 1, name: '张', nickName: '  小雪  ', avatarUrl: 'https://img.test/a.jpg', phone: '123', deposit: 5 },
      { id: 2, name: '李', gender: '女' }
    ] })
  })
  page.getData(1, 20)
  await settle()
  assert.deepEqual([page.data.members[0].name, page.data.members[0].nickName, page.data.members[0].avatarUrl, page.data.members[0].phone],
    ['张', '小雪', 'https://img.test/a.jpg', '123'])
  assert.deepEqual([page.data.members[1].avatar, page.data.members[1].nickName, page.data.members[1].avatarUrl], ['李', '', ''])
  page.onAvatarError({ currentTarget: { dataset: { id: 1, src: 'https://img.test/a.jpg' } } })
  assert.equal(page.data.members[0].avatarError, true)
  assert.equal(page.data.members[1].avatarError, false)
  page.gotoDetail({ currentTarget: { dataset: { id: 1 } } })
  assert.match(global.wx.lastUrl, /member_detail\?id=1/)
})

test('会员详情兼容有资料和旧接口无资料；旧头像的迟到错误不会隐藏新头像', async t => {
  setup(t)
  let profile = { id: 1, name: '张', nickName: '雪友', avatarUrl: 'https://img.test/new.jpg', accounts: {} }
  const page = loadPage('pages/admin/member/member_detail.js', { getMemberDetailByStaffPromise: () => Promise.resolve({ ...profile }) })
  page.setData({ memberId: 1 })
  page.getData(); await settle()
  assert.deepEqual([page.data.member.name, page.data.member.nickName, page.data.member.avatarUrl], ['张', '雪友', 'https://img.test/new.jpg'])
  page.onAvatarError({ currentTarget: { dataset: { src: 'https://img.test/old.jpg' } } })
  assert.equal(page.data.member.avatarError, false)
  page.onAvatarError({ currentTarget: { dataset: { src: 'https://img.test/new.jpg' } } })
  assert.equal(page.data.member.avatarError, true)
  profile = { id: 1, name: '', accounts: {} }
  page.getData(); await settle()
  assert.deepEqual([page.data.member.avatar, page.data.member.nickName, page.data.member.avatarUrl], ['?', '', ''])
})

test('列表和详情模板均在原头像位显示图片并保留昵称及加载失败占位', () => {
  for (const name of ['member_list', 'member_detail']) {
    const wxml = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/member', name + '.wxml'), 'utf8')
    assert.match(wxml, /<image[^>]*class="avatar avatar-img"[^>]*mode="aspectFill"/)
    assert.match(wxml, /binderror="onAvatarError"/)
    assert.match(wxml, /wx:else class="avatar/)
    assert.match(wxml, /昵称：\{\{/)
  }
})

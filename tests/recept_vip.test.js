// VIP 开单页（pages/admin/reception/recept_vip，2026-11-09 用户要求）：
// 接待页点「VIP开单」进来，列出 VIP 会员，点一位直接开单——不用顾客扫码、不用店长授权，视同身份已验证；
// 进了顾客信息页（recept_member）以后的开单流程和以往一样。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, settle, tap } = require('./reception_harness.js')

const PAGE = 'pages/admin/reception/recept_vip.js'
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
const WXML = read('pages/admin/reception/recept_vip.wxml')

const VIPS = [
  { id: 41, name: '王先生', gender: '男', phone: '13800000041' },
  { id: 42, name: '李女士', gender: '女', phone: '13800000042' }
]

// search：searchMembersByStaffPromise 的实现（默认返回 VIPS）；enter：enterReceptByVipPromise 的实现
function setup({ search, enter } = {}) {
  const calls = { search: [], enter: [] }
  const nav = []
  const toasts = []
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk' } })
  global.wx = {
    navigateTo(o) { nav.push(o.url) },
    showToast(o) { toasts.push(o.title) }
  }
  const fake = {
    searchMembersByStaffPromise(filter, pageIndex, pageSize, sessionKey) {
      calls.search.push({ filter: Object.assign({}, filter), pageIndex, pageSize, sessionKey })
      return search ? search(filter, pageIndex) : Promise.resolve({ items: VIPS, total: VIPS.length })
    },
    enterReceptByVipPromise(memberId, sessionKey) {
      calls.enter.push([memberId, sessionKey])
      return enter ? enter(memberId) : Promise.resolve({ id: 700 + memberId, stage: 'phone_authed', memberId })
    }
  }
  const page = loadPage(PAGE, fake)
  page.onLoad()
  return { page, calls, nav, toasts }
}
function cleanup(page) {
  if (page && page._timer) clearTimeout(page._timer)
  delete global.getApp
  delete global.wx
}

test('进入页面：按 VIP 查第 1 页，列出 VIP 会员', async t => {
  const { page, calls } = setup()
  t.after(() => cleanup(page))
  page.onShow(); await settle()
  assert.deepEqual(calls.search, [{ filter: { vip: true }, pageIndex: 1, pageSize: 20, sessionKey: 'sk' }])
  assert.deepEqual(page.data.members.map(m => [m.id, m.name, m.avatar, m.female, m.phone]),
    [[41, '王先生', '王', false, '13800000041'], [42, '李女士', '李', true, '13800000042']])
  assert.equal(page.data.total, 2)
  assert.equal(page.data.totalPages, 1)
  assert.equal(page.data.querying, false)
  assert.equal(page.data.loaded, true)
})

test('搜索：全是数字按手机号搜，否则按姓名搜，始终只在 VIP 里搜；输入停下来才发请求', async t => {
  const { page, calls } = setup()
  t.after(() => cleanup(page))
  page.onShow(); await settle()
  calls.search.length = 0
  page.onKeywordInput({ detail: { value: '138' } })
  page.onKeywordInput({ detail: { value: '1380000' } })      // 连续输入：只查最后一次
  await new Promise(r => setTimeout(r, 450))
  assert.equal(calls.search.length, 1)
  assert.deepEqual(calls.search[0].filter, { vip: true, cell: '1380000' })
  assert.equal(calls.search[0].pageIndex, 1)

  page.onKeywordInput({ detail: { value: '王' } })
  await new Promise(r => setTimeout(r, 450))
  assert.deepEqual(calls.search[1].filter, { vip: true, name: '王' })

  page.onKeywordInput({ detail: { value: '' } })
  await new Promise(r => setTimeout(r, 450))
  assert.deepEqual(calls.search[2].filter, { vip: true })
})

test('搜索时旧请求后返回：不会盖掉新结果', async t => {
  const pending = []
  const { page } = setup({
    search: (filter) => new Promise(resolve => pending.push({ filter, resolve }))
  })
  t.after(() => cleanup(page))
  page.onShow(); await settle()                    // 第一次（全部 VIP），还没回
  page.setData({ keyword: '王' })
  page.getData(1, 20); await settle()              // 第二次（搜王）
  pending[1].resolve({ items: [VIPS[0]], total: 1 })
  await settle()
  pending[0].resolve({ items: VIPS, total: 2 })    // 旧的才回来
  await settle()
  assert.deepEqual(page.data.members.map(m => m.id), [41])
  assert.equal(page.data.total, 1)
})

test('翻页：按分页组件给的页码和每页条数查，保留搜索词', async t => {
  const { page, calls } = setup({ search: () => Promise.resolve({ items: VIPS, total: 45 }) })
  t.after(() => cleanup(page))
  page.setData({ keyword: '王' })
  page.onShow(); await settle()
  assert.equal(page.data.totalPages, 3)
  page.onPagerChange({ detail: { page: 3, pageSize: 20 } }); await settle()
  assert.deepEqual(calls.search[1], { filter: { vip: true, name: '王' }, pageIndex: 3, pageSize: 20, sessionKey: 'sk' })
  assert.equal(page.data.page, 3)
})

test('从顾客信息页返回（再次 onShow）：保留页码重新查一遍', async t => {
  const { page, calls } = setup({ search: () => Promise.resolve({ items: VIPS, total: 45 }) })
  t.after(() => cleanup(page))
  page.onShow(); await settle()
  page.onPagerChange({ detail: { page: 2, pageSize: 20 } }); await settle()
  page.onShow(); await settle()
  assert.equal(calls.search[calls.search.length - 1].pageIndex, 2)
})

test('点一位 VIP：直接进入开单——调 EnterReceptByVip，跳顾客信息页（已授权阶段）', async t => {
  const { page, calls, nav } = setup()
  t.after(() => cleanup(page))
  page.onShow(); await settle()
  page.onVipTap(tap({ id: 42 })); await settle()
  assert.deepEqual(calls.enter, [[42, 'sk']])
  assert.deepEqual(nav, ['/pages/admin/reception/recept_member?checkinId=742&stage=phone_authed'])
})

test('连点两下只进入一次', async t => {
  const { page, calls, nav } = setup()
  t.after(() => cleanup(page))
  page.onShow(); await settle()
  page.onVipTap(tap({ id: 41 }))
  page.onVipTap(tap({ id: 41 })); await settle()
  assert.equal(calls.enter.length, 1)
  assert.equal(nav.length, 1)
})

test('进入失败（不是 VIP / 没有手机号等，原因由请求层提示）：不跳转，页面保持原样，可以再点', async t => {
  let fail = true
  const { page, calls, nav } = setup({ enter: () => fail ? Promise.reject('该会员不是VIP') : Promise.resolve({ id: 9, stage: 'phone_authed' }) })
  t.after(() => cleanup(page))
  page.onShow(); await settle()
  page.onVipTap(tap({ id: 41 })); await settle()
  assert.deepEqual(nav, [])
  assert.equal(page.data.members.length, 2)
  fail = false
  page.onVipTap(tap({ id: 41 })); await settle()
  assert.equal(calls.enter.length, 2)
  assert.deepEqual(nav, ['/pages/admin/reception/recept_member?checkinId=9&stage=phone_authed'])
})

test('没有 VIP / 搜不到 / 查询失败：分别有明确状态，不卡在空白', async t => {
  const { page, toasts } = setup({ search: () => Promise.resolve({ items: [], total: 0 }) })
  t.after(() => cleanup(page))
  assert.equal(page.data.loaded, false)             // 查询回来之前不显示空状态
  page.onShow(); await settle()
  assert.equal(page.data.loaded, true)
  assert.equal(page.data.members.length, 0)
  assert.match(WXML, /还没有 VIP 会员/)
  assert.match(WXML, /没有匹配的 VIP 会员/)

  const failing = setup({ search: () => Promise.reject('boom') })
  t.after(() => cleanup(failing.page))
  failing.page.onShow(); await settle()
  assert.equal(failing.page.data.querying, false)
  assert.equal(failing.page.data.loaded, true)
  assert.ok(failing.toasts.includes('查询失败'))
  assert.ok(Array.isArray(toasts))
})

test('模板：顶栏用 safe-nav-bar；每行点击进入开单；手机号带复制按钮；分页', () => {
  assert.match(WXML, /<safe-nav-bar /)
  assert.match(WXML, /bindtap="onVipTap"/)
  assert.match(WXML, /<phone-copy phone="\{\{item\.phone\}\}" \/>/)
  assert.match(WXML, /<list-pager /)
  assert.match(read('pages/admin/reception/recept_vip.json'), /"navigationStyle": "custom"/)
})

test('页面已在 app.json 注册（在接待页同一个包里）', () => {
  const pages = JSON.parse(read('app.json')).pages
  assert.ok(pages.includes('pages/admin/reception/recept_vip'))
  assert.ok(pages.includes('pages/admin/reception/recept_scan'))
})

test('data.js：进入 VIP 开单是 GET QrCode/EnterReceptByVip?memberId=&sessionKey=', async t => {
  const requests = []
  global.getApp = () => ({ globalData: { requestPrefix: 'https://api.test/api/', domainName: 'api.test', sessionKey: 'sk' } })
  global.wx = {
    request(o) { requests.push(o); o.success({ statusCode: 200, data: { code: 0, message: '', data: { id: 5, stage: 'phone_authed' } } }) },
    showToast() {}
  }
  t.after(() => { delete global.getApp; delete global.wx; delete require.cache[require.resolve('../utils/data.js')] })
  delete require.cache[require.resolve('../utils/data.js')]
  const data = require('../utils/data.js')
  const view = await data.enterReceptByVipPromise(41, 'sk')
  assert.deepEqual(view, { id: 5, stage: 'phone_authed' })
  assert.equal(requests[0].url, 'https://api.test/api/QrCode/EnterReceptByVip?memberId=41&sessionKey=sk&sessionType=wechat_mini_openid')
})

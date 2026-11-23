// 「我的雪票」：付款后取票码（二维码）要等供应商出码，通常十几秒到一分钟。
// 页面以前只在进入时加载一次，顾客看到「出票中/取票码正在生成」后得退出再进才看得到；
// 现在有票在等码时每 5 秒自动刷新一次（最多 3 分钟），取到码后自动停；立即使用弹层开着时里面的二维码也跟着出现。
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage } = require('./reception_harness.js')
const g = require('../utils/skipass_my_group.js')

const FILE = 'pages/mine/skipass/my_skipasses.js'
const POLL_MS = 5000

const raw = (id, over) => Object.assign({
  id, order_id: 100, product_id: 641, product_name: '【万龙】全雪区日场4小时雪票', reserve_date: '2026-11-23T00:00:00',
  reserve_no: 'N' + id, deal_price: 309, status: '已确认', card_no: 'C' + id, qr_code_url: 'https://img/' + id + '.png',
  contact_cell: '13501177897'
}, over || {})
// 已出票、供应商还没出码
const waiting = (id, over) => raw(id, Object.assign({ card_no: null, qr_code_url: null }, over || {}))
// 已付款、还没向供应商下单成功
const issuing = (id, over) => raw(id, Object.assign({ status: '已付款', reserve_no: null, card_no: null, qr_code_url: null }, over || {}))

function setup(list) {
  const requests = []
  global.getApp = () => ({ globalData: { domainName: 'api.test', sessionKey: 'sk' } })
  global.wx = {
    request(req) {
      requests.push(req.url)
      if (req.url.indexOf('SkiPass/GetMySkipass') >= 0) {
        const r = typeof list === 'function' ? list(requests.length) : list
        if (r === 'FAIL') req.fail({})
        else if (r === 500) req.success({ statusCode: 500, data: {} })
        else req.success({ statusCode: 200, data: r })
      } else req.success({ statusCode: 200, data: {} })
    },
    showToast() {}, showLoading() {}, hideLoading() {}, setNavigationBarTitle() {}
  }
  const page = loadPage(FILE, {})
  return { page, requests }
}
const cleanup = () => { delete global.getApp; delete global.wx }
const loads = (requests) => requests.filter(u => u.indexOf('GetMySkipass') >= 0).length

// ---------- 哪些票算「在等码」 ----------

test('在等码：出票中，和已向供应商下单但还没有取票码/二维码的票', () => {
  assert.equal(g.parseTicket(issuing(1)).awaitingCode, true)
  assert.equal(g.parseTicket(waiting(2)).awaitingCode, true)
  assert.equal(g.parseTicket(waiting(3, { status: '已出票' })).awaitingCode, true)
})

test('不在等码：已有码、已使用、退票中、已退票、出票失败', () => {
  assert.equal(g.parseTicket(raw(1)).awaitingCode, false)
  assert.equal(g.parseTicket(raw(2, { card_no: null })).awaitingCode, false)       // 有二维码就够了
  assert.equal(g.parseTicket(raw(3, { qr_code_url: null })).awaitingCode, false)   // 有数字取票码也够了
  assert.equal(g.parseTicket(waiting(4, { status: '已取卡' })).awaitingCode, false)
  assert.equal(g.parseTicket(waiting(5, { status: '取消中' })).awaitingCode, false)
  assert.equal(g.parseTicket(waiting(6, { status: '已申请退款' })).awaitingCode, false)
  assert.equal(g.parseTicket(waiting(7, { is_cancel: -2 })).awaitingCode, false)
})

// 后台返回的 create_date 是服务器本地时间、不带时区，如 2026-11-23T10:00:00.123
const localStamp = (ms) => {
  const d = new Date(ms), p = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '.123'
}

test('下单超过 2 小时还没有码的老票不再等（再等也没用，每次进页面都轮询三分钟太浪费）', () => {
  const old = localStamp(Date.now() - 3 * 3600 * 1000)
  const fresh = localStamp(Date.now() - 5 * 60 * 1000)
  assert.equal(g.parseTicket(waiting(1, { create_date: old })).awaitingCode, false)
  assert.equal(g.parseTicket(waiting(2, { create_date: fresh })).awaitingCode, true)
  assert.equal(g.parseTicket(waiting(3, { create_date: 'garbage' })).awaitingCode, true)   // 读不出时间按新票处理
})

test('needsCodePolling：任何一组里有一张在等码就要轮询', () => {
  assert.equal(g.needsCodePolling(g.buildMyGroups([raw(1), raw(2)])), false)
  assert.equal(g.needsCodePolling(g.buildMyGroups([raw(1), waiting(2)])), true)
  assert.equal(g.needsCodePolling([]), false)
})

// ---------- 页面自动刷新 ----------

test('有票在等码：每 5 秒自动刷新一次；取到码后自动停止', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let phase = 0
  const { page, requests } = setup(() => (phase === 0 ? [waiting(1)] : [raw(1)]))
  page.getData()
  assert.equal(loads(requests), 1)
  assert.equal(page.data.codePolling, true)

  t.mock.timers.tick(POLL_MS - 1)
  assert.equal(loads(requests), 1)                 // 还没到 5 秒
  t.mock.timers.tick(1)
  assert.equal(loads(requests), 2)                 // 到点刷新，仍没码，继续等
  t.mock.timers.tick(POLL_MS)
  assert.equal(loads(requests), 3)

  phase = 1                                        // 供应商出码了
  t.mock.timers.tick(POLL_MS)
  assert.equal(loads(requests), 4)
  assert.equal(page.data.codePolling, false)
  assert.equal(page.data.unusedList[0].tickets[0].qrSrc.indexOf('QrImage?skipassId=1') > 0, true)
  t.mock.timers.tick(POLL_MS * 5)
  assert.equal(loads(requests), 4)                 // 不再刷新
  cleanup()
})

test('出票中（还没向供应商下单成功）同样自动刷新', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { page, requests } = setup([issuing(1)])
  page.getData()
  t.mock.timers.tick(POLL_MS)
  assert.equal(loads(requests), 2)
  cleanup()
})

test('票都有码、或只剩已使用/已退的票：不轮询', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { page, requests } = setup([raw(1), raw(2, { status: '已取卡' }), waiting(3, { status: '已申请退款' })])
  page.getData()
  assert.equal(page.data.codePolling, false)
  t.mock.timers.tick(POLL_MS * 10)
  assert.equal(loads(requests), 1)
  cleanup()
})

test('最多自动刷新 3 分钟（36 次）：供应商一直不出码也不会无限刷新', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { page, requests } = setup([waiting(1)])
  page.getData()
  for (let i = 0; i < 60; i++) t.mock.timers.tick(POLL_MS)   // mock 的一次 tick 不会触发 tick 期间新建的定时器，所以逐个 5 秒推进
  assert.equal(loads(requests), 1 + 36)
  assert.equal(page.data.codePolling, false)       // 停了，弹层里改提示退出重进
  cleanup()
})

test('某次刷新失败（网络抖动、服务器 500）：不中断，下个 5 秒继续', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const seq = [[waiting(1)], 'FAIL', 500, [waiting(1)], [raw(1)]]
  const { page, requests } = setup((n) => seq[n - 1])
  page.getData()
  for (let i = 0; i < 4; i++) t.mock.timers.tick(POLL_MS)
  assert.equal(loads(requests), 5)
  assert.equal(page.data.codePolling, false)       // 第 5 次取到码
  assert.equal(page.data.unusedList[0].tickets[0].pickupCode, 'https://img/1.png')
  cleanup()
})

test('离开页面（隐藏/卸载）就停止刷新；再回到页面立即刷新一次并重新开始', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { page, requests } = setup([waiting(1)])
  page.getData()                                   // 真机里 onLoad 登录后调用
  page.onShow()                                    // 首次显示不重复加载（onLoad 已经在加载了）
  assert.equal(loads(requests), 1)
  page.onHide()
  t.mock.timers.tick(POLL_MS * 5)
  assert.equal(loads(requests), 1)                 // 隐藏期间不刷新
  page.onShow()
  assert.equal(loads(requests), 2)                 // 回来立即刷新
  t.mock.timers.tick(POLL_MS)
  assert.equal(loads(requests), 3)                 // 并继续轮询
  page.onUnload()
  t.mock.timers.tick(POLL_MS * 5)
  assert.equal(loads(requests), 3)
  cleanup()
})

test('请求还在路上时离开了页面：响应回来后不再安排下一次刷新', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { page, requests } = setup([waiting(1)])
  let pending = null
  global.wx.request = (req) => { requests.push(req.url); pending = req }   // 请求先挂着，不立刻返回
  page.getData()
  page.onHide()
  pending.success({ statusCode: 200, data: [waiting(1)] })
  t.mock.timers.tick(POLL_MS * 3)
  assert.equal(loads(requests), 1)
  assert.equal(page.data.codePolling, false)
  cleanup()
})

test('3 分钟刷满停下后，用户再回到页面：重新开始自动刷新（次数重新计）', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { page, requests } = setup([waiting(1)])
  page.onShow()                                    // 首次显示
  page.getData()
  for (let i = 0; i < 60; i++) t.mock.timers.tick(POLL_MS)
  assert.equal(loads(requests), 1 + 36)
  assert.equal(page.data.codePolling, false)
  page.onHide()
  page.onShow()                                    // 回到页面
  assert.equal(loads(requests), 1 + 36 + 1)
  assert.equal(page.data.codePolling, true)
  t.mock.timers.tick(POLL_MS)
  assert.equal(loads(requests), 1 + 36 + 2)
  cleanup()
})

test('立即使用弹层开着时取到码：弹层里这张票的二维码自动出现，选中的票不变', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let phase = 0
  const { page } = setup(() => (phase === 0 ? [raw(1), waiting(2)] : [raw(1), raw(2)]))
  page.getData()
  const key = page.data.unusedList[0].key
  page.onUseTicket({ currentTarget: { dataset: { key } } })
  page.onSelectTicket({ currentTarget: { dataset: { index: 1 } } })
  assert.equal(page.data.useTicket.id, 2)
  assert.equal(page.data.useTicket.qrSrc, '')

  phase = 1
  t.mock.timers.tick(POLL_MS)
  assert.equal(page.data.showUseModal, true)
  assert.equal(page.data.useIndex, 1)
  assert.equal(page.data.useTicket.id, 2)
  assert.equal(page.data.useTicket.qrSrc, 'https://api.test/core/SkiPass/QrImage?skipassId=2&sessionKey=sk&sessionType=wechat_mini_openid')
  assert.equal(page.data.useTicket.cardNo, 'C2')
  assert.deepEqual(page.data.useTickets.map(x => x.tag), ['票1', '票2'])
  cleanup()
})

test('弹层开着、没有新数据时：二维码图片已加载失败的提示不会被每 5 秒的刷新重置', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { page } = setup([raw(1), waiting(2)])
  page.getData()
  const key = page.data.unusedList[0].key
  page.onUseTicket({ currentTarget: { dataset: { key } } })
  page.onQrError()
  assert.equal(page.data.qrFailed, true)
  t.mock.timers.tick(POLL_MS)
  assert.equal(page.data.qrFailed, true)           // 第 1 张票的二维码没变，仍是加载失败
  cleanup()
})

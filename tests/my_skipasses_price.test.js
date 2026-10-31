// 新版「我的雪票」：金额显示顾客实际支付的 deal_price，不是和供应商的结算价 ticket_price。
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle } = require('./reception_harness.js')

const FILE = 'pages/mine/skipass/my_skipasses.js'

test('我的雪票：金额取 deal_price（实付），不显示 ticket_price（结算价）', async () => {
  const list = [
    { id: 1, product_name: '【万龙】全雪区日场4小时雪票-11.6', reserve_date: '2026-11-03T00:00:00', reserve_no: '1222019804',
      deal_price: 309, ticket_price: 296.67, status: '已确认', card_no: null, qr_code_url: null },
    { id: 2, product_name: '【万龙】全雪区日场1天雪票-11.6', reserve_date: '2026-11-04T00:00:00', reserve_no: '1222019805',
      deal_price: 778, ticket_price: 742.54, status: '已确认', card_no: null, qr_code_url: null }
  ]
  global.getApp = () => ({ globalData: { domainName: 'api.test', sessionKey: 'sk' } })
  global.wx = {
    request(req) { assert.ok(req.url.indexOf('SkiPass/GetMySkipass') >= 0); req.success({ statusCode: 200, data: list }) },
    getWindowInfo() { return { statusBarHeight: 20, windowWidth: 375 } },
    getMenuButtonBoundingClientRect() { return { top: 26, left: 280, height: 32 } }
  }
  const page = loadPage(FILE, {})
  page.getData()
  await settle()
  const amounts = page.data.unusedList.map(x => x.amount)
  assert.equal(amounts.length, 2)
  assert.ok(amounts[0].indexOf('309') >= 0 && amounts[0].indexOf('296') < 0, amounts[0])
  assert.ok(amounts[1].indexOf('778') >= 0 && amounts[1].indexOf('742') < 0, amounts[1])
  delete global.getApp
  delete global.wx
})

test('我的雪票：退票中、已退票、退款中、退款成功都不再算可用，并给出进度说明', async () => {
  const mk = (id, status) => ({ id, product_name: 'p' + id, reserve_date: '2026-11-03T00:00:00', reserve_no: 'n' + id,
    deal_price: 309, ticket_price: 296.67, status, card_no: null, qr_code_url: null })
  const list = [mk(1, '已确认'), mk(2, '取消中'), mk(3, '申请取消'), mk(4, '已取消'), mk(5, '已申请退款'), mk(6, '退款成功'), mk(7, '取消失败')]
  global.getApp = () => ({ globalData: { domainName: 'api.test', sessionKey: 'sk' } })
  global.wx = {
    request(req) { req.success({ statusCode: 200, data: list }) },
    getWindowInfo() { return { statusBarHeight: 20, windowWidth: 375 } },
    getMenuButtonBoundingClientRect() { return { top: 26, left: 280, height: 32 } }
  }
  const page = loadPage(FILE, {})
  page.getData()
  await settle()
  assert.deepEqual(page.data.unusedList.map(x => x.id), [1, 7])
  const used = page.data.usedList
  assert.deepEqual(used.map(x => [x.id, x.statusText]), [[2, '退票中'], [3, '退票中'], [4, '退票中'], [5, '已退票'], [6, '已退票']])
  assert.match(used[0].statusHint, /几分钟内确认.*自动原路退款/)
  assert.match(used[2].statusHint, /退款正在提交/)
  assert.match(used[3].statusHint, /原路退回/)
  assert.equal(page.data.unusedList[1].statusText, '退票未成功')
  assert.equal(page.data.unusedList[0].statusHint, '')
  delete global.getApp
  delete global.wx
})

test('我的雪票：点「立即使用」——有取票码就打开弹层，刚下单还没出票码就提示稍后，都不报错', () => {
  const toasts = []
  global.getApp = () => ({ globalData: { domainName: 'api.test', sessionKey: 'sk' } })
  global.wx = { showToast(x) { toasts.push(x.title) } }
  const page = loadPage(FILE, {})
  page.setData({ unusedList: [
    { id: 1, canUse: true, card_no: '17993493527191877', pickupCode: 'https://img/qr.png' },
    { id: 2, canUse: true, card_no: null, pickupCode: null, serial: '1222019805' },
    { id: 3, canUse: true, card_no: '999', pickupCode: null }
  ] })
  const tap = (id, d) => page.onUseTicket({ currentTarget: { dataset: Object.assign({ id, title: 't' }, d || {}) } })
  tap(1)
  assert.equal(page.data.showUseModal, true)
  assert.equal(page.data.useTarget.pickupCode, 'https://img/qr.png')
  page.setData({ showUseModal: false })
  assert.doesNotThrow(() => tap(2))
  assert.equal(page.data.showUseModal, false)
  assert.equal(toasts.length, 1)
  assert.match(toasts[0], /取票码正在生成/)
  tap(3)
  assert.equal(page.data.showUseModal, true)
  assert.equal(page.data.useTarget.card_no, '999')
  assert.equal(page.data.useTarget.pickupCode, '')
  delete global.getApp
  delete global.wx
})

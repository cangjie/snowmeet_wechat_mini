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
  assert.deepEqual(used.map(x => [x.id, x.statusText]), [[2, '退票中'], [3, '退票中'], [4, '已退票'], [5, '退款中'], [6, '已退款']])
  assert.match(used[0].statusHint, /几分钟内确认.*自动原路退款/)
  assert.match(used[2].statusHint, /退款正在处理/)
  assert.equal(page.data.unusedList[1].statusText, '退票未成功')
  assert.equal(page.data.unusedList[0].statusHint, '')
  delete global.getApp
  delete global.wx
})

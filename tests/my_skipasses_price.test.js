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

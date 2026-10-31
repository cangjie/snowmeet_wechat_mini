// 新版「我的雪票」：金额显示顾客实际支付的 deal_price，不是和供应商的结算价 ticket_price；
// 票种、日期、手机号相同的合并成 × n；点「立即使用」按票分标签，每张票有自己的状态和退票。
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle } = require('./reception_harness.js')

const FILE = 'pages/mine/skipass/my_skipasses.js'

const raw = (id, over) => Object.assign({
  id, order_id: 100, product_id: 641, product_name: '【万龙】全雪区日场4小时雪票-11.6', reserve_date: '2026-11-03T00:00:00',
  reserve_no: 'N' + id, deal_price: 309, ticket_price: 296.67, status: '已确认', card_no: 'C' + id, qr_code_url: 'https://img/' + id + '.png',
  contact_cell: '13501177897'
}, over || {})

function setup(list, extra) {
  const requests = []
  const toasts = []
  global.getApp = () => ({ globalData: { domainName: 'api.test', sessionKey: 'sk' } })
  global.wx = {
    request(req) {
      requests.push(req.url)
      if (req.url.indexOf('SkiPass/GetMySkipass') >= 0) req.success({ statusCode: 200, data: typeof list === 'function' ? list() : list })
      else req.success({ statusCode: (extra && extra.cancelStatus) || 200, data: {} })
    },
    showToast(x) { toasts.push(x.title) },
    showLoading() {}, hideLoading() {},
    setNavigationBarTitle() {},
    getWindowInfo() { return { statusBarHeight: 20, windowWidth: 375 } },
    getMenuButtonBoundingClientRect() { return { top: 26, left: 280, height: 32 } }
  }
  const page = loadPage(FILE, {})
  return { page, requests, toasts }
}

function cleanup() { delete global.getApp; delete global.wx }

test('我的雪票：金额取各张 deal_price 之和（实付），不显示 ticket_price（结算价）', async () => {
  const { page } = setup([raw(1), raw(2), raw(3, { product_id: 643, product_name: '6小时', deal_price: 359, ticket_price: 342.01, reserve_date: '2026-11-04T00:00:00' })])
  page.getData()
  await settle()
  const [a, b] = page.data.unusedList
  assert.ok(a.amount.indexOf('618') >= 0 && a.amount.indexOf('296') < 0, a.amount)
  assert.ok(b.amount.indexOf('359') >= 0 && b.amount.indexOf('342') < 0, b.amount)
  cleanup()
})

test('我的雪票：同一票种、日期、手机号合并成一条 × n；用完或退完的放「已使用」页', async () => {
  const { page } = setup([
    raw(1), raw(2), raw(3, { contact_cell: '13900139000' }),
    raw(4, { product_id: 643, status: '已申请退款' }), raw(5, { product_id: 643, status: '退款成功' })
  ])
  page.getData()
  await settle()
  assert.deepEqual(page.data.unusedList.map(g => [g.count, g.cell, g.statusText]), [[2, '13501177897', '2 张可使用'], [1, '13900139000', '可使用']])
  assert.deepEqual(page.data.usedList.map(g => [g.count, g.stampText]), [[2, '已退票']])
  assert.equal(page.data.currentList.length, 2)
  cleanup()
})

test('我的雪票：立即使用——多张票按标签切换，每张票有自己的二维码和状态，只有可退的显示退票', async () => {
  const { page } = setup([raw(1), raw(2, { status: '已取卡' }), raw(3, { status: '取消中' }), raw(4, { status: '已付款', reserve_no: null, card_no: null, qr_code_url: null })])
  page.getData()
  await settle()
  const key = page.data.unusedList[0].key
  page.onUseTicket({ currentTarget: { dataset: { key } } })
  assert.equal(page.data.showUseModal, true)
  assert.deepEqual(page.data.useTickets.map(t => [t.tag, t.stateText, t.canCancel]), [
    ['票1', '可使用', true], ['票2', '已使用', false], ['票3', '退票中', false], ['票4', '出票中', false]
  ])
  assert.equal(page.data.useIndex, 0)
  assert.equal(page.data.useTicket.pickupCode, 'https://img/1.png')
  page.onSelectTicket({ currentTarget: { dataset: { index: 3 } } })
  assert.equal(page.data.useTicket.id, 4)
  assert.equal(page.data.useTicket.pickupCode, '')
  assert.equal(page.data.useTicket.stateText, '出票中')
  cleanup()
})

test('我的雪票：立即使用——默认停在第一张还能用的票上；刚下单还没码也能打开，不报错', async () => {
  const { page } = setup([raw(1, { status: '已取卡' }), raw(2, { status: '已付款', reserve_no: null, card_no: null, qr_code_url: null })])
  page.getData()
  await settle()
  assert.doesNotThrow(() => page.onUseTicket({ currentTarget: { dataset: { key: page.data.unusedList[0].key } } }))
  assert.equal(page.data.showUseModal, true)
  assert.equal(page.data.useIndex, 1)
  assert.equal(page.data.useTicket.stateText, '出票中')
  cleanup()
})

test('我的雪票：没有能用的票的分组点不开弹层', async () => {
  const { page } = setup([raw(1, { status: '已申请退款' })])
  page.getData()
  await settle()
  page.onUseTicket({ currentTarget: { dataset: { key: page.data.usedList[0].key } } })
  assert.equal(page.data.showUseModal, false)
  cleanup()
})

test('我的雪票：退票——只退被点的那一张，先确认，确认后只调这张票的取消接口，不影响同组其他票', async () => {
  let list = [raw(1), raw(2)]
  const { page, requests, toasts } = setup(() => list)
  page.getData()
  await settle()
  page.onUseTicket({ currentTarget: { dataset: { key: page.data.unusedList[0].key } } })
  page.onSelectTicket({ currentTarget: { dataset: { index: 1 } } })
  page.onCancelTicket({ currentTarget: { dataset: { id: page.data.useTicket.id } } })
  assert.equal(page.data.showUseModal, false)
  assert.equal(page.data.showCancelModal, true)
  assert.deepEqual([page.data.cancelTarget.id, page.data.cancelTarget.title], [2, '【万龙】全雪区日场4小时雪票-11.6（票2）'])
  assert.equal(requests.some(u => u.indexOf('SkiPass/Cancel') >= 0), false)

  list = [raw(1), raw(2, { status: '取消中' })] // 提交后再取列表：票2 退票中
  page.confirmCancel()
  await settle()
  const cancelCalls = requests.filter(u => u.indexOf('SkiPass/Cancel/') >= 0)
  assert.equal(cancelCalls.length, 1)
  assert.ok(cancelCalls[0].indexOf('SkiPass/Cancel/2?') >= 0, cancelCalls[0])
  assert.deepEqual(toasts, ['退票申请已提交'])
  const grp = page.data.unusedList[0]
  assert.equal(grp.statusText, '1 张可使用 · 1 张退票中')
  assert.equal(page.data.showCancelModal, false)
  cleanup()
})

test('我的雪票：退票被后端拒绝时提示，不假装成功', async () => {
  const { page, toasts } = setup([raw(1)], { cancelStatus: 400 })
  page.getData()
  await settle()
  page.onUseTicket({ currentTarget: { dataset: { key: page.data.unusedList[0].key } } })
  page.onCancelTicket({ currentTarget: { dataset: { id: 1 } } })
  page.confirmCancel()
  await settle()
  assert.deepEqual(toasts, ['退票失败，请联系店员'])
  cleanup()
})

test('我的雪票：不同订单的相同票不合并，各显示各的张数和金额', async () => {
  const { page } = setup([raw(1, { order_id: 100 }), raw(2, { order_id: 100 }), raw(3, { order_id: 200 }), raw(4, { order_id: 200 }), raw(5, { order_id: 200 })])
  page.getData()
  await settle()
  assert.deepEqual(page.data.unusedList.map(g => [g.orderId, g.count, g.amountNum]), [[100, 2, 618], [200, 3, 927]])
  cleanup()
})

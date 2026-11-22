const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle } = require('./reception_harness.js')
const util = require('../utils/util.js')

const FILE = 'pages/admin/rent/rent_append.js'

test('确认追加前显示押金、抵扣和需付，确认时带上抵扣预览', async () => {
  const original = util.performWebRequest
  global.getApp = () => ({ globalData: { requestPrefix: 'https://example/api/', sessionKey: 'session' } })
  let modal, sent
  global.wx = { showLoading() {}, hideLoading() {}, showToast() {}, showModal(options) { modal = options } }
  try {
    util.performWebRequest = (url, body) => { sent = { url, body }; return Promise.resolve({ deposit: 6000, offset: 5000, payable: 1000 }) }
    const page = loadPage(FILE, {})
    page.data.order = { id: 123, appendingRentals: [{ id: 77, order_id: 123, guaranty: 6000 }] }
    let next
    page._doSaveAppendings = (needPay, offset) => { next = { needPay, offset } }
    page.onConfirmAppend()
    await settle()
    assert.match(sent.url, /Rent\/GetAppendDepositQuote\/123/)
    assert.equal(sent.body[0].id, 77)
    assert.match(modal.content, /追加押金 ¥6000\.00/)
    assert.match(modal.content, /可退押金抵扣 ¥5000\.00/)
    assert.match(modal.content, /还需支付 ¥1000\.00/)
    modal.success({ confirm: true })
    assert.deepEqual(next, { needPay: true, offset: 5000 })
  } finally { util.performWebRequest = original; delete global.getApp; delete global.wx }
})

test('全额抵扣显示免补款，取消确认不会提交', async () => {
  const original = util.performWebRequest
  global.getApp = () => ({ globalData: { requestPrefix: 'https://example/api/', sessionKey: 'session' } })
  let modal, commits = 0
  global.wx = { showLoading() {}, hideLoading() {}, showToast() {}, showModal(options) { modal = options } }
  try {
    util.performWebRequest = () => Promise.resolve({ deposit: 5000, offset: 5000, payable: 0 })
    const page = loadPage(FILE, {})
    page.data.order = { id: 123, appendingRentals: [{ id: 77, order_id: 123, guaranty: 5000 }] }
    page._doSaveAppendings = () => { commits++ }
    page.onConfirmAppend(); await settle()
    assert.match(modal.content, /还需支付 ¥0\.00/)
    modal.success({ confirm: false })
    assert.equal(commits, 0)
    assert.equal(page._confirmAppendBusy, false)
  } finally { util.performWebRequest = original; delete global.getApp; delete global.wx }
})

test('提交带确认时的抵扣额，并按服务端最终应付金额进入结算', async () => {
  const original = util.performWebRequest
  global.getApp = () => ({ globalData: { requestPrefix: 'https://example/api/', sessionKey: 'session' } })
  let sent, redirect
  global.wx = { showLoading() {}, hideLoading() {}, showToast() {}, redirectTo(options) { redirect = options.url } }
  try {
    util.performWebRequest = url => { sent = url; return Promise.resolve({ id: 123, paying_amount: 1000 }) }
    const page = loadPage(FILE, {})
    page.data.order = { id: 123, appendingRentals: [{ id: 77 }] }
    page._doSaveAppendings(true, 5000)
    await settle()
    assert.match(sent, /expectedOffset=5000/)
    assert.equal(redirect, '/pages/payment/settle/index?orderId=123')
  } finally { util.performWebRequest = original; delete global.getApp; delete global.wx }
})

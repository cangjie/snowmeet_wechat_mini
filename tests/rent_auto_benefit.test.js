const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, loadComponent, settle } = require('./reception_harness.js')
const { describe } = require('../utils/rent_benefit.js')
const util = require('../utils/util.js')

const FILE = 'pages/admin/rent/rent_order_detail/rent_order_detail.js'

test('实际应退后的紧凑按钮保留退款和核销条件', () => {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/admin/rent/rent_order_detail/rent_order_detail.wxml'), 'utf8')
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/admin/rent/rent_order_detail/rent_order_detail.wxss'), 'utf8')
  const row = wxml.slice(wxml.indexOf('>实际应退</text>'), wxml.indexOf('class="refund-hint"'))
  assert.match(row, /refund-action-right[\s\S]*refund-need[\s\S]*refund-action-button[\s\S]*<van-button[\s\S]*size="mini"[\s\S]*custom-style="display: flex; margin: 0;"[\s\S]*bind:click="onRefund"/)
  assert.match(wxss, /\.refund-action-right\s*\{[^}]*display: flex;[^}]*align-items: center;/)
  assert.match(wxss, /\.refund-action-button\s*\{[^}]*display: flex;[^}]*align-items: center;/)
  assert.match(row, /disabled="\{\{order\.closed == 1 \|\| !order\._allRentalsReturned \|\| \(order\.totalRentUnRefund <= 0 && !order\._pendingWriteoff\)\}\}"/)
  assert.match(row, /order\.totalRentUnRefund > 0 \? '申请退款' : \(order\._pendingWriteoff \? '确认核销' : '申请退款'\)/)
  assert.doesNotMatch(row, /\bblock\b/)
})

function render(mode) {
  global.getApp = () => ({ globalData: { sessionKey: 'test', staff: { title_level: 300 }, uiProfile: {} }, loginPromiseNew: Promise.resolve() })
  global.wx = { showToast() {}, showLoading() {}, hideLoading() {} }
  try {
    const page = loadPage(FILE, {})
    const order = { id: 10, type: '租赁', valid: 1, closed: 0, paidAmount: 500, totalGuarantyAmount: 500,
      depositPaidAmount: 0, refundAmount: 0, availablePayments: [], retails: [],
      benefitQuote: { mode, canChange: true, fingerprint: 'f', units: [{ currentPayable: 200 }],
        quote: { payable: 100, lines: [{ usesPunch: false, usesSeason: false }] } },
      rentals: [{ id: 1, name: '单板', valid: 1, settled: 1, entertain: false, experience: false,
        guaranty: 500, totalSummary: 200, rentItems: [], details: [], pricePresets: [] }] }
    return page.renderOrder(order)
  } finally { delete global.getApp; delete global.wx }
}

test('自动匹配的会籍卡优惠进入押金退款预览', () => {
  const order = render('auto')
  assert.equal(order.totalRentSummaryAmount, 100)
  assert.equal(order.totalRentUnRefund, 400)
  assert.equal(order._pendingWriteoff, true)
})

test('店员选择不自动使用优惠时保留原金额', () => {
  const order = render('none')
  assert.equal(order.totalRentSummaryAmount, 200)
  assert.equal(order.totalRentUnRefund, 300)
  assert.equal(order._autoBenefit, false)
})

test('优惠名称与实际选中的券和卡一致', () => {
  assert.equal(describe({ quote: { couponCode: 'x' }, units: [] }), '整单优惠券')
  assert.equal(describe({ quote: { lines: [{ id: 1, usesPunch: true }, { id: 2, payable: 50 }] },
    units: [{ id: 1, gross: 200 }, { id: 2, gross: 100, coachCardId: 7 }] }), '次卡 + 会籍卡')
})

test('手动选择不使用会写入选择状态，避免后续自动覆盖', () => {
  const form = loadComponent('components/reception/rent_recept_form/rent_recept_form.js', {}, {})
  form.data.displayRentals = [{ id: 3, coach_card_id: 99, rentItems: [] }]
  form.data.coachPopup = { ridx: 0, show: true }
  form.onCoachSelectorEvent({ detail: { action: 'confirm', selectedCoachCard: null } })
  assert.equal(form.data.displayRentals[0].coach_card_id, null)
  assert.equal(form.events[0].detail.rentals[0].benefit_mode, 'none')
})

test('自动选中次卡时先核验会员，不能提前核销', () => {
  global.getApp = () => ({ globalData: { sessionKey: 'test' } })
  global.wx = { showToast() {} }
  try {
    let commit = 0
    const page = loadPage(FILE, { commitRentalBenefitPromise() { commit++; return Promise.resolve() } })
    page.data.order = { id: 1, closed: 0, _allRentalsReturned: true, _autoBenefit: true, _autoBenefitAssets: true, wechat_unverified: false }
    let purpose
    page._openWechatVerify = value => { purpose = value }
    page.onRefund()
    assert.equal(purpose, 'benefit')
    assert.equal(commit, 0)
  } finally { delete global.getApp; delete global.wx }
})

test('确认后提交报价指纹，核销成功才进入后续退款', async () => {
  global.getApp = () => ({ globalData: { sessionKey: 'test' } })
  global.wx = { showToast() {}, showLoading() {}, hideLoading() {}, showModal(o) { o.success({ confirm: true }) } }
  try {
    let posted
    const page = loadPage(FILE, { commitRentalBenefitPromise(id, fingerprint) { posted = { id, fingerprint }; return Promise.resolve() } })
    page.data.order = { id: 7, closed: 0, _allRentalsReturned: true, _autoBenefit: true, _autoBenefitAssets: false,
      _autoBenefitPayableStr: '¥100.00', benefitQuote: { fingerprint: 'version-1' } }
    let refreshed = false
    page.getData = () => { refreshed = true }
    page.onRefund()
    await settle()
    assert.deepEqual(posted, { id: 7, fingerprint: 'version-1' })
    assert.equal(refreshed, true)
  } finally { delete global.getApp; delete global.wx }
})

test('草稿保存还在进行时手动选择不使用，晚到的旧响应不会覆盖新选择', async () => {
  const previous = util.performWebRequest
  global.getApp = () => ({ globalData: { sessionKey: 'test', requestPrefix: 'https://test/' }, loginPromiseNew: Promise.resolve() })
  global.wx = { showToast() {} }
  try {
    const pending = []
    util.performWebRequest = (url, body) => new Promise(resolve => pending.push({ body, resolve }))
    const page = loadPage('pages/admin/reception/recept_new.js', {})
    const rental = { id: 7, order_id: 1, name: '雪板', benefit_mode: 'auto', rentItems: [] }
    page.data.order = { id: 1, shop: '万龙服务中心', rentals: [rental] }
    page.data.customer = {}
    page.onSyncRent({ detail: { rentals: [rental] } })
    page.onSyncRent({ detail: { rentals: [{ ...rental, benefit_mode: 'none' }] } })
    assert.equal(pending.length, 1)
    pending[0].resolve({ ...pending[0].body, id: 1 })
    await settle()
    assert.equal(pending.length, 2)
    assert.equal(pending[1].body.rentals[0].benefit_mode, 'none')
    pending[1].resolve({ ...pending[1].body, id: 1 })
    await settle()
    assert.equal(page.data.order.rentals[0].benefit_mode, 'none')
  } finally { util.performWebRequest = previous; delete global.getApp; delete global.wx }
})

test('草稿保存期间删除旧项目并添加新项目，不会把旧项目的服务端编号赋给新项目', async () => {
  const previous = util.performWebRequest
  global.getApp = () => ({ globalData: { sessionKey: 'test', requestPrefix: 'https://test/' }, loginPromiseNew: Promise.resolve() })
  global.wx = { showToast() {} }
  try {
    const pending = []
    util.performWebRequest = (url, body) => new Promise(resolve => pending.push({ body, resolve }))
    const page = loadPage('pages/admin/reception/recept_new.js', {})
    page.data.order = { id: 1, shop: '万龙服务中心', rentals: [] }
    page.data.customer = {}
    page.onSyncRent({ detail: { rentals: [{ id: 0, name: '旧项目', timeStamp: 123, rentItems: [] }] } })
    page.onSyncRent({ detail: { rentals: [{ id: 0, name: '新项目', timeStamp: 123, rentItems: [] }] } })
    pending[0].resolve({ ...pending[0].body, id: 1, rentals: [{ id: 50, name: '旧项目', rentItems: [] }] })
    await settle()
    assert.equal(pending.length, 2)
    assert.equal(pending[1].body.rentals[0].name, '新项目')
    assert.equal(pending[1].body.rentals[0].id, 0)
    pending[1].resolve({ ...pending[1].body, id: 1, rentals: [{ id: 51, name: '新项目', rentItems: [] }] })
    await settle()
    assert.equal(page.data.order.rentals[0].id, 51)
  } finally { util.performWebRequest = previous; delete global.getApp; delete global.wx }
})

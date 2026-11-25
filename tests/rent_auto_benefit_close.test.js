// 2026-11-25 用户定：租赁订单明细的「租赁优惠」自动匹配，如果没有匹配上任何券或卡，就应该关闭自动匹配。
// 原因：模式留在 auto 时，页面把这一单当成「自动核销中」——「推荐次卡 / 购买次卡」被藏起来，服务端也拒绝购买次卡（「请先关闭自动匹配」），
// 店员得先手动点「关闭自动」。
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle } = require('./reception_harness.js')
const { shouldCloseAuto } = require('../utils/rent_benefit.js')

const FILE = 'pages/admin/rent/rent_order_detail/rent_order_detail.js'

// 一张有租金明细、自动匹配没匹配上任何东西的报价（和截图一致：暂无可用优惠 · 租金 ¥250.00）
function noMatch(overrides) {
  return Object.assign({
    mode: 'auto', canChange: true, fingerprint: 'f',
    units: [{ id: 1, gross: 250, currentPayable: 250 }],
    quote: { payable: 250, lines: [{ id: 1, usesPunch: false, usesSeason: false, payable: 250 }] },
  }, overrides)
}

test('自动匹配没匹配上任何券或卡时要关闭自动匹配', () => {
  assert.equal(shouldCloseAuto(noMatch()), true)
})

test('匹配上整单券、季卡、次卡、会籍卡中的任何一种都保持自动匹配', () => {
  assert.equal(shouldCloseAuto(noMatch({ quote: { couponCode: 'C1', payable: 0, lines: [] } })), false)
  assert.equal(shouldCloseAuto(noMatch({ quote: { payable: 0, lines: [{ id: 1, usesSeason: true, payable: 0 }] } })), false)
  assert.equal(shouldCloseAuto(noMatch({ quote: { payable: 0, lines: [{ id: 1, usesPunch: true, payable: 0 }] } })), false)
  assert.equal(shouldCloseAuto(noMatch({
    units: [{ id: 1, gross: 250, currentPayable: 250, coachCardId: 7 }],
    quote: { payable: 100, lines: [{ id: 1, usesPunch: false, usesSeason: false, payable: 100 }] },
  })), false)
})

test('不是自动模式、还没有租金明细、不能修改、没有报价时，都不动自动匹配', () => {
  assert.equal(shouldCloseAuto(noMatch({ mode: 'none' })), false)
  assert.equal(shouldCloseAuto(noMatch({ units: [] })), false)          // 「等待租金明细」：还没法判断，别提前关
  assert.equal(shouldCloseAuto(noMatch({ canChange: false })), false)
  assert.equal(shouldCloseAuto(noMatch({ quote: null })), false)
  assert.equal(shouldCloseAuto(null), false)
})

function withPage(mocks, run) {
  global.getApp = () => ({ globalData: { sessionKey: 'test' } })
  global.wx = { showToast() {}, showLoading() {}, hideLoading() {} }
  return Promise.resolve().then(() => run(loadPage(FILE, mocks)))
    .finally(() => { delete global.getApp; delete global.wx })
}

test('加载租赁优惠：没匹配上就把模式设为 none，并拿关闭之后的报价', async () => {
  const calls = []
  await withPage({
    getRentalBenefitQuotePromise(id) {
      calls.push('get')
      return Promise.resolve(calls.filter(c => c === 'get').length === 1
        ? noMatch() : { mode: 'none', canChange: true, fingerprint: 'g', units: [{ id: 1 }], quote: null })
    },
    setRentalBenefitModePromise(id, mode) { calls.push('set:' + id + ':' + mode); return Promise.resolve() },
  }, async page => {
    const q = await page.loadBenefitQuote({ id: 10 })
    assert.deepEqual(calls, ['get', 'set:10:none', 'get'])
    assert.equal(q.mode, 'none')
  })
})

test('加载租赁优惠：匹配上了券或卡就保持自动，不改模式', async () => {
  const calls = []
  await withPage({
    getRentalBenefitQuotePromise() {
      calls.push('get')
      return Promise.resolve(noMatch({ quote: { payable: 0, lines: [{ id: 1, usesPunch: true, payable: 0 }] } }))
    },
    setRentalBenefitModePromise() { calls.push('set'); return Promise.resolve() },
  }, async page => {
    const q = await page.loadBenefitQuote({ id: 10 })
    assert.deepEqual(calls, ['get'])
    assert.equal(q.mode, 'auto')
  })
})

test('关闭自动匹配失败时保留原报价，不抛错也不把页面弄成加载失败', async () => {
  await withPage({
    getRentalBenefitQuotePromise() { return Promise.resolve(noMatch()) },
    setRentalBenefitModePromise() { return Promise.reject(new Error('network')) },
  }, async page => {
    const q = await page.loadBenefitQuote({ id: 10 })
    assert.equal(q.mode, 'auto')
  })
})

// 整页加载（getData）真的走这条路：截图里的订单（暂无可用优惠 · 租金 ¥250.00）打开后，库里的模式变成 none，页面按「未启用自动匹配」渲染。
test('打开订单页时，没匹配上的自动匹配被关闭，页面显示未启用', async () => {
  const calls = []
  await withPage({
    getOrderByStaffPromise() {
      return Promise.resolve({ id: 10, member_id: 5, type: '租赁', valid: 1, closed: 0, paidAmount: 500, totalGuarantyAmount: 500,
        depositPaidAmount: 0, refundAmount: 0, availablePayments: [], retails: [], member: { id: 5 },
        rentals: [{ id: 1, name: '单板', valid: 1, settled: 1, entertain: false, experience: false,
          guaranty: 500, totalSummary: 250, rentItems: [], details: [], pricePresets: [] }] })
    },
    getRentalPromise() { return Promise.resolve(null) },
    getMemberPromise() { return Promise.resolve({ availableDeposit: 0 }) },
    getRentalPunchCardInfoPromise() { return Promise.resolve(null) },
    getRentalBenefitQuotePromise() {
      calls.push('get')
      return Promise.resolve(calls.filter(c => c === 'get').length === 1
        ? noMatch() : { mode: 'none', canChange: true, fingerprint: 'g', units: [{ id: 1 }], quote: null })
    },
    setRentalBenefitModePromise(id, mode) { calls.push('set:' + id + ':' + mode); return Promise.resolve() },
  }, async page => {
    page.data.id = 10
    page.getData()
    await settle()
    await settle()
    assert.deepEqual(calls, ['get', 'set:10:none', 'get'])
    assert.equal(page.data.order.benefitQuote.mode, 'none')
    assert.equal(page.data.order._autoBenefit, false)
  })
})

test('已经是手动模式的订单加载时不会再去改模式', async () => {
  const calls = []
  await withPage({
    getRentalBenefitQuotePromise() { calls.push('get'); return Promise.resolve(noMatch({ mode: 'none' })) },
    setRentalBenefitModePromise() { calls.push('set'); return Promise.resolve() },
  }, async page => {
    await page.loadBenefitQuote({ id: 10 })
    assert.deepEqual(calls, ['get'])
  })
})

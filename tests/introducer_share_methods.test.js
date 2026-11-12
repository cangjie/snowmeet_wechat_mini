const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const api = require('../utils/introducer_api.js')
const shareList = require('../utils/share_list.js')
const { loadPage, settle, tap } = require('./reception_harness.js')

test('不支持渠道分账的订单默认银行转账，不能改选自动或手动', async t => {
  const oldWx = global.wx, oldApp = global.getApp
  global.wx = { showToast() {}, navigateBack() {} }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: {
    staff: { valid: 1, title_level: 200 }, sessionKey: 'test', requestPrefix: 'https://x/api/'
  } })
  api.setTransport(options => setImmediate(() => options.success({ statusCode: 200, data: {
    code: 0, data: options.url.includes('GetOrderShares')
      ? { canEdit: true, suggested: 10, suggestedPlanDate: '2099-01-01', shareMethodSupported: true, channelShareAvailable: false, shares: [] }
      : { choices: [] }
  } })))
  t.after(() => { global.wx = oldWx; global.getApp = oldApp; api.setTransport(options => wx.request(options)) })

  const page = loadPage('pages/introducer/share/add/add.js', {})
  await page.onLoad({ orderId: '1' })
  await settle()
  assert.equal(page.data.form.shareMethod, 'bank')
  page.onShareMethod(tap({ method: 'manual' }))
  assert.equal(page.data.form.shareMethod, 'bank')
  page.onShareMethod(tap({ method: 'auto' }))
  assert.equal(page.data.form.shareMethod, 'bank')
})

test('养护、零售和雪票订单入口均可打开分销商分账', () => {
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  for (const base of ['pages/admin/care/care_order_detail/care_order_detail', 'pages/admin/retail/retail_order_detail']) {
    assert.match(read(base + '.json'), /order-share-editor/)
    assert.match(read(base + '.wxml'), /<order-share-editor[^>]*order-id="\{\{order\.id\}\}"/)
  }
  // 2026-11-08 起「大好河山雪票」页暂时改显示雪票分账记录（skipass-share-record），不再放分销商分账卡片
  assert.match(read('pages/admin/ski_pass/dhhs_skipass_order.wxml'), /<skipass-share-record[^>]*skipass-id="\{\{item\.id\}\}"/)
})

test('雪票分账点击后进入对应订单，不把雪票编号当商品编号', () => {
  assert.equal(shareList.detailUrl({ orderType: '雪票', orderId: 55, skipassId: 21 }),
    '/pages/introducer/share/order/order?orderId=55')
})

test('分账列表显示渠道处理状态和失败原因', () => {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/introducer/share/list/list.wxml'), 'utf8')
  assert.match(wxml, /item\.channelState/)
  assert.match(wxml, /item\.channelMessage/)
})

test('按完整订单号查找后打开对应订单的分销商分账', async t => {
  const oldWx = global.wx, oldApp = global.getApp
  const calls = []
  global.wx = { showToast() {} }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: {
    staff: { valid: 1, title_level: 200 }, sessionKey: 'test', requestPrefix: 'https://x/api/'
  } })
  api.setTransport(options => {
    calls.push(options.url)
    setImmediate(() => options.success({ statusCode: 200, data: { code: 0, data: { orderId: 55, orderCode: 'SK-001', orderType: '雪票' } } }))
  })
  t.after(() => { global.wx = oldWx; global.getApp = oldApp; api.setTransport(options => wx.request(options)) })
  const page = loadPage('pages/introducer/share/order/order.js', {})
  await page.onLoad({})
  page.onCode({ detail: { value: ' SK-001 ' } })
  await page.onFind()
  assert.equal(page.data.orderId, 55)
  assert.equal(page.data.orderLabel, 'SK-001 · 雪票')
  assert.match(calls[0], /FindOrder\?.*code=SK-001/)
})

test('店长可以查看分账列表，但不能选择并发起银行转账记账', async t => {
  const oldWx = global.wx, oldApp = global.getApp
  const calls = []
  global.wx = { showToast() {}, navigateTo() {} }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: {
    staff: { valid: 1, title_level: 200 }, sessionKey: 'test', requestPrefix: 'https://x/api/'
  } })
  api.setTransport(options => {
    calls.push(options.url)
    const data = options.url.includes('/List?')
      ? { items: [{ orderShareId: 1, orderId: 1, amount: 10, mode: '银行转账', selectable: true, listDate: '2099-01-01' }], total: 1, totalAmount: 10, selectableCount: 1 }
      : { batchNo: 'MS-TEST' }
    setImmediate(() => options.success({ statusCode: 200, data: { code: 0, data } }))
  })
  t.after(() => { global.wx = oldWx; global.getApp = oldApp; api.setTransport(options => wx.request(options)) })
  const page = loadPage('pages/introducer/share/list/list.js', {})
  await page.onLoad({})
  await settle()
  page.onToggle(tap({ id: 1 }))
  await page.onOpenModal()
  assert.equal(page.data.selectedCount, 0)
  assert.equal(calls.some(url => url.includes('/NextBatchNo?')), false)
})

test('管理员可逐笔审核自动分账或手动提交渠道，手动提交不传批次号', async t => {
  const oldWx = global.wx, oldApp = global.getApp
  const calls = []
  global.wx = { showToast() {}, showModal(o) { o.success({ confirm: true }) }, navigateTo() {} }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: {
    staff: { valid: 1, title_level: 300 }, sessionKey: 'test', requestPrefix: 'https://x/api/'
  } })
  api.setTransport(options => {
    calls.push(options)
    const data = options.url.includes('/List?') ? {
      items: [
        { orderShareId: 1, orderId: 1, amount: 10, mode: '自动', canApprove: true, listDate: '2099-01-01' },
        { orderShareId: 2, orderId: 2, amount: 20, mode: '手动', canSubmitManual: true, listDate: '2099-01-01' }
      ], total: 2, totalAmount: 30, selectableCount: 0
    } : {}
    setImmediate(() => options.success({ statusCode: 200, data: { code: 0, data } }))
  })
  t.after(() => { global.wx = oldWx; global.getApp = oldApp; api.setTransport(options => wx.request(options)) })
  const page = loadPage('pages/introducer/share/list/list.js', {})
  await page.onLoad({})
  await settle()
  assert.equal(typeof page.onApprove, 'function')
  assert.equal(typeof page.onManualSubmit, 'function')
  await page.onApprove(tap({ id: 1 }))
  await page.onManualSubmit(tap({ id: 2 }))
  const approve = calls.find(c => c.url.includes('/ApproveAuto?'))
  const manual = calls.find(c => c.url.includes('/SubmitManual?'))
  assert.deepEqual(approve.data, { orderShareId: 1 })
  assert.deepEqual(manual.data, { orderShareId: 2 })
  assert.equal('batchNo' in manual.data, false)
})

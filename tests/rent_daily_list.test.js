const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { buildRentalDailyGroups } = require('../utils/rent_daily_groups.js')
const { loadPage } = require('./reception_harness.js')

const FILE = 'pages/admin/rent/rent_order_detail/rent_order_detail.js'
const wxml = fs.readFileSync(path.join(__dirname, '../pages/admin/rent/rent_order_detail/rent_order_detail.wxml'), 'utf8')

const row = (date, amount, extra = {}) => ({ dateStr: date, rentDetailId: 1, rentStr: '¥' + amount, ...extra })

test('按商品保留订单顺序，按日期正序；同名商品仍分别显示', () => {
  const groups = buildRentalDailyGroups([
    { name: '双板', feeRows: [row('2026-11-22', '200.00'), row('2026-11-20', '180.00')] },
    { name: '双板', feeRows: [row('2026-11-20', '150.00')] },
    { name: '头盔', feeRows: [] },
  ])
  assert.deepEqual(groups.products.map(g => [g.name, g.rows.map(x => x.date)]), [
    ['双板', ['2026-11-20', '2026-11-22']], ['双板', ['2026-11-20']], ['头盔', []],
  ])
  assert.deepEqual(groups.dates.map(g => [g.date, g.rows.map(x => x.rentStr)]), [
    ['2026-11-20', ['¥180.00', '¥150.00']], ['2026-11-22', ['¥200.00']],
  ])
  assert.notEqual(groups.products[0].key, groups.products[1].key)
  assert.notEqual(groups.dates[0].rows[0].key, groups.dates[0].rows[1].key)
})

test('商品总计和日期总计累加每日小计，排除已免除并按分计算', () => {
  const groups = buildRentalDailyGroups([
    { name: '双板', feeRows: [row('2026-11-20', '0.10', { subtotal: 0.1 }),
      row('2026-11-21', '60.00', { subtotal: 60, waived: true }),
      row('2026-11-22', '0.20', { subtotal: 0.2 })] },
    { name: '头盔', feeRows: [row('2026-11-20', '170.00', { subtotal: 170 })] },
    { name: '暂无明细', feeRows: [] },
  ])
  assert.deepEqual(groups.products.map(g => g.totalStr), ['¥0.30', '¥170.00', '¥0.00'])
  assert.deepEqual(groups.dates.map(g => [g.date, g.totalStr]), [
    ['2026-11-20', '¥170.10'], ['2026-11-21', '¥0.00'], ['2026-11-22', '¥0.20'],
  ])
  assert.equal((wxml.match(/\{\{group\.totalStr\}\}/g) || []).length, 2)
})

test('排除只有超时费的行，保留免除、招待及价目提示', () => {
  const groups = buildRentalDailyGroups([
    { name: '雪板', entertain: true, feeRows: [
      row('2026-11-20', '200.00', { waived: true, sceneStr: '预约价' }),
      { dateStr: '2026-11-21', rentDetailId: null, overtimeStr: '¥30.00' },
    ] },
  ])
  assert.equal(groups.dates.length, 1)
  assert.equal(groups.products[0].rows[0].waived, true)
  assert.equal(groups.products[0].rows[0].entertain, true)
  assert.equal(groups.products[0].rows[0].sceneStr, '预约价')
})

test('打开、切换、关闭弹窗，重新渲染订单后明细同步更新', () => {
  global.getApp = () => ({ globalData: { sessionKey: 'test', staff: { title_level: 300 }, uiProfile: {} }, loginPromiseNew: Promise.resolve() })
  global.wx = { showToast() {}, showLoading() {}, hideLoading() {} }
  try {
    const page = loadPage(FILE, {})
    const order = { id: 1, valid: 1, closed: 0, paidAmount: 0, totalGuarantyAmount: 0, availablePayments: [], retails: [],
      rentals: [{ id: 1, name: '单板', guaranty: 0, rentItems: [], pricePresets: [], details: [
        { id: 11, valid: 1, charge_type: '租金', rental_date: '2026-11-20T00:00:00', amount: 180 },
        { id: 12, valid: 1, charge_type: '超时费', rental_date: '2026-11-21T00:00:00', amount: 20 },
      ] }] }
    page.data.order = page.renderOrder(order)
    page.onOpenRentList()
    assert.equal(page.data._rentListShow, true)
    assert.equal(page.data._rentListGroup, 'product')
    assert.equal(page.data.order._rentByDate.length, 1)
    assert.equal(page.data.order._rentByProduct[0].rows[0].rentStr, '¥180.00')
    page.onRentListGroupChange({ currentTarget: { dataset: { group: 'date' } } })
    assert.equal(page.data._rentListGroup, 'date')
    order.rentals[0].details[0].amount = 150
    page.data.order = page.renderOrder(order)
    assert.equal(page.data.order._rentByDate[0].rows[0].rentStr, '¥150.00')
    page.onCloseRentList()
    assert.equal(page.data._rentListShow, false)
    assert.match(wxml, /<van-button type="primary" block bind:click="onOpenRentList">查看租金<\/van-button>/)
    assert.ok(wxml.indexOf('bind:click="onOpenRentList"') > wxml.indexOf('<!-- Tab 1: 按租赁物 -->'))
    assert.ok(wxml.indexOf('bind:click="onOpenRentList"') < wxml.indexOf('<order-share-editor'))
    assert.match(wxml, /按租赁商品/)
    assert.match(wxml, /按租赁日期/)
  } finally { delete global.getApp; delete global.wx }
})

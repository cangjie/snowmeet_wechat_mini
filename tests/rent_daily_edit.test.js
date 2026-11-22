const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, settle } = require('./reception_harness.js')

const FILE = 'pages/admin/rent/rent_order_detail/rent_order_detail.js'
const wxml = fs.readFileSync(path.join(__dirname, '../pages/admin/rent/rent_order_detail/rent_order_detail.wxml'), 'utf8')
const wxss = fs.readFileSync(path.join(__dirname, '../pages/admin/rent/rent_order_detail/rent_order_detail.wxss'), 'utf8')

function rental(id, name, details) {
  return { id, name, valid: 1, guaranty: 0, rentItems: [], pricePresets: [], details }
}
function rent(id, date, amount, valid = 1) {
  return { id, valid, charge_type: '租金', rental_date: date + 'T00:00:00', amount, discounts: [] }
}
function orderFixture() {
  return { id: 1, valid: 1, closed: 0, paidAmount: 0, totalGuarantyAmount: 0, availablePayments: [], retails: [],
    rentals: [
      rental(1, '头盔', [rent(11, '2026-11-20', 50)]),
      rental(2, '双板', [
        { id: 22, valid: 1, charge_type: '超时费', rental_date: '2026-11-19T00:00:00', amount: 5 },
        rent(21, '2026-11-21', 200), rent(20, '2026-11-20', 180),
      ]),
    ] }
}

function openRow(page, row) {
  page.onEditDayCharge({ currentTarget: { dataset: { ridx: row.rentalIndex, fidx: row.feeIndex } } })
}

test('两种分组的行保留原始索引，点击相同商品和日期打开对应租金编辑', () => {
  global.getApp = () => ({ globalData: { sessionKey: 'test', staff: { title_level: 300 }, uiProfile: {} }, loginPromiseNew: Promise.resolve() })
  global.wx = { showToast() {}, showLoading() {}, hideLoading() {} }
  try {
    const page = loadPage(FILE, {})
    page.data.order = page.renderOrder(orderFixture())
    page.onOpenRentList()
    const byProduct = page.data.order._rentByProduct[1].rows[0]
    assert.equal(byProduct.date, '2026-11-20')
    assert.equal(byProduct.rentalIndex, 1)
    assert.equal(byProduct.feeIndex, 2, '筛除纯超时行和排序后，仍要保留原 feeRows 索引')
    openRow(page, byProduct)
    assert.equal(page.data._dayChargeDetailId, 20)
    assert.equal(page.data._dayChargeRentOrig, '180')
    page.onDayChargeCancel()
    assert.equal(page.data._rentListShow, true)
    page.onRentListGroupChange({ currentTarget: { dataset: { group: 'date' } } })
    const byDate = page.data.order._rentByDate[0].rows.find(row => row.name === '双板')
    openRow(page, byDate)
    assert.equal(page.data._dayChargeDetailId, 20)
    assert.equal(page.data._dayChargeRidx, 1)
    assert.equal(page.data._rentListGroup, 'date')
    assert.equal((wxml.match(/bindtap="onEditDayCharge" data-ridx="\{\{row\.rentalIndex\}\}" data-fidx="\{\{row\.feeIndex\}\}"/g) || []).length, 2)
    assert.match(wxss, /\.dc-mask--over-rent-list\s*\{\s*z-index:\s*1100/)
  } finally { delete global.getApp; delete global.wx }
})

test('保存租金、超时费和减免后，两种分组更新；免除和恢复沿用原接口', async () => {
  global.getApp = () => ({ globalData: { sessionKey: 'test', staff: { title_level: 300 }, uiProfile: {} }, loginPromiseNew: Promise.resolve() })
  global.wx = { showToast() {}, showLoading() {}, hideLoading() {} }
  try {
    const calls = []
    let updatedRental
    const page = loadPage(FILE, { updateRentalDayChargesPromise(...args) { calls.push(args); return Promise.resolve(updatedRental) } })
    page.data.order = page.renderOrder(orderFixture())
    page.onOpenRentList()
    page.onRentListGroupChange({ currentTarget: { dataset: { group: 'date' } } })
    openRow(page, page.data.order._rentByDate[0].rows.find(row => row.name === '双板'))
    page.onDayChargeInput({ currentTarget: { dataset: { field: 'Rent' } }, detail: { value: '160' } })
    page.onDayChargeInput({ currentTarget: { dataset: { field: 'Overtime' } }, detail: { value: '20' } })
    page.onDayChargeInput({ currentTarget: { dataset: { field: 'Discount' } }, detail: { value: '10' } })
    const changed = rent(20, '2026-11-20', 160)
    changed.discounts = [{ amount: 10, ticket_code: null }]
    updatedRental = rental(2, '双板', [changed, { id: 23, valid: 1, charge_type: '超时费', rental_date: '2026-11-20T00:00:00', amount: 20 }])
    page.onDayChargeConfirm()
    await settle()
    assert.deepEqual(calls[0].slice(0, 5), [2, 20, 160, 20, 10])
    assert.equal(calls[0][7], false)
    assert.equal(page.data._dayChargeShow, false)
    assert.equal(page.data._rentListShow, true)
    assert.equal(page.data._rentListGroup, 'date')
    const saved = page.data.order._rentByDate[0].rows.find(row => row.name === '双板')
    assert.deepEqual([saved.rentStr, saved.overtimeStr, saved.discountStr, saved.subtotalStr], ['¥160.00', '¥20.00', '¥10.00', '¥170.00'])
    assert.equal(page.data.order._rentByProduct[1].rows[0].subtotalStr, '¥170.00')
    assert.equal(page.data.order._rentByProduct[1].totalStr, '¥170.00')
    assert.equal(page.data.order._rentByDate[0].totalStr, '¥220.00')
    openRow(page, saved)
    page.onDayChargeWaivedToggle()
    updatedRental = rental(2, '双板', [rent(20, '2026-11-20', 160, 0),
      { id: 23, valid: 0, charge_type: '超时费', rental_date: '2026-11-20T00:00:00', amount: 20 }])
    page.onDayChargeConfirm()
    await settle()
    assert.equal(calls[1][7], true)
    assert.equal(page.data.order._rentByProduct[1].rows[0].waived, true)
    assert.equal(page.data.order._rentByProduct[1].totalStr, '¥0.00')
    assert.equal(page.data.order._rentByDate[0].totalStr, '¥50.00')
    openRow(page, page.data.order._rentByProduct[1].rows[0])
    assert.equal(page.data._dayChargeWaived, true)
    page.onDayChargeWaivedToggle()
    updatedRental = rental(2, '双板', [rent(20, '2026-11-20', 160)])
    page.onDayChargeConfirm()
    await settle()
    assert.equal(calls[2][7], false)
    assert.equal(page.data.order._rentByProduct[1].rows[0].waived, false)
    assert.equal(page.data.order._rentByProduct[1].totalStr, '¥160.00')
    assert.equal(page.data.order._rentByDate[0].totalStr, '¥210.00')
  } finally { delete global.getApp; delete global.wx }
})

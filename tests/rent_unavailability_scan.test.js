const test = require('node:test')
const assert = require('node:assert/strict')
const { loadComponent } = require('./reception_harness.js')

test('重新扫码后清除旧租赁物 ID，让结算按新编码检查不可用时段', () => {
  global.wx = { scanCode({ success }) { success({ result: 'NEW-202' }) }, showToast() {} }
  const form = loadComponent('components/reception/rent_recept_form/rent_recept_form.js', {}, { shop: '万龙服务中心' })
  form._refreshRentals([{ id: 1, pick_type: '立即租赁', start_date: '2026-11-19T09:00:00', rentItems: [
    { category_id: 1, pick_type: '立即租赁', code: 'OLD-101', rent_product_id: 101, noCode: false }
  ] }])
  form.onItemScan({ currentTarget: { dataset: { ridx: 0, iidx: 0 } } })
  const item = form.data.displayRentals[0].rentItems[0]
  assert.equal(item.code, 'NEW-202')
  assert.equal(item.rent_product_id, null)
})

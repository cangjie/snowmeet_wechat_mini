const test = require('node:test')
const assert = require('node:assert/strict')
const crossShop = require('../utils/cross_shop_rent.js')
const { loadComponent, tap } = require('./reception_harness.js')

test('异店目标按开单门店确定，其他门店不可选择', () => {
  assert.deepEqual(crossShop.destinations('崇礼旗舰店'), ['万龙服务中心', '万龙体验中心'])
  assert.deepEqual(crossShop.destinations('万龙体验中心'), ['万龙服务中心'])
  assert.deepEqual(crossShop.destinations('万龙服务中心'), ['万龙体验中心'])
  assert.deepEqual(crossShop.destinations('其他门店'), [])
})

test('套餐选异店后默认每件异店，单件可独立改回本店', () => {
  let action
  global.wx = { showActionSheet(o) { action = o }, showToast() {} }
  const component = loadComponent('components/reception/rent_recept_form/rent_recept_form.js', {}, { shop: '崇礼旗舰店' })
  component.data.shop = '崇礼旗舰店'
  component.data.displayRentals = [{ pick_type: '立即租赁', rentItems: [
    { name: '鞋', category_id: 1, noCode: true, pick_type: '立即租赁', atOnce: true },
    { name: '板', category_id: 2, noCode: true, pick_type: '立即租赁', atOnce: true }
  ] }]
  component._emitSync = () => {}
  component._updateRentalChip = () => {}
  component._repriceForDate = () => {}

  component.onPkgModeTap(tap({ ridx: 0, mode: 'cross' }))
  assert.deepEqual(action.itemList, ['万龙服务中心', '万龙体验中心'])
  action.success({ tapIndex: 0 })
  assert.deepEqual(component.data.displayRentals[0].rentItems.map(i => i.pickup_shop), ['万龙服务中心', '万龙服务中心'])
  assert.ok(component.data.displayRentals[0].rentItems.every(i => i.atOnce === false))
  component.onItemModeTap(tap({ ridx: 0, iidx: 1, mode: 'now' }))
  assert.equal(component.data.displayRentals[0].rentItems[0].pickup_shop, '万龙服务中心')
  assert.equal(component.data.displayRentals[0].rentItems[1].pickup_shop, null)
  assert.equal(component.data.displayRentals[0].rentItems[1].atOnce, true)
  delete global.wx
})

test('变更单件领取门店时清除之前的编码，其他装备不受影响', () => {
  let action
  global.wx = { showActionSheet(o) { action = o }, showToast() {} }
  const component = loadComponent('components/reception/rent_recept_form/rent_recept_form.js', {}, { shop: '崇礼旗舰店' })
  component.data.shop = '崇礼旗舰店'
  component.data.displayRentals = [{ pick_type: '立即租赁', rentItems: [
    { name: '鞋', code: 'OLD', rent_product_id: 7, category_id: 1, noCode: false, pick_type: '立即租赁' },
    { name: '板', code: 'BOARD', category_id: 2, noCode: false, pick_type: '立即租赁' }
  ] }]
  component._emitSync = () => {}
  component._updateRentalChip = () => {}
  component.onItemModeTap(tap({ ridx: 0, iidx: 0, mode: 'cross' }))
  action.success({ tapIndex: 1 })
  const [shoe, board] = component.data.displayRentals[0].rentItems
  assert.equal(shoe.pickup_shop, '万龙体验中心')
  assert.equal(shoe.code, '')
  assert.equal(shoe.rent_product_id, null)
  assert.equal(shoe.atOnce, false)
  assert.equal(board.code, 'BOARD')
  delete global.wx
})

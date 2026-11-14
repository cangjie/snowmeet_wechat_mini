const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadComponent } = require('./reception_harness.js')

function item(extra = {}) {
  return { category_id: 1, pick_type: '立即租赁', noCode: false, code: 'B-1', ...extra }
}
function rental(items, extra = {}) {
  return { id: 1, pick_type: '立即租赁', start_date: '2026-11-13T09:00:00', rentItems: items, ...extra }
}
function setup(rentals) {
  global.wx = { showToast() {} }
  const form = loadComponent('components/reception/rent_recept_form/rent_recept_form.js', {}, { shop: '万龙服务中心' })
  const setData = form.setData.bind(form)
  form.setData = (patch, callback) => { setData(patch); if (callback) callback() }
  form._refreshRentals(rentals)
  return form
}
function input(ridx, iidx, field, value) {
  return { currentTarget: { dataset: { ridx, iidx, field } }, detail: { value } }
}

test('输入最后一个必填名称时立即可结算，清空后立即禁用，失焦才保存', () => {
  const form = setup([rental([item({ noCode: true, name: '' })])])
  assert.equal(form.data.summary.canCheckout, false)
  form.onItemFieldInput(input(0, 0, 'itemName', '雪杖'))
  assert.equal(form.data.summary.canCheckout, true)
  assert.equal(form.data.displayRentals[0]._rentalStatusLabel, '已录入')
  assert.equal(form.events.length, 0)
  form.onItemFieldBlur(input(0, 0, 'itemName', '雪杖'))
  assert.equal(form.events.at(-1).detail.rentals[0].rentItems[0].name, '雪杖')
  form.onItemFieldInput(input(0, 0, 'itemName', '  '))
  assert.equal(form.data.summary.canCheckout, false)
  const wxml = fs.readFileSync(path.join(__dirname, '../components/reception/rent_recept_form/rent_recept_form.wxml'), 'utf8')
  assert.match(wxml, /catchinput="onItemFieldInput"\s+catchblur="onItemFieldBlur"/)
})

test('必须所有商品及租赁物的必要信息都完整，修改或移除后重算', () => {
  const form = setup([rental([item()]), rental([item({ code: '' })], { id: 2 })])
  assert.equal(form.data.summary.canCheckout, false)
  form.data.searchRidx = 1; form.data.searchIidx = 0
  form.onProductConfirm({ detail: { product: { id: 2, barcode: 'B-2', category_id: 1 } } })
  assert.equal(form.data.summary.canCheckout, true)
  form.onItemCodeFlag({ currentTarget: { dataset: { ridx: 1, iidx: 0, flag: 'no_code' } } })
  assert.equal(form.data.summary.canCheckout, false)
  form.onItemCodeFlag({ currentTarget: { dataset: { ridx: 1, iidx: 0, flag: 'not_required' } } })
  assert.equal(form.data.summary.canCheckout, true)
  form._refreshRentals([])
  assert.equal(form.data.summary.canCheckout, false)
})

test('缺商品模式、起租日期、主项分类、租赁物模式或异店领取门店时不能结算', () => {
  const cases = [
    // 商品没选模式、装备模式也对不上才算缺商品模式；装备模式一致时商品按钮会按装备亮起、校验也认（见 rent_mode_derived_from_items.test.js）
    rental([item(), item({ pick_type: '先租后取', code: 'B-2' })], { pick_type: null }),
    rental([item()], { start_date: null }),
    rental([item({ category_id: null })]),
    rental([item({ pick_type: null })]),
    rental([item({ pick_type: '异店租赁', pickup_shop: null })]),
  ]
  for (const r of cases) {
    const form = setup([r])
    assert.equal(form.data.summary.canCheckout, false)
    form.data.displayRentals[0]._rentalEntered = true
    form._refreshSummary()
    assert.equal(form.data.summary.canCheckout, false, '不能依赖过期的录入状态缓存')
    form.onCheckout()
    assert.equal(form.events.some(event => event.name === 'checkout'), false)
  }
  assert.equal(setup([rental([item({ pick_type: '异店租赁', pickup_shop: '万龙体验中心', code: '' })])]).data.summary.canCheckout, true)
})

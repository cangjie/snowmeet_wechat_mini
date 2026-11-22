const test = require('node:test')
const assert = require('node:assert/strict')
const { loadComponent } = require('./reception_harness.js')

const SEARCH = 'components/reception/search_product_fuzzy/search_product_fuzzy.js'
const FORM = 'components/reception/rent_recept_form/rent_recept_form.js'
const product = (barcode, status) => ({
  id: Number(barcode), barcode, name: '单板', category_id: 69,
  category: { id: 69, name: '普通单板' }, status
})

test('搜索精确编码时提示不可用，不会误选其他相似编码', async () => {
  const toasts = []
  global.wx = { showToast: ({ title }) => toasts.push(title) }
  const search = loadComponent(SEARCH, {
    searchBarCodeFuzzyPromise: async () => [product('108', '不可用'), product('1080', null)]
  })
  search.setData({ keyword: '108' })
  search.onSearch()
  await Promise.resolve()
  assert.equal(search.data.selectedIndex, -1)
  assert.deepEqual(toasts, ['该租赁物暂不可用'])
  search.onSelect({ currentTarget: { dataset: { idx: 0 } } })
  assert.equal(search.data.selectedIndex, -1)
  assert.equal(toasts.at(-1), '该租赁物暂不可用')
  search.onSelect({ currentTarget: { dataset: { idx: 1 } } })
  search.onConfirm()
  assert.equal(search.events[0].detail.product.barcode, '1080')
})

test('空状态或正常可选，租赁中等其他状态不可选', () => {
  global.wx = { showToast() {} }
  const search = loadComponent(SEARCH, {})
  assert.deepEqual(search._decorateProducts([
    product('101', null), product('102', '正常'), product('103', '租赁中'), product('104', '维修')
  ]).map(p => p._disabled), [false, false, true, true])
})

test('开单表单也拒绝不可用搜索结果，不能添加或覆盖现有租赁物', () => {
  const toasts = []
  global.wx = { showToast: ({ title }) => toasts.push(title) }
  const form = loadComponent(FORM, {}, { shop: '万龙体验中心' })
  form._refreshRentals([{ id: 1, rentItems: [{ id: 2, category_id: 69, noCode: false, code: 'OLD' }] }])
  form.setData({ searchAddNew: true })
  form.onProductConfirm({ detail: { product: product('108', '租赁中') } })
  assert.equal(form.events.some(e => e.name === 'addSingleProduct'), false)
  form.setData({ searchAddNew: false, searchRidx: 0, searchIidx: 0 })
  form.onProductConfirm({ detail: { product: product('108', '不可用') } })
  assert.equal(form.data.displayRentals[0].rentItems[0].code, 'OLD')
  assert.deepEqual(toasts, ['该租赁物暂不可用', '该租赁物暂不可用'])
})

const test = require('node:test')
const assert = require('node:assert/strict')
const { loadComponent } = require('./reception_harness.js')
const trialApi = require('../utils/trial_api.js')
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

const FILE = 'components/reception/rent_recept_form/rent_recept_form.js'
const product = (code, extra = {}) => ({
  id: Number(code) + 178, barcode: code, name: '【武士团】151cm',
  category_id: 69, category: { name: '【其他】普通单板' }, status: null, ...extra
})
const item = extra => ({
  id: 21, category_id: 69, class_name: '【其他】普通单板', name: '', code: '',
  noCode: true, noNeed: false, pick_type: '立即租赁', memo: '保留备注', ...extra
})
const input = (form, value, ridx = 0, iidx = 0) => form.onItemFieldInput({
  currentTarget: { dataset: { ridx, iidx, field: 'itemName' } }, detail: { value }
})
const blur = (form, value) => form.onItemFieldBlur({
  currentTarget: { dataset: { ridx: 0, iidx: 0, field: 'itemName' } }, detail: { value }
})

function setup(search, items = [item()]) {
  trialApi.request = async () => ({ available: true })
  const toasts = []
  global.wx = { showToast: ({ title }) => toasts.push(title) }
  const form = loadComponent(FILE, {}, { shop: '万龙体验中心' })
  form._searchSnowboard = key => search(key, 69)
  form._refreshRentals([{ id: 11, pick_type: '立即租赁', start_date: '2026-11-21T09:00:00', rentItems: items }])
  return { form, toasts }
}

test('仅普通单板的指定完整数字停输入一秒后精确匹配并回填，失焦不会重置计时', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const calls = []
  const { form, toasts } = setup(async (key, category) => {
    calls.push([key, category])
    return [product('1108'), product(key), product(key, { category_id: 70 })]
  })
  input(form, '108')
  t.mock.timers.tick(500)
  blur(form, '108')
  form.onCheckout()
  assert.deepEqual(toasts, ['正在查询单板，请稍候'])
  t.mock.timers.tick(499)
  assert.equal(calls.length, 0)
  t.mock.timers.tick(1)
  await flush()
  assert.deepEqual(calls, [['108', 69]])
  const current = form.data.displayRentals[0].rentItems[0]
  assert.equal(current.name, '【武士团】151cm')
  assert.equal(current.code, '108')
  assert.equal(current.rent_product_id, 286)
  assert.equal(current.noCode, false)
  assert.equal(current.memo, '保留备注')
  assert.ok(form.events.some(e => e.name === 'syncRent' && e.detail.rentals[0].rentItems[0].rent_product_id === 286))
  blur(form, '108')
  assert.equal(current.name, '【武士团】151cm', '失焦旧值不能覆盖选中的名称')
  form.onItemCodeFlag({ currentTarget: { dataset: { ridx: 0, iidx: 0, flag: 'no_code' } } })
  assert.equal(current.rent_product_id, null, '切换回无码时清除原租赁物关联')
})

test('五个指定编码均会查询并填入各自的租赁物', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const code of ['108', '109', '110', '111', '112']) {
    const { form } = setup(async key => [product(key)])
    input(form, code)
    t.mock.timers.tick(1000)
    await flush()
    const current = form.data.displayRentals[0].rentItems[0]
    assert.equal(current.code, code)
    assert.equal(current.rent_product_id, Number(code) + 178)
    assert.equal(current.noCode, false)
  }
})

test('仅指定数字和分类触发，其他名称或分类保持原行为', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const calls = []
  const { form } = setup(async key => { calls.push(key); return [product(key)] }, [item(), item({ id: 22, category_id: 70 })])
  input(form, '1080')
  input(form, '108', 0, 1)
  t.mock.timers.tick(2000)
  assert.deepEqual(calls, [])
  assert.equal(form.data.displayRentals[0].rentItems[0].name, '1080')
  assert.equal(form.data.displayRentals[0].rentItems[1].name, '108')
})

test('输入变化后迟到的查询不能覆盖新内容，卸载后不再回填', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let resolve
  const { form } = setup(() => new Promise(r => { resolve = r }))
  input(form, '108')
  t.mock.timers.tick(1000)
  input(form, '自填名称')
  resolve([product('108')])
  await flush()
  assert.equal(form.data.displayRentals[0].rentItems[0].name, '自填名称')
  input(form, '109')
  form.invokeLifecycle('detached')
  t.mock.timers.tick(1000)
  assert.equal(form.data.displayRentals[0].rentItems[0].name, '109')
})

test('不可用、重复编码、未找到和请求失败时不自动选择并提示', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const [search, items, message] of [
    [async () => [product('108', { status: '租赁中' })], [item()], '该租赁物暂不可用'],
    [async () => [product('108', { status: '不可用' })], [item()], '该租赁物暂不可用'],
    [async () => [product('108')], [item(), item({ id: 22, noCode: false, code: '108' })], '编码已被占用'],
    [async () => [], [item()], '未找到该编码的单板'],
    [async () => { throw new Error('offline') }, [item()], '查询单板失败，请重试'],
  ]) {
    const { form, toasts } = setup(search, items)
    input(form, '108')
    blur(form, '108')
    t.mock.timers.tick(1000)
    await flush()
    assert.equal(form.data.displayRentals[0].rentItems[0].name, '108')
    assert.equal(form.data.displayRentals[0].rentItems[0].noCode, true)
    assert.ok(toasts.includes(message))
    assert.ok(form.events.some(e => e.name === 'syncRent'), '失焦的名称仍应保存')
    form.onCheckout()
    assert.equal(form.events.some(e => e.name === 'checkout'), false, '未确认的编码不能作为无码名称结算')
  }
})

test('刷新和排序后仍只回填原来的租赁物，移除后不回填其他项目', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let resolve
  const { form } = setup(() => new Promise(r => { resolve = r }))
  input(form, '108')
  t.mock.timers.tick(1000)
  form._refreshRentals([
    { id: 12, pick_type: '立即租赁', rentItems: [item({ id: 22, name: '108' })] },
    { id: 11, pick_type: '立即租赁', rentItems: [item({ name: '108' })] },
  ])
  resolve([product('108')])
  await flush()
  assert.equal(form.data.displayRentals.find(r => r.id === 11).rentItems[0].code, '108')
  assert.equal(form.data.displayRentals.find(r => r.id === 12).rentItems[0].code, '')
})

test('草稿保存的旧响应不会覆盖正在查询的输入', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { form } = setup(async key => [product(key)])
  input(form, '112')
  form._refreshRentals([{ id: 11, pick_type: '立即租赁', rentItems: [item({ name: '' })] }])
  assert.equal(form.data.displayRentals[0].rentItems[0].name, '112')
  t.mock.timers.tick(1000)
  await flush()
  assert.equal(form.data.displayRentals[0].rentItems[0].code, '112')
})

test('查询失败后再次失焦可以重试，草稿中未确认的编码也可以重试', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let calls = 0
  const { form } = setup(async key => ++calls === 1 ? [] : [product(key)])
  input(form, '110')
  blur(form, '110')
  t.mock.timers.tick(1000)
  await flush()
  blur(form, '110')
  t.mock.timers.tick(1000)
  await flush()
  assert.equal(calls, 2)
  assert.equal(form.data.displayRentals[0].rentItems[0].code, '110')
})

test('试滑预约冲突时自动查询不选板，已选板禁止去结算', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { form, toasts } = setup(async key => [product(key)])
  trialApi.request = async () => ({ available: false })
  input(form, '108')
  t.mock.timers.tick(1000)
  await flush()
  assert.equal(form.data.displayRentals[0].rentItems[0].rent_product_id, undefined)
  assert.ok(toasts.includes('该租赁物暂不可用'))

  const selected = setup(async key => [product(key)], [item({ noCode: false, code: '108', rent_product_id: 286 })]).form
  trialApi.request = async () => ({ available: false })
  selected._trialCheckKey = null
  selected._refreshSummary()
  await flush()
  assert.equal(selected.data.summary.canCheckout, false)
  selected.onCheckout()
  assert.equal(selected.events.some(e => e.name === 'checkout'), false)
})

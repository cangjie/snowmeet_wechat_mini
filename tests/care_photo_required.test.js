// 养护开单：每件装备的照片必填（用户 2026-11-25 要求）。
//   · 以前是「图片 或 品牌+长度」二选一，现在不传照片就不能结算；
//   · 还在上传中的照片不算（上传没完成，后面保存会丢）；
//   · 照片传好、没填品牌长度也可以（照片本身就能认出装备）；
//   · 多件装备里有一件没照片，整单都不能结算；
//   · 「先选卡再做养护」入口（addCard）同样要求每件装备都有照片。
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadComponent, settle, tap } = require('./reception_harness')

const FORM = 'components/reception/care_recept_form/care_recept_form.js'

const photo = (patch) => Object.assign({ id: 0, care_id: 0, image_id: 9, status: 'success', url: 'https://img.test/a.jpg', thumb: 'https://img.test/a_t.jpg' }, patch || {})
function care(patch) {
  return Object.assign({ id: 1, equipment: '双板', brand: '测试', scale: '170', need_edge: 1, edge_degree: '89', need_wax: 0, need_unwax: 0, free_wax: 0,
    use_card: false, card_id: null, ticket_code: null, common_charge: 170, repair_charge: 0, discount: 0, careImages: [photo()] }, patch || {})
}

function setup(t, rows) {
  const oldApp = global.getApp, oldWx = global.wx
  global.getApp = () => ({ globalData: { sessionKey: 'staff' }, loginPromiseNew: Promise.resolve() })
  const toasts = []
  global.wx = { showToast: o => toasts.push(o.title) }
  t.after(() => { global.getApp = oldApp; global.wx = oldWx })
  const form = loadComponent(FORM, {
    getMemberTicketsPromise: async () => [],
    getMemberCardsPromise: async () => [],
    getMemberAssetsByStaffPromise: async () => ({ depositTotal: 0 }),
    getMemberCaredEquipmentsPromise: async () => [],
    calcCareChargePromise: async req => ({ care: Object.assign({}, req.care) })
  })
  Object.assign(form.data, { memberId: null, shop: '测试店', newCardMode: '', cares: rows || [care()] })
  form._refreshCares()
  return { form, toasts }
}
const row = (form, i) => form.data.displayCares[i || 0]
const addCardEvents = form => form.events.filter(e => e.name === 'addCard')

test('有品牌和长度但没传照片：不能结算，状态写「照片必填」', async t => {
  const { form } = setup(t, [care({ careImages: [] })])
  assert.equal(row(form)._entered, false)
  assert.equal(row(form)._statusLabel, '照片必填')
  assert.equal(form.data.summary.canCheckout, false)
  await settle()
})

test('careImages 为空值（没有这个字段）也一样不能结算', async t => {
  const { form } = setup(t, [care({ careImages: undefined }), care({ id: 2, careImages: null })])
  assert.equal(row(form, 0)._statusLabel, '照片必填')
  assert.equal(row(form, 1)._statusLabel, '照片必填')
  assert.equal(form.data.summary.canCheckout, false)
  await settle()
})

test('传好一张照片：可以结算', async t => {
  const { form } = setup(t, [care()])
  assert.equal(row(form)._entered, true)
  assert.equal(row(form)._statusLabel, '已录入')
  assert.equal(form.data.summary.canCheckout, true)
  await settle()
})

test('照片还在上传中：不能结算，提示「照片上传中」；传完才放行', async t => {
  const { form } = setup(t, [care({ careImages: [photo({ image_id: 0, status: 'uploading' })] })])
  assert.equal(row(form)._entered, false)
  assert.equal(row(form)._statusLabel, '照片上传中')
  assert.equal(form.data.summary.canCheckout, false)
  form.data.cares = [care({ careImages: [photo()] })]
  form._refreshCares()
  assert.equal(form.data.summary.canCheckout, true)
  await settle()
})

test('没填品牌长度、只传了照片：可以结算（照片本身就能认出装备）', async t => {
  const { form } = setup(t, [care({ brand: null, scale: null })])
  assert.equal(row(form)._entered, true)
  assert.equal(form.data.summary.canCheckout, true)
  await settle()
})

test('找回中断单：后端只带 image 导航对象的照片，也算有照片', async t => {
  const { form } = setup(t, [care({ careImages: [{ id: 5, image: { file_path_name: '/upload/a.jpg', thumbUrl: '/upload/a_t.jpg' } }] })])
  assert.equal(row(form)._entered, true)
  assert.equal(form.data.summary.canCheckout, true)
  await settle()
})

test('多件装备：只要有一件没照片，整单都不能结算', async t => {
  const { form } = setup(t, [care({ id: 1 }), care({ id: 2, careImages: [] })])
  assert.equal(row(form, 0)._entered, true)
  assert.equal(row(form, 1)._entered, false)
  assert.equal(form.data.summary.canCheckout, false)
  form.data.cares = [care({ id: 1 }), care({ id: 2 })]
  form._refreshCares()
  assert.equal(form.data.summary.canCheckout, true)
  await settle()
})

test('把最后一张照片删掉以后，又变回不能结算', async t => {
  const { form } = setup(t, [care()])
  assert.equal(form.data.summary.canCheckout, true)
  form.onPhotoDelete({ currentTarget: { dataset: { cidx: 0 } }, detail: { index: 0 } })
  assert.equal(row(form).careImages.length, 0)
  assert.equal(row(form)._statusLabel, '照片必填')
  assert.equal(form.data.summary.canCheckout, false)
  await settle()
})

test('已绑季卡、装备信息被锁定的装备同样要传照片', async t => {
  const { form } = setup(t, [care({ careImages: [], card_equip_lock: true, use_card: true, card_id: 3 })])
  assert.equal(row(form)._entered, false)
  assert.equal(row(form)._statusLabel, '照片必填')
  await settle()
})

test('选卡入口：有装备没照片不放行并提示要传照片；都有照片才触发 addCard', async t => {
  const { form, toasts } = setup(t, [care({ careImages: [] })])
  form.onAddCard()
  assert.equal(addCardEvents(form).length, 0)
  assert.deepEqual(toasts, ['请先为每件装备上传照片，并完整填写装备信息'])
  form.data.cares = [care()]
  form._refreshCares()
  form.onAddCard()
  assert.equal(addCardEvents(form).length, 1)
  await settle()
})

test('选卡入口：照片还在上传中同样不放行', async t => {
  const { form, toasts } = setup(t, [care({ careImages: [photo({ image_id: 0, status: 'uploading' })] })])
  form.onAddCard()
  assert.equal(addCardEvents(form).length, 0)
  assert.equal(toasts.length, 1)
  await settle()
})

test('开单页的装备照片栏标成必填', async () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const wxml = fs.readFileSync(path.join(__dirname, '..', 'components/reception/care_recept_form/care_recept_form.wxml'), 'utf8')
  assert.match(wxml, /装备照片[\s\S]{0,60}必填|必填[\s\S]{0,60}装备照片/)
})

// 会员养护装备列表单元测试：
//   1. member_equipment_diff 纯函数（序列号左右拆合、已选装备变更检测与提示文案）
//   2. care_recept_form 开单联动（选板从装备列表加载、当次照片仍必填、未改不弹窗、改了在去结算弹窗确认/取消、换会员解绑、改为新装备）
//   3. member_equips 管理页（分类统计、新增/编辑/删除、查看修改历史）与 member_detail 入口跳转
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadComponent, loadPage, settle, tap } = require('./reception_harness')
const equipDiff = require('../utils/member_equipment_diff')

const FORM = 'components/reception/care_recept_form/care_recept_form.js'
const EQUIPS_PAGE = 'pages/careadmin/member_equips/member_equips.js'

const photo = (patch) => Object.assign({
  id: 0, care_id: 0, image_id: 99, status: 'success',
  url: 'https://img.test/cur.jpg', thumb: 'https://img.test/cur_t.jpg'
}, patch || {})

function setupForm(t, opts) {
  opts = opts || {}
  const oldApp = global.getApp, oldWx = global.wx
  const toasts = []
  const modals = []
  let modalConfirm = opts.modalConfirm !== undefined ? opts.modalConfirm : true

  global.getApp = () => ({ globalData: { sessionKey: 'staff-sk' }, loginPromiseNew: Promise.resolve() })
  global.wx = {
    showToast: (o) => toasts.push(o.title),
    showModal: (o) => {
      modals.push(o)
      if (typeof o.success === 'function') o.success({ confirm: modalConfirm })
    },
    previewImage: () => {}
  }
  t.after(() => { global.getApp = oldApp; global.wx = oldWx })

  const memberEquips = opts.memberEquips || [
    {
      id: 42,
      member_id: 301,
      equipment: '双板',
      brand: 'Atomic/阿托米克',
      scale: '165',
      serials: 'L100|R200',
      photoUrl: 'https://img.test/first_t.jpg',
      photoFullUrl: 'https://img.test/first.jpg',
      last_care_date: '2026-11-20T10:00:00'
    }
  ]

  const form = loadComponent(FORM, {
    IMAGE_HOST: 'https://img.test',
    getMemberTicketsPromise: async () => [],
    getMemberCardsPromise: async () => [],
    getMemberAssetsByStaffPromise: async () => ({ depositTotal: 0 }),
    getMemberEquipmentsByStaffPromise: async (mid, eq) =>
      eq ? memberEquips.filter((x) => x.equipment === eq) : memberEquips,
    getMemberCaredEquipmentsPromise: async () => [],
    calcCareChargePromise: async (req) => ({ care: Object.assign({}, req.care) })
  })

  Object.assign(form.data, {
    memberId: opts.memberId !== undefined ? opts.memberId : 301,
    shop: '崇礼旗舰店',
    newCardMode: '',
    skiBrandList: [{ brand_name: 'Atomic', displayedName: 'Atomic/阿托米克' }, { brand_name: 'Head', displayedName: 'Head/海德' }],
    boardBrandList: [{ brand_name: 'Burton', displayedName: 'Burton/伯顿' }],
    cares: opts.cares || []
  })
  form._refreshCares()
  return {
    form,
    toasts,
    modals,
    setModalConfirm: (v) => { modalConfirm = v }
  }
}

/* ---------- 1. 纯函数 ---------- */

test('序列号拆合：空串与单竖线均视为无序列号，左右双板正常拆合展示', () => {
  assert.equal(equipDiff.normalizeSerials(''), '')
  assert.equal(equipDiff.normalizeSerials(' | '), '')
  assert.equal(equipDiff.composeSerials(true, '', '  ', ''), null)
  assert.equal(equipDiff.composeSerials(true, '', 'L1', 'R2'), 'L1|R2')
  assert.deepEqual(equipDiff.splitSerials('L1|R2'), {
    diff: true, serials: 'L1|R2', leftSerial: 'L1', rightSerial: 'R2'
  })
  assert.equal(equipDiff.formatSerialsDisplay('L1|R2'), '左:L1 / 右:R2')
})

test('变更检测：对比已选会员装备快照，准确输出修改项与弹窗文案', () => {
  const origin = equipDiff.snapshotFromEquipment({
    id: 42, equipment: '双板', brand: 'Atomic/阿托米克', scale: '165', serials: 'SN1'
  })
  const unchanged = { member_equipment_id: 42, equipment: '双板', brand: 'Atomic/阿托米克', scale: '165', serials: 'SN1 ', _equipOrigin: origin }
  assert.equal(equipDiff.collectModifiedEquipments([unchanged]).length, 0)

  const changed = { member_equipment_id: 42, equipment: '双板', brand: 'Head/海德', scale: '170', serials: '', _equipOrigin: origin }
  const mods = equipDiff.collectModifiedEquipments([changed])
  assert.equal(mods.length, 1)
  const text = equipDiff.formatConfirmContent(mods)
  assert.match(text, /品牌：Atomic\/阿托米克 → Head\/海德/)
  assert.match(text, /长度：165cm → 170cm/)
  assert.match(text, /序列号：SN1 → 未填/)
})

/* ---------- 2. 养护开单组件联动 ---------- */

test('开单选板：点双板从装备列表加载并选中，带入品牌/长度/序列号但不免除当次必拍照片', async (t) => {
  const { form, modals } = setupForm(t)
  form.onAddCare()
  assert.equal(form.data.displayCares[0].member_equipment_id, -1)

  form.onEquipTap(tap({ cidx: 0, equip: '双板' }))
  await settle()
  assert.equal(form.data.historyModal.show, true)
  assert.equal(form.data.historyModal.list.length, 1)

  form.onHistoryPick(tap({ idx: 0 }))
  await settle()

  const row = form.data.displayCares[0]
  assert.equal(row.member_equipment_id, 42)
  assert.equal(row.brand, 'Atomic/阿托米克')
  assert.equal(row.scale, '165')
  assert.equal(row.serials, 'L100|R200')
  assert.equal(row._diffSerial, true)
  assert.equal(row._leftSerial, 'L100')
  assert.equal(row._rightSerial, 'R200')
  // 当次板况照片尚未拍，仍不可结算
  assert.equal(row.careImages.length, 0)
  assert.equal(row._statusLabel, '照片必填')
  assert.equal(form.data.summary.canCheckout, false)

  // 上传当次照片并选项目后可结算；未改动装备信息时去结算不弹确认框
  form._mutate(0, (c) => { c.careImages = [photo()]; c.need_wax = 1; c.need_unwax = 1 })
  await settle()
  assert.equal(form.data.summary.canCheckout, true)

  await form.onCheckout()
  assert.equal(modals.length, 0)
  const checkouts = form.events.filter((e) => e.name === 'checkout')
  assert.equal(checkouts.length, 1)
  assert.equal(checkouts[0].detail.cares[0].member_equipment_id, 42)
})

test('开单改板：选中已有装备后修改长度或序列号，点去结算先弹窗提示；取消不提交，确认才提交', async (t) => {
  const { form, modals, setModalConfirm } = setupForm(t)
  form.onAddCare()
  form.onEquipTap(tap({ cidx: 0, equip: '双板' }))
  await settle()
  form.onHistoryPick(tap({ idx: 0 }))
  form._mutate(0, (c) => { c.careImages = [photo()]; c.need_edge = 1; c.edge_degree = '89' })
  await settle()

  // 修改长度为 170
  form.onFieldBlur({ currentTarget: { dataset: { cidx: 0, field: 'scale' } }, detail: { value: '170' } })
  await settle()
  assert.equal(form.data.displayCares[0]._equipModified, true)

  // 第一次点返回检查（取消）：不触发 checkout
  setModalConfirm(false)
  await form.onCheckout()
  assert.equal(modals.length, 1)
  assert.match(modals[0].content, /165cm → 170cm/)
  assert.equal(form.events.filter((e) => e.name === 'checkout').length, 0)

  // 第二次点保存并结算（确认）：触发 checkout，保留 member_equipment_id = 42 与新长度 170
  setModalConfirm(true)
  await form.onCheckout()
  assert.equal(modals.length, 2)
  const checkouts = form.events.filter((e) => e.name === 'checkout')
  assert.equal(checkouts.length, 1)
  assert.equal(checkouts[0].detail.cares[0].member_equipment_id, 42)
  assert.equal(checkouts[0].detail.cares[0].scale, '170')
})

test('改为新装备或切换会员：解除已有装备关联，避免误改他人或原装备', async (t) => {
  const { form, modals } = setupForm(t)
  form.onAddCare()
  form.onEquipTap(tap({ cidx: 0, equip: '双板' }))
  await settle()
  form.onHistoryPick(tap({ idx: 0 }))
  form._mutate(0, (c) => { c.careImages = [photo()]; c.need_edge = 1; c.edge_degree = '89'; c.scale = '172' })
  await settle()
  assert.equal(form.data.displayCares[0]._equipModified, true)

  // 点「改为新装备」：member_equipment_id 变为 -1，去结算不再弹修改旧装备确认框
  form.onUnlinkEquipment(tap({ cidx: 0 }))
  assert.equal(form.data.displayCares[0].member_equipment_id, -1)
  assert.equal(form.data.displayCares[0]._equipModified, false)
  await form.onCheckout()
  assert.equal(modals.length, 0)

  // 重新选回已有装备后切换会员，自动解绑为 -1
  form.onHistoryPick(tap({ idx: 0 }))
  assert.equal(form.data.displayCares[0].member_equipment_id, 42)
  form.setProperty('memberId', 999)
  assert.equal(form.data.displayCares[0].member_equipment_id, -1)
})

/* ---------- 3. 会员装备管理页与会员详情入口 ---------- */

test('会员装备管理页：加载分类计数、新增/编辑/删除装备及查看修改历史', async (t) => {
  const oldApp = global.getApp, oldWx = global.wx
  let store = [
    { id: 1, member_id: 301, equipment: '双板', brand: 'Atomic/阿托米克', scale: '165', serials: 'SN-1', image_id: 10, photoUrl: '/upload/a.jpg', create_date: '2026-11-01T10:00:00' },
    { id: 2, member_id: 301, equipment: '单板', brand: 'Burton/伯顿', scale: '156', serials: null, image_id: null, photoUrl: null, last_care_date: '2026-11-25T10:00:00' }
  ]
  global.getApp = () => ({ globalData: { sessionKey: 'staff-sk', requestPrefix: 'https://api.test/' }, loginPromiseNew: Promise.resolve() })
  global.wx = {
    showToast: () => {},
    showLoading: () => {},
    hideLoading: () => {},
    showModal: (o) => o.success && o.success({ confirm: true }),
    previewImage: () => {}
  }
  t.after(() => { global.getApp = oldApp; global.wx = oldWx })

  const page = loadPage(EQUIPS_PAGE, {
    IMAGE_HOST: 'https://img.test',
    getEquipBrandsPromise: async (type) => type === '双板'
      ? [{ brand_name: 'Atomic', displayedName: 'Atomic/阿托米克' }]
      : [{ brand_name: 'Burton', displayedName: 'Burton/伯顿' }],
    getMemberEquipmentsByStaffPromise: async () => store.slice(),
    createMemberEquipmentByStaffPromise: async (p) => {
      const item = { id: 3, member_id: p.memberId, equipment: p.equipment, brand: p.brand, scale: p.scale, serials: p.serials, image_id: p.imageId, create_date: '2026-11-27T12:00:00' }
      store.push(item)
      return item
    },
    updateMemberEquipmentByStaffPromise: async (p) => {
      const idx = store.findIndex((x) => x.id === p.id)
      store[idx] = Object.assign({}, store[idx], { equipment: p.equipment, brand: p.brand, scale: p.scale, serials: p.serials, image_id: p.imageId })
      return store[idx]
    },
    deleteMemberEquipmentByStaffPromise: async (id) => {
      store = store.filter((x) => x.id !== id)
      return { id }
    },
    getMemberEquipmentHistoryByStaffPromise: async () => [
      { kind: 'update', field: 'scale', fieldLabel: '长度', from: '165cm', to: '168cm', staffName: '店员', time: '2026-11-27T11:30:00' }
    ]
  })

  page.onLoad({ memberId: '301', memberName: encodeURIComponent('张三') })
  await settle()
  assert.deepEqual(page.data.counts, { all: 2, ski: 1, board: 1 })
  assert.equal(page.data.memberName, '张三')

  // 筛选单板
  page.onTabTap(tap({ tab: '单板' }))
  assert.equal(page.data.filteredItems.length, 1)
  assert.equal(page.data.filteredItems[0].brand, 'Burton/伯顿')

  // 新增一块单板
  page.onOpenCreate()
  assert.equal(page.data.editor.equipment, '单板')
  page.onEditorBrandChange({ detail: { value: 0 } })
  page.onEditorScaleInput({ detail: { value: '158' } })
  page.onSaveEditor()
  await settle()
  assert.equal(page.data.counts.all, 3)

  // 切回全部，查看第 1 件修改历史并删除第 2 件
  page.onTabTap(tap({ tab: 'all' }))
  page.onOpenHistory(tap({ id: 1 }))
  await settle()
  assert.equal(page.data.history.rows.length, 1)
  assert.equal(page.data.history.rows[0].to, '168cm')

  page.onDeleteTap(tap({ idx: 1 }))
  await settle()
  assert.equal(page.data.counts.all, 2)
})

test('会员详情页包含名下装备入口并注册在 careadmin 分包（不占主包页面配额）', () => {
  const detailWxml = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/member/member_detail.wxml'), 'utf8')
  assert.match(detailWxml, /名下装备/)
  assert.match(detailWxml, /gotoMemberEquips/)

  const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'))
  assert.ok(!appJson.pages.includes('pages/careadmin/member_equips/member_equips'))
  const careAdmin = (appJson.subPackages || []).find((s) => s.root === 'pages/careadmin')
  assert.ok(careAdmin && careAdmin.pages.includes('member_equips/member_equips'))
})

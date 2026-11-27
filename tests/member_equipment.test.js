// 会员养护装备列表单元测试：
//   1. member_equipment_diff 纯函数（序列号左右拆合、已选装备变更检测与提示文案）
//   2. care_recept_form 开单联动（选板从装备列表加载、改品牌/长度/序列号任一失焦仅弹一次选择框、不提前调改库接口、多件独立选择、草稿落库不丢选择、右上角关闭回滚、换会员解绑）
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

  const memberEquips = (opts.memberEquips || [
    {
      id: 42,
      member_id: 301,
      equipment: '双板',
      brand: 'Atomic/阿托米克',
      scale: '165',
      serials: 'L100|R200',
      image_id: 77,
      photoUrl: 'https://img.test/first_t.jpg',
      photoFullUrl: 'https://img.test/first.jpg',
      last_care_date: '2026-11-20T10:00:00'
    }
  ]).map((x) => Object.assign({}, x))
  const updateCalls = []

  const form = loadComponent(FORM, {
    IMAGE_HOST: 'https://img.test',
    getMemberTicketsPromise: async () => [],
    getMemberCardsPromise: async () => [],
    getMemberAssetsByStaffPromise: async () => ({ depositTotal: 0 }),
    getMemberEquipmentsByStaffPromise: async (mid, eq) =>
      (eq ? memberEquips.filter((x) => x.equipment === eq) : memberEquips).map((x) => Object.assign({}, x)),
    getMemberCaredEquipmentsPromise: async () => [],
    updateMemberEquipmentByStaffPromise: async (payload) => {
      updateCalls.push(payload)
      if (opts.updateReject) throw new Error('network error')
      const idx = memberEquips.findIndex((x) => x.id === payload.id)
      const updated = Object.assign({}, idx >= 0 ? memberEquips[idx] : {}, {
        id: payload.id,
        member_id: payload.memberId,
        equipment: payload.equipment,
        brand: payload.brand,
        scale: payload.scale,
        serials: payload.serials,
        image_id: payload.imageId,
      })
      if (idx >= 0) memberEquips[idx] = updated
      return updated
    },
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
    updateCalls,
    memberEquips,
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

  const singleBrand = equipDiff.formatSingleFieldChange(
    { equipment: '双板', brand: 'Head/海德', scale: '165' },
    origin,
    'brand',
    'Atomic/阿托米克',
    'Head/海德'
  )
  assert.equal(singleBrand.equipSummary, '双板 · Atomic · 165cm')
  assert.equal(singleBrand.changeLine, '品牌：Atomic/阿托米克 → Head/海德')

  const singleScale = equipDiff.formatSingleFieldChange(
    { equipment: '双板', brand: 'Atomic/阿托米克', scale: '170' },
    origin,
    'scale',
    '165',
    '170'
  )
  assert.equal(singleScale.equipSummary, '双板 · Atomic · 165cm')
  assert.equal(singleScale.changeLine, '长度：165cm → 170cm')

  const singleSerial = equipDiff.formatSingleFieldChange(
    { equipment: '双板', brand: 'Atomic/阿托米克', scale: '165' },
    origin,
    'serials',
    'L1|R2',
    'L9|R2'
  )
  assert.equal(singleSerial.changeLine, '序列号：左:L1 / 右:R2 → 左:L9 / 右:R2')
  assert.equal(equipDiff.formatModifiedBannerText(mods[0].changes), '已修改品牌、长度、序列号，下单时将更新原装备')
  assert.equal(equipDiff.formatModifiedBannerText([{ field: 'scale', label: '长度' }]), '已修改长度，下单时将更新原装备')
  assert.equal(equipDiff.formatModifiedBannerText([]), '')
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

test('改长度失焦立即弹窗→选「更新旧装备」：状态条准确显示改了长度，再改品牌/序列号不再二次弹窗，下单时统一保存', async (t) => {
  const { form, modals, updateCalls } = setupForm(t)
  form.onAddCare()
  form.onEquipTap(tap({ cidx: 0, equip: '双板' }))
  await settle()
  form.onHistoryPick(tap({ idx: 0 }))
  form._mutate(0, (c) => { c.careImages = [photo()]; c.need_edge = 1; c.edge_degree = '89' })
  await settle()

  // 修改长度并失焦 -> 立即弹出选择框
  form.onFieldBlur({ currentTarget: { dataset: { cidx: 0, field: 'scale' } }, detail: { value: '170' } })
  assert.equal(form.data.equipChangeModal.show, true)
  assert.equal(form.data.equipChangeModal.equipSummary, '双板 · Atomic · 165cm')
  assert.equal(form.data.equipChangeModal.changeLine, '长度：165cm → 170cm')

  // 选「更新旧装备」-> 不在失焦时调改库接口；状态条准确提示已修改长度
  form.onEquipChangeUpdateOld()
  await settle()
  assert.equal(form.data.equipChangeModal.show, false)
  assert.equal(updateCalls.length, 0)
  assert.equal(form.data.displayCares[0]._equipModified, true)
  assert.equal(form.data.displayCares[0]._equipModifiedBanner, '已修改长度，下单时将更新原装备')
  assert.equal(form.data.displayCares[0]._equipEditChoice, 'update')

  // 继续修改品牌和序列号 -> 同一装备不再二次、三次弹窗，状态条累加显示真实修改项
  form.onBrandChange({ currentTarget: { dataset: { cidx: 0 } }, detail: { value: 1 } })
  assert.equal(form.data.equipChangeModal.show, false)
  form.onSerialBlur({ currentTarget: { dataset: { cidx: 0, side: 'left' } }, detail: { value: 'L999' } })
  assert.equal(form.data.equipChangeModal.show, false)
  assert.equal(form.data.displayCares[0]._equipModifiedBanner, '已修改品牌、长度、序列号，下单时将更新原装备')

  // 去结算直接提交（不重复弹窗），把 member_equipment_id = 42 及修改后字段交给下单接口更新
  await form.onCheckout()
  assert.equal(modals.length, 0)
  assert.equal(updateCalls.length, 0)
  const checkouts = form.events.filter((e) => e.name === 'checkout')
  assert.equal(checkouts.length, 1)
  assert.equal(checkouts[0].detail.cares[0].member_equipment_id, 42)
  assert.equal(checkouts[0].detail.cares[0].brand, 'Head/海德')
  assert.equal(checkouts[0].detail.cares[0].scale, '170')
  assert.equal(checkouts[0].detail.cares[0].serials, 'L999|R200')
})

test('改序列号失焦立即弹窗→选「另存为新装备」：保留新填序列号，再改长度不重复弹窗', async (t) => {
  const { form, modals, updateCalls } = setupForm(t)
  form.onAddCare()
  form.onEquipTap(tap({ cidx: 0, equip: '双板' }))
  await settle()
  form.onHistoryPick(tap({ idx: 0 }))
  form._mutate(0, (c) => { c.careImages = [photo()]; c.need_edge = 1; c.edge_degree = '89' })
  await settle()

  // 修改序列号并失焦 -> 立即弹窗
  form.onSerialBlur({ currentTarget: { dataset: { cidx: 0, side: 'left' } }, detail: { value: 'L888' } })
  assert.equal(form.data.equipChangeModal.show, true)
  assert.equal(form.data.equipChangeModal.changeLine, '序列号：左:L100 / 右:R200 → 左:L888 / 右:R200')

  // 选「另存为新装备」-> 解绑为 -1，并保留店员刚刚亲手填写的新序列号
  form.onEquipChangeSaveAsNew()
  await settle()
  assert.equal(form.data.equipChangeModal.show, false)
  assert.equal(updateCalls.length, 0)
  assert.equal(form.data.displayCares[0].member_equipment_id, -1)
  assert.equal(form.data.displayCares[0].serials, 'L888|R200')
  assert.equal(form.data.displayCares[0]._equipEditChoice, 'new')

  // 继续修改长度与品牌 -> 不重复弹窗
  form.onFieldBlur({ currentTarget: { dataset: { cidx: 0, field: 'scale' } }, detail: { value: '175' } })
  assert.equal(form.data.equipChangeModal.show, false)
  form.onBrandChange({ currentTarget: { dataset: { cidx: 0 } }, detail: { value: 1 } })
  assert.equal(form.data.equipChangeModal.show, false)
  await settle()

  await form.onCheckout()
  assert.equal(modals.length, 0)
  const checkouts = form.events.filter((e) => e.name === 'checkout')
  assert.equal(checkouts.length, 1)
  assert.equal(checkouts[0].detail.cares[0].member_equipment_id, -1)
  assert.equal(checkouts[0].detail.cares[0].brand, 'Head/海德')
  assert.equal(checkouts[0].detail.cares[0].scale, '175')
  assert.equal(checkouts[0].detail.cares[0].serials, 'L888|R200')
})

test('多件装备各自独立选择 + 草稿落库id变更不丢失选择，下单分别按各自选择提交', async (t) => {
  const { form, modals } = setupForm(t, {
    memberEquips: [
      { id: 42, member_id: 301, equipment: '双板', brand: 'Atomic/阿托米克', scale: '165', serials: 'L100|R200', image_id: 77 },
      { id: 43, member_id: 301, equipment: '单板', brand: 'Burton/伯顿', scale: '156', serials: 'SN-43', image_id: 78 },
    ]
  })
  form.onAddCare()
  form.onEquipTap(tap({ cidx: 0, equip: '双板' }))
  await settle()
  form.onHistoryPick(tap({ idx: 0 }))
  form._mutate(0, (c) => { c.careImages = [photo()]; c.need_edge = 1; c.edge_degree = '89' })

  form.onAddCare()
  form.onEquipTap(tap({ cidx: 1, equip: '单板' }))
  await settle()
  form.onHistoryPick(tap({ idx: 0 }))
  form._mutate(1, (c) => { c.careImages = [photo()]; c.need_wax = 1; c.need_unwax = 1 })
  await settle()

  // 第 1 件改长度选「更新旧装备」
  form.onFieldBlur({ currentTarget: { dataset: { cidx: 0, field: 'scale' } }, detail: { value: '170' } })
  assert.equal(form.data.equipChangeModal.show, true)
  form.onEquipChangeUpdateOld()

  // 模拟 SaveCareRecept 回填数据库真实 care.id 后（t... -> c501/c502），已选结果保持不丢失
  const savedCares = form.data.cares.map((c, i) => Object.assign({}, c, { id: 501 + i }))
  form.setProperty('cares', savedCares)
  await settle()

  // 第 1 件继续改品牌：不再二次弹窗
  form.onBrandChange({ currentTarget: { dataset: { cidx: 0 } }, detail: { value: 1 } })
  assert.equal(form.data.equipChangeModal.show, false)

  // 第 2 件改长度选「另存为新装备」：自动清空旧单板原序列号，互不影响第 1 件
  form.onFieldBlur({ currentTarget: { dataset: { cidx: 1, field: 'scale' } }, detail: { value: '158' } })
  assert.equal(form.data.equipChangeModal.show, true)
  assert.equal(form.data.equipChangeModal.equipSummary, '单板 · Burton · 156cm')
  form.onEquipChangeSaveAsNew()
  assert.equal(form.data.displayCares[1].member_equipment_id, -1)
  assert.equal(form.data.displayCares[1].serials, null)

  // 第 2 件继续输入新序列号：不再弹窗
  form.onSerialBlur({ currentTarget: { dataset: { cidx: 1, side: 'single' } }, detail: { value: 'NEW-43' } })
  assert.equal(form.data.equipChangeModal.show, false)

  await form.onCheckout()
  assert.equal(modals.length, 0)
  const checkouts = form.events.filter((e) => e.name === 'checkout')
  assert.equal(checkouts.length, 1)
  assert.equal(checkouts[0].detail.cares[0].member_equipment_id, 42)
  assert.equal(checkouts[0].detail.cares[0].brand, 'Head/海德')
  assert.equal(checkouts[0].detail.cares[0].scale, '170')
  assert.equal(checkouts[0].detail.cares[1].member_equipment_id, -1)
  assert.equal(checkouts[0].detail.cares[1].scale, '158')
  assert.equal(checkouts[0].detail.cares[1].serials, 'NEW-43')
})

test('未实际改值不弹窗；点关闭回滚原值与分左右状态并保留后续弹窗；弹窗开启时去结算暂停提交', async (t) => {
  const { form, modals } = setupForm(t)
  form.onAddCare()
  form.onEquipTap(tap({ cidx: 0, equip: '双板' }))
  await settle()
  form.onHistoryPick(tap({ idx: 0 }))
  form._mutate(0, (c) => { c.careImages = [photo()]; c.need_edge = 1; c.edge_degree = '89' })
  await settle()

  // 传原值均不弹窗
  form.onFieldBlur({ currentTarget: { dataset: { cidx: 0, field: 'scale' } }, detail: { value: ' 165 ' } })
  assert.equal(form.data.equipChangeModal.show, false)
  form.onBrandChange({ currentTarget: { dataset: { cidx: 0 } }, detail: { value: 0 } })
  assert.equal(form.data.equipChangeModal.show, false)
  form.onSerialBlur({ currentTarget: { dataset: { cidx: 0, side: 'left' } }, detail: { value: 'L100' } })
  assert.equal(form.data.equipChangeModal.show, false)

  // 修改序列号弹出选择框；弹窗未关时点去结算先暂停不提交
  form.onSerialBlur({ currentTarget: { dataset: { cidx: 0, side: 'left' } }, detail: { value: 'L777' } })
  assert.equal(form.data.equipChangeModal.show, true)
  await form.onCheckout()
  assert.equal(form.events.filter((e) => e.name === 'checkout').length, 0)

  // 点关闭取消 -> 回滚原序列号与分左右状态，且后续再改长度仍可弹窗
  form.onEquipChangeCancel()
  await settle()
  assert.equal(form.data.equipChangeModal.show, false)
  assert.equal(form.data.displayCares[0].serials, 'L100|R200')
  assert.equal(form.data.displayCares[0]._diffSerial, true)
  assert.equal(form.data.displayCares[0].member_equipment_id, 42)

  form.onFieldBlur({ currentTarget: { dataset: { cidx: 0, field: 'scale' } }, detail: { value: '172' } })
  assert.equal(form.data.equipChangeModal.show, true)
  assert.equal(modals.length, 0)
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

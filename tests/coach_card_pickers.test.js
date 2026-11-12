// 学员卡进入现有开单流程：选卡弹层（养护 / 租赁只列学员卡）、养护开单表单、租赁开单表单、券转发
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadComponent, loadPage, settle } = require('./reception_harness')

const tap = dataset => ({ currentTarget: { dataset } })

function globals(t, extra) {
  const previous = { wx: global.wx, getApp: global.getApp }
  const toasts = []
  global.getApp = () => ({ globalData: Object.assign({ sessionKey: 'sk' }, (extra && extra.globalData) || {}), loginPromiseNew: Promise.resolve() })
  global.wx = { nextTick: f => f(), showToast(o) { toasts.push(o.title) }, showModal() {}, showLoading() {}, hideLoading() {} }
  t.after(() => {
    if (previous.wx === undefined) delete global.wx; else global.wx = previous.wx
    if (previous.getApp === undefined) delete global.getApp; else global.getApp = previous.getApp
  })
  return toasts
}

// ---------- 选卡弹层 ----------
const COACH_CARDS = [
  { cardId: 7, coachId: 1, coachName: '张教练', applicable: true, estimatedDiscount: 33.6, benefitText: '万龙服务中心 · 双项 8 折', validUntil: '2027-04-30T23:59:59' },
  { cardId: 8, coachId: 2, coachName: '李教练', applicable: false, estimatedDiscount: 0, benefitText: '本单万龙服务中心双项无优惠', validUntil: '2027-04-30T23:59:59' }
]
function selector(t, props, opts) {
  const toasts = globals(t)
  const calls = { tickets: [], cards: [], coach: [] }
  const fake = {
    getMemberTicketsPromise: (...a) => { calls.tickets.push(a); return Promise.resolve([{ code: 'T1', name: '老顾客券', expire_date: '2027-01-01' }]) },
    getMemberCardsPromise: (...a) => { calls.cards.push(a); return Promise.resolve([{ id: 5, card_name: '机打蜡季卡', biz_type: '养护', total: null }]) },
    listUsableCoachCardsPromise: (...a) => { calls.coach.push(a); return (opts && opts.coachFails) ? Promise.reject('x') : Promise.resolve({ cards: COACH_CARDS }) }
  }
  const sel = loadComponent('components/reception/ticket_card_selector/ticket_card_selector.js', fake)
  Object.assign(sel.data, { memberId: 10, ticketType: '养护', shop: '万龙服务中心', tier: '双项', commonCharge: 168, urgent: 1, disabledCodes: [] }, props)
  return { sel, calls, toasts }
}
const lastEvent = sel => sel.events.at(-1).detail

test('选卡弹层：学员卡随本单上下文请求，并显示在「会员卡」标签里', async t => {
  const { sel, calls } = selector(t)
  sel._load(); await settle()
  assert.deepEqual(calls.coach, [[10, '养护', { shop: '万龙服务中心', tier: '双项', commonCharge: 168, basePrice: undefined, rentalAmount: undefined, urgent: 1 }, 'sk']])
  assert.equal(calls.tickets.length, 1); assert.equal(calls.cards.length, 1)
  assert.deepEqual(sel.data.coachCards.map(c => [c.cardId, c.applicable, c._until]), [[7, true, '2027-04-30'], [8, false, '2027-04-30']])
})

test('选卡弹层：没有优惠的卡不能选；选学员卡与券、卡、不使用互斥；确认事件带 selectedCoachCard', async t => {
  const { sel, toasts } = selector(t)
  sel._load(); await settle()
  sel.onCoachCardTap(tap({ idx: 1 }))
  assert.match(toasts.at(-1), /没有优惠/); assert.equal(sel.data.pickedCoachCardId, null)
  sel.onCoachCardTap(tap({ idx: 0 }))
  assert.equal(sel.data.pickedCoachCardId, 7); assert.equal(sel.data.pickedCode, null); assert.equal(sel.data.pickedCardId, null)
  sel.onConfirm()
  assert.equal(lastEvent(sel).action, 'confirm'); assert.equal(lastEvent(sel).selectedTicket, null); assert.equal(lastEvent(sel).selectedCard, null)
  assert.equal(lastEvent(sel).selectedCoachCard.cardId, 7)
  // 再选券 → 学员卡被挤掉
  sel.onTicketTap(tap({ idx: 0 })); assert.equal(sel.data.pickedCoachCardId, null); assert.equal(sel.data.pickedCode, 'T1')
  sel.onConfirm(); assert.equal(lastEvent(sel).selectedTicket.code, 'T1'); assert.equal(lastEvent(sel).selectedCoachCard, undefined)
  // 再选学员卡 → 券被挤掉；再选季卡 → 学员卡被挤掉；不使用 → 全清
  sel.onCoachCardTap(tap({ idx: 0 })); assert.equal(sel.data.pickedCode, null)
  sel.onCardTap(tap({ idx: 0 })); assert.equal(sel.data.pickedCoachCardId, null); assert.equal(sel.data.pickedCardId, 5)
  sel.onCoachCardTap(tap({ idx: 0 })); sel.onNoneTap()
  assert.deepEqual([sel.data.pickedCoachCardId, sel.data.pickedCode, sel.data.pickedCardId, sel.data.pickedNone], [null, null, null, true])
  sel.onConfirm(); assert.deepEqual([lastEvent(sel).selectedTicket, lastEvent(sel).selectedCard, lastEvent(sel).selectedCoachCard], [null, null, undefined])
})

test('选卡弹层：已选的学员卡回显在「会员卡」标签，学员卡接口失败不影响券和次卡', async t => {
  const { sel } = selector(t, { selectedCoachCardId: 7 })
  sel._load(); await settle()
  assert.equal(sel.data.activeTab, 'card'); assert.equal(sel.data.pickedCoachCardId, 7); assert.equal(sel.data.pickedCode, null)
  const failing = selector(t, {}, { coachFails: true })
  failing.sel._load(); await settle()
  assert.equal(failing.sel.data.coachCards.length, 0); assert.equal(failing.sel.data.tickets.length, 1); assert.equal(failing.sel.data.cards.length, 1)
  assert.equal(failing.sel.data.coachLoading, false)
})

test('选卡弹层：租赁（coachOnly）只请求学员卡，传租赁金额', async t => {
  const { sel, calls } = selector(t, { ticketType: '租赁', coachOnly: true, shop: '', tier: '', commonCharge: 0, urgent: 0, rentalAmount: 180 })
  sel._load(); await settle()
  assert.equal(calls.tickets.length, 0); assert.equal(calls.cards.length, 0)
  assert.equal(calls.coach[0][1], '租赁'); assert.equal(calls.coach[0][2].rentalAmount, 180)
  assert.equal(sel.data.activeTab, 'card')
  sel.onCoachCardTap(tap({ idx: 0 })); sel.onConfirm(); assert.equal(lastEvent(sel).selectedCoachCard.cardId, 7)
})

// ---------- 养护开单表单 ----------
function ticket(code, memberId = 10) { return { code, template_id: 16, name: '老顾客优惠券', member_id: memberId, expire_date: '2027-01-01' } }
function care(id, patch) {
  return Object.assign({ id, equipment: '双板', brand: '测试', scale: '170', need_edge: 1, need_wax: 1, need_unwax: 1, edge_degree: '89', discount: 0 }, patch)
}
function careForm(t, { cares, tickets, calculate }) {
  globals(t)
  const prices = []
  const form = loadComponent('components/reception/care_recept_form/care_recept_form.js', {
    getMemberTicketsPromise: async () => tickets || [],
    calcCareChargePromise: async req => { prices.push(req); return calculate(req) }
  })
  Object.assign(form.data, { memberId: 10, shop: '万龙服务中心', cares: cares || [care(1)] })
  return { form, prices }
}
// 服务端：双项 168，学员卡 8 折优惠 33.6，减免取保底
const coachServer = req => {
  const coach = req.care.coach_card_id ? { cardId: req.care.coach_card_id, coachName: '张教练', discount: 33.6 } : null
  return { care: Object.assign({}, req.care, { common_charge: 168, discount: Math.max(req.care.discount || 0, coach ? 33.6 : 0) }), coach }
}

test('养护开单：选学员卡只写 coach_card_id，不清已选服务项；计价按服务端回填并显示优惠提示', async t => {
  const { form, prices } = careForm(t, { calculate: coachServer })
  form._refreshCares(); await settle(); prices.length = 0
  await form._applyCoachCardSelection(0, { cardId: 7, coachName: '张教练' }); await settle()
  const c = form.data.displayCares[0]
  assert.deepEqual([c.coach_card_id, c.ticket_code, c.use_card, c.card_id], [7, null, false, null])
  assert.deepEqual([c.need_edge, c.need_wax, c.need_unwax, c.edge_degree], [1, 1, 1, '89'])   // 服务项原样保留
  assert.equal(prices.length, 1); assert.equal(prices[0].deriveServices, false)
  assert.equal(prices[0].care.coach_card_id, 7); assert.equal(prices[0].care.discount, 0)
  assert.equal(c.discount, 33.6); assert.equal(c.common_charge, 168)
  assert.equal(c._coachCardName, '张教练'); assert.equal(c._coachHint, '学员卡优惠 −¥33.6')
  const synced = form.events.at(-1).detail.cares[0]
  assert.equal(synced.coach_card_id, 7)
  assert.ok(Object.keys(synced).every(k => k.charAt(0) !== '_'))                              // UI 字段不进保存
})

test('养护开单：学员卡与券、会员卡、不使用互斥，换选后学员卡被清掉', async t => {
  const { form } = careForm(t, { calculate: coachServer })
  form._refreshCares(); await settle()
  await form._applyCoachCardSelection(0, { cardId: 7, coachName: '张教练' }); await settle()
  await form._applyTicketSelection(0, { code: 'T9', template_id: 12 }, null); await settle()
  let c = form.data.displayCares[0]
  assert.deepEqual([c.ticket_code, c.coach_card_id, c._coachHint], ['T9', null, ''])
  await form._applyCoachCardSelection(0, { cardId: 7, coachName: '张教练' }); await settle()
  c = form.data.displayCares[0]
  assert.deepEqual([c.ticket_code, c.coach_card_id], [null, 7])
  await form._applyTicketSelection(0, null, null); await settle()
  assert.equal(form.data.displayCares[0].coach_card_id, null)
  await form._applyCoachCardSelection(0, { cardId: 7, coachName: '张教练' }); await settle()
  await form._applyTicketSelection(0, null, { id: 5, card_name: '机打蜡季卡', total: null }); await settle()
  c = form.data.displayCares[0]
  assert.deepEqual([c.use_card, c.card_id, c.coach_card_id], [true, 5, null])
})

test('养护开单：选了学员卡后，老顾客券不会被自动顶回来', async t => {
  const { form } = careForm(t, { cares: [care(1, { coach_card_id: 7 })], tickets: [ticket('OLD')], calculate: coachServer })
  form._refreshCares(); await settle()
  assert.ok(!form.data.displayCares[0].ticket_code)          // 没有被自动带上老顾客券
  assert.equal(form.data.displayCares[0].coach_card_id, 7)
  // 对照：没选学员卡时仍自动带券
  const plain = careForm(t, { cares: [care(1)], tickets: [ticket('OLD')], calculate: coachServer })
  plain.form._refreshCares(); await settle()
  assert.equal(plain.form.data.displayCares[0].ticket_code, 'OLD')
})

test('养护开单：改服务项重算时减免重置为手动录入部分，手动减免保留，改减免本身不重置', async t => {
  const { form, prices } = careForm(t, { calculate: coachServer })
  form._refreshCares(); await settle()
  await form._applyCoachCardSelection(0, { cardId: 7, coachName: '张教练' }); await settle()
  assert.equal(form.data.displayCares[0].discount, 33.6)
  // 店员手动再减 50
  form.data.amountModal = { show: true, cidx: 0, field: 'discount', value: '50' }
  form.onAmountModalConfirm(); await settle()
  assert.equal(form.data.displayCares[0]._manualDiscount, 50)
  // 之后改服务项（双项→单项）：请求里的减免 = 手动的 50，不是上一轮带回来的卡优惠
  form._mutate(0, c => { c.need_wax = 0 })
  await form._fetchPrice(0, { changed: 'need_wax' }); await settle()
  assert.equal(prices.at(-1).care.discount, 50)
  assert.equal(prices.at(-1).care.coach_card_id, 7)
})

test('养护开单：点「优惠券/卡」把本单上下文（单/双项、服务费、加急、已选学员卡）交给弹层', async t => {
  const { form } = careForm(t, { cares: [care(1, { coach_card_id: 7, urgent: 1, common_charge: 228 })], calculate: coachServer })
  form._refreshCares(); await settle()
  form.onTicketTap(tap({ cidx: 0 }))
  const p = form.data.ticketPopup
  assert.deepEqual([p.show, p.selectedCoachCardId, p.tier, p.urgent], [true, 7, '双项', 1])
  assert.equal(p.commonCharge, 228)
  form.data.cares[0].need_wax = 0; form._refreshCares(); await settle()
  form.onTicketTap(tap({ cidx: 0 })); assert.equal(form.data.ticketPopup.tier, '单项')
  // 弹层返回学员卡 → 应用
  await form.onTicketSelectorEvent({ detail: { action: 'confirm', selectedTicket: null, selectedCard: null, selectedCoachCard: { cardId: 9, coachName: '李教练' } } }); await settle()
  assert.equal(form.data.displayCares[0].coach_card_id, 9)
})

// ---------- 租赁开单表单 ----------
test('租赁开单：新增「优惠券/卡」一行，选学员卡写 rental.coach_card_id 并同步保存，散客不能选，换会员清掉', async t => {
  const toasts = globals(t)
  const form = loadComponent('components/reception/rent_recept_form/rent_recept_form.js', {})
  Object.assign(form.data, { displayRentals: [{ _key: 'a', _dailyRate: 180, name: '雪板套餐', coach_card_id: null }] })
  form.properties.memberId = 0
  form.onPkgCoachCardTap(tap({ ridx: 0 })); assert.match(toasts.at(-1), /散客无可用学员卡/); assert.equal(form.data.coachPopup.show, false)
  form.properties.memberId = 10
  form.onPkgCoachCardTap(tap({ ridx: 0 }))
  assert.deepEqual([form.data.coachPopup.show, form.data.coachPopup.ridx, form.data.coachPopup.rentalAmount], [true, 0, 180])
  form.onCoachSelectorEvent({ detail: { action: 'cancel' } }); assert.equal(form.data.coachPopup.show, false)
  form.onCoachSelectorEvent({ detail: { action: 'confirm', selectedCoachCard: { cardId: 7, coachName: '张教练', estimatedDiscount: 18, benefitText: '租赁 9 折' } } })
  const r = form.data.displayRentals[0]
  assert.deepEqual([r.coach_card_id, r._coachCardName], [7, '张教练']); assert.match(r._coachHint, /预计优惠 ¥18/)
  const sync = form.events.at(-1)
  assert.equal(sync.name, 'syncRent'); assert.equal(sync.detail.needUpdate, true)
  assert.equal(sync.detail.rentals[0].coach_card_id, 7); assert.ok(!('_coachHint' in sync.detail.rentals[0]))
  // 改选「不使用」
  form.onCoachSelectorEvent({ detail: { action: 'confirm', selectedCoachCard: null } })
  assert.equal(form.data.displayRentals[0].coach_card_id, null)
  // 换会员：已选的学员卡不属于新会员，清掉
  form.onCoachSelectorEvent({ detail: { action: 'confirm', selectedCoachCard: { cardId: 7, coachName: '张教练', estimatedDiscount: 0, benefitText: '租赁 9 折' } } })
  form._clearCoachCards()
  assert.equal(form.data.displayRentals[0].coach_card_id, null)
  assert.equal(form.events.at(-1).detail.rentals[0].coach_card_id, null)
})

// ---------- 教练券转发 ----------
test('券列表：教练券（coachGranted）可转发，普通券仍只认模板 12、16', () => {
  const { annotateTicket } = require('../pages/mine/ticket/ticket_helper.js')
  const mk = (over) => annotateTicket(Object.assign({ code: 'A', name: '券', template_id: 99, used: 0, memo: '' }, over), 'unused')
  assert.equal(mk({}).canTransfer, false)
  assert.equal(mk({ coachGranted: true }).canTransfer, true)
  assert.equal(mk({ template_id: 12 }).canTransfer, true)
  assert.equal(mk({ coachGranted: true, used: 1 }).canTransfer, false)
})

for (const file of ['pages/mine/ticket/ticket_list.js', 'pages/mine/ticket/ticket_detail.js']) {
  test(`${file}: 教练转发不回赠，不显示回赠提醒；普通顾客仍显示`, t => {
    for (const coach of [null, { id: 1 }]) {
      globals(t, { globalData: { coach, sessionKey: 'sk', domainName: 'x' } })
      global.wx.requestSubscribeMessage = o => o.success({ [o.tmplIds[0]]: 'accept' })
      const page = loadPage(file, {})
      const ticket = { code: 'T1', template_id: 16, canTransfer: true }
      page.setData({ ticketArr: [ticket], ticket })
      page.onTransferTap({ currentTarget: { dataset: { code: 'T1' } } })
      assert.equal(page.data.transferShow, true)
      assert.equal(page.data.transferRewardEligible, !coach)
    }
  })
}

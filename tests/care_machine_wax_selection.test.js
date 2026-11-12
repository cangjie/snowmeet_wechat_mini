const test = require('node:test');
const assert = require('node:assert/strict');
const { loadComponent, settle, tap } = require('./reception_harness');

function care(id = 1, patch = {}) {
  return { id, equipment: '双板', brand: '测试', scale: '170', need_edge: 1, edge_degree: '89',
    need_wax: 0, need_unwax: 0, free_wax: 0, use_card: false, card_id: null,
    ticket_code: null, common_charge: 170, repair_charge: 0, discount: 0, ...patch };
}
function season(id, patch = {}) {
  return { id, card_name: '机打蜡季卡', total: null, isSeason: true, usedToday: false,
    equipBound: true, equip_type: '双板', equip_brand: '测试', equip_scale: '170', ...patch };
}
function ticket(code, expiry = '2027-01-01', patch = {}) {
  return { code, template_id: 12, member_id: 10, expire_date: expiry, ...patch };
}
function setup(t, { cards = [], tickets = [ticket('WAX')], rows = [care()], getCards, calculate } = {}) {
  const oldApp = global.getApp, oldWx = global.wx;
  global.getApp = () => ({ globalData: { sessionKey: 'staff' }, loginPromiseNew: Promise.resolve() });
  const toasts = [], prices = [], cardRequests = [];
  global.wx = { showToast: options => toasts.push(options.title) };
  t.after(() => { global.getApp = oldApp; global.wx = oldWx; });
  const form = loadComponent('components/reception/care_recept_form/care_recept_form.js', {
    getMemberTicketsPromise: async () => tickets,
    getMemberCardsPromise: (...args) => { cardRequests.push(args); return getCards ? getCards(...args) : Promise.resolve(cards); },
    getMemberAssetsByStaffPromise: async () => ({ depositTotal: 0 }),
    calcCareChargePromise: async req => {
      prices.push(req);
      if (calculate) return calculate(req);
      const result = { ...req.care };
      if (req.changedField === 'free_wax' && result.free_wax === 1) result.need_wax = result.need_unwax = 0;
      return { care: result };
    },
  });
  Object.assign(form.data, { memberId: null, shop: '测试店', newCardMode: '', cares: rows });
  form._refreshCares(); form.setProperty('memberId', 10);
  return { form, prices, cardRequests, toasts };
}
function toggle(form, index = 0) { return form.onSvcToggle(tap({ cidx: index, flag: 'free_wax' })); }

test('测试打蜡季卡与正式机打蜡季卡一致，显示按钮并自动选中账户的未绑定季卡', async t => {
  const { form } = setup(t, { tickets: [], cards: [season(8, { card_name: '测试打蜡季卡',
    equipBound: false, equip_type: null, equip_brand: null, equip_scale: null })] });
  await settle();
  assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, true);
  toggle(form); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].card_id, 8);
  assert.equal(form.data.displayCares[0].free_wax, 1);
  assert.equal(form._hasMachineWaxBenefit(form.data.displayCares[0]), true);
});

test('点击机打蜡自动换成最早到期的机打蜡券，保留修刃和维修且重新向服务端计价', async t => {
  const { form, prices } = setup(t, { tickets: [ticket('LATE'), ticket('EARLY', '2026-11-01'),
    ticket('OLD', '2026-10-30', { template_id: 16 })], rows: [care(1, { need_wax: 1, need_unwax: 1, repair_charge: 9 })] });
  await settle(); assert.equal(form.data.displayCares[0].ticket_code, 'OLD');
  toggle(form); await form.waitForPrices();
  const selected = form.data.displayCares[0];
  assert.equal(selected.ticket_code, 'EARLY'); assert.equal(selected.use_card, false);
  assert.equal(selected.free_wax, 1); assert.equal(selected.need_edge, 1);
  assert.equal(selected.need_wax, 0); assert.equal(selected.need_unwax, 0); assert.equal(selected.repair_charge, 9);
  assert.equal(prices.at(-1).deriveServices, false); assert.equal(prices.at(-1).changedField, 'free_wax');
  assert.equal(prices.at(-1).care.ticket_code, 'EARLY');
});

test('同时有季卡和券时优先匹配装备的季卡，保留当前装备并带入绑定锁', async t => {
  const { form, cardRequests } = setup(t, { cards: [season(1, { equip_scale: '180' }),
    season(2), season(3, { equipBound: false, equip_type: null, equip_brand: null, equip_scale: null })] });
  await settle(); toggle(form); await form.waitForPrices();
  const selected = form.data.displayCares[0];
  assert.deepEqual(cardRequests, [[10, '养护', 'staff'], [10, '养护', 'staff']]);
  assert.equal(selected.use_card, true); assert.equal(selected.card_id, 2); assert.equal(selected.ticket_code, null);
  assert.equal(selected.card_equip_lock, true); assert.equal(selected.scale, '170');
  assert.equal(selected.free_wax, 1); assert.equal(selected.need_edge, 1);
});

test('自动选未开卡季卡时保留装备资料，并显示首次开卡提示', async t => {
  const { form } = setup(t, { cards: [season(8, { equipBound: false,
    equip_type: null, equip_brand: null, equip_scale: null })] });
  await settle(); toggle(form); await form.waitForPrices();
  const selected = form.data.displayCares[0];
  assert.equal(selected.card_id, 8); assert.equal(selected.card_pending_open, true);
  assert.equal(selected.card_equip_lock, false); assert.equal(selected.brand, '测试'); assert.equal(selected.scale, '170');
  assert.match(selected._cardOpenHint, /尚未开卡/);
});

test('跳过今日已用、不匹配或本单已占用的季卡和券，不重复消耗权益', async t => {
  const { form } = setup(t, { cards: [season(1, { usedToday: true }), season(2, { equip_scale: '180' }), season(3)],
    tickets: [ticket('TAKEN', '2026-10-30'), ticket('AVAILABLE', '2026-11-01')], rows: [care(1),
      care(2, { free_wax: 1, use_card: true, card_id: 3, card_name: '机打蜡季卡' }),
      care(3, { free_wax: 1, ticket_code: 'TAKEN', ticket: ticket('TAKEN') })] });
  await settle(); toggle(form); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].ticket_code, 'AVAILABLE');
  assert.equal(form.data.displayCares[0].use_card, false);
  assert.equal(form.data.displayCares[1].card_id, 3); assert.equal(form.data.displayCares[2].ticket_code, 'TAKEN');
});

test('多件装备同时选机打蜡时每件使用不同的券', async t => {
  const { form } = setup(t, { tickets: [ticket('ONE', '2026-11-01'), ticket('TWO')], rows: [care(1), care(2)] });
  await settle(); toggle(form, 0); toggle(form, 1); await form.waitForPrices();
  assert.deepEqual(form.data.displayCares.map(c => c.ticket_code).sort(), ['ONE', 'TWO']);
});

test('等待权益选择时取消机打蜡，迟到结果不能恢复项目或套用季卡', async t => {
  let ready;
  const { form } = setup(t, { getCards: () => new Promise(resolve => { ready = resolve; }) });
  await settle(); toggle(form); await settle(); toggle(form);
  if (ready) ready([season(1)]);
  await form.waitForPrices();
  const selected = form.data.displayCares[0];
  assert.equal(selected.free_wax, 0); assert.equal(selected.use_card, false); assert.equal(selected.ticket_code, null);
});

test('点击后立即结算会等待季卡选择和新价格完成，重复结算仅提交一次', async t => {
  let ready;
  const { form } = setup(t, { getCards: () => new Promise(resolve => { ready = resolve; }) });
  await settle(); toggle(form);
  const checkout = form.onCheckout(); await form.onCheckout(); await settle();
  assert.equal(form.events.filter(e => e.name === 'checkout').length, 0);
  if (ready) ready([season(1)]);
  await checkout;
  const submitted = form.events.filter(e => e.name === 'checkout');
  assert.equal(submitted.length, 1); assert.equal(submitted[0].detail.cares[0].card_id, 1);
  assert.equal(submitted[0].detail.cares[0].free_wax, 1);
});

test('没有可用权益时不得按无券机打蜡直接结算', async t => {
  const { form } = setup(t, { cards: [season(1, { usedToday: true })], tickets: [] });
  await settle(); toggle(form);
  await assert.rejects(form.waitForPrices(), /权益|计价/);
  await form.onCheckout();
  assert.equal(form.events.filter(e => e.name === 'checkout').length, 0);
});

test('权益查询失败时阻止结算，重新计算会重试选卡并恢复正常', async t => {
  let fail = true;
  const { form } = setup(t, { tickets: [], getCards: async () => {
    if (fail) throw new Error('offline');
    return [season(1)];
  } });
  await settle(); toggle(form);
  await assert.rejects(form.waitForPrices(), /权益|计价/);
  await form.onCheckout(); assert.equal(form.events.filter(e => e.name === 'checkout').length, 0);
  fail = false; form.onRetryPrices(); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].card_id, 1); assert.equal(form.data.priceError, false);
});

test('查询期间切换顾客或手动选不使用，迟到结果不覆盖新选择', async t => {
  for (const action of ['member', 'manual']) {
    let ready;
    const { form } = setup(t, { getCards: () => new Promise(resolve => { ready = resolve; }) });
    await settle(); toggle(form); await settle();
    if (action === 'member') { form.setProperty('memberId', 11); form.data.cares = [care()]; form._refreshCares(); }
    else form._applyTicketSelection(0, null, null);
    if (ready) ready([season(1)]);
    await settle(); await form.waitForPrices();
    assert.equal(form.data.displayCares[0].card_id, null); assert.equal(form.data.displayCares[0].ticket_code, null);
  }
});

test('保留已选的机打蜡券，新购卡模式不自动替换为账户中的旧卡券', async t => {
  const { form, cardRequests } = setup(t, { cards: [season(1)], rows: [care(1, { ticket_code: 'CHOSEN', ticket: ticket('CHOSEN') })] });
  await settle();
  const loaded = cardRequests.length;
  toggle(form); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].ticket_code, 'CHOSEN'); assert.equal(cardRequests.length, loaded);
  form.data.newCardMode = 'machine'; form.data.hasCardSelection = true;
  form.data.cares = [care()]; form._refreshCares(); toggle(form); await settle();
  assert.equal(form.data.displayCares[0].use_card, false); assert.equal(form.data.displayCares[0].ticket_code, null);
  assert.equal(cardRequests.length, loaded);
});

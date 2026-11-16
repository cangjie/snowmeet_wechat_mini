const test = require('node:test');
const assert = require('node:assert/strict');
const { loadComponent, settle } = require('./reception_harness');

function ticket(code, expiry, memberId = 10) {
  return { code, template_id: 16, name: '老顾客优惠券', member_id: memberId, expire_date: expiry };
}
function care(id, patch) {
  return { id, equipment: '双板', brand: '测试', scale: '170', need_edge: 1, need_wax: 1,
    need_unwax: 1, edge_degree: '89', discount: 0, ...patch };
}
function punch(id, patch) {
  return { id, biz_type: '养护', card_name: '养护单项次卡', total: 5, punches: 1, remaining: 4, isSeason: false, ...patch };
}
function setup(t, fetch, cares = [care(1)], calculate, cards = []) {
  const previous = global.getApp;
  global.getApp = () => ({ globalData: { sessionKey: 'staff' }, loginPromiseNew: Promise.resolve() });
  t.after(() => { global.getApp = previous; });
  const prices = [], requests = [], cardRequests = [];
  const form = loadComponent('components/reception/care_recept_form/care_recept_form.js', {
    getMemberTicketsPromise: (...args) => { requests.push(args); return fetch(...args); },
    getMemberCardsPromise: (...args) => { cardRequests.push(args); return typeof cards === 'function' ? cards(...args) : Promise.resolve(cards); },
    calcCareChargePromise: async req => {
      prices.push(req);
      if (calculate) return calculate(req);
      const chosen = Array.isArray(cards) && cards.find(c => Number(c.id) === Number(req.care.card_id));
      const single = chosen && (chosen.care_project_count === 1 || (chosen.care_project_count == null && (chosen.card_name || '').includes('单项')));
      const cardPrice = single && req.care.need_edge && req.care.need_wax ? 50 : 0;
      return { care: { ...req.care, common_charge: req.care.use_card ? cardPrice : 100,
        discount: Math.max(req.care.discount || 0, req.care.ticket_code ? 20 : 0) } };
    }
  });
  Object.assign(form.data, { memberId: 10, shop: '测试店', cares });
  return { form, prices, requests, cardRequests };
}

test('手动减免已不低于券优惠时不消耗券，已选项目及维修保留', async t => {
  const { form, prices, requests } = setup(t, async () => [ticket('OLD', '2026-11-01')], [
    care(1, { need_repair: 1, repair_memo: '维修', repair_charge: 5, discount: 30 })
  ]);
  form._refreshCares(); await settle();
  const selected = form.data.displayCares[0];
  assert.deepEqual(requests, [[10, '养护', true, 'staff']]);
  assert.ok(!selected.ticket_code);
  assert.equal(selected.need_edge, 1); assert.equal(selected.need_wax, 1); assert.equal(selected.need_unwax, 1);
  assert.equal(selected.repair_memo, '维修'); assert.equal(selected.repair_charge, 5);
  assert.equal(selected.discount, 30); assert.equal(selected._summary, 75);
  assert.ok(prices.length >= 1); assert.ok(prices.every(p => !p.deriveServices));
});

test('多件装备一券一件，临近到期优先，不覆盖已有券卡或质保招待', async t => {
  const { form } = setup(t, async () => [ticket('LATER', '2027-01-01'),
    { ...ticket('OTHER', '2026-10-25'), template_id: 12 }, ticket('EARLY', '2026-11-01'),
    ticket('FOREIGN', '2026-10-26', 99)], [care(1, { ticket_code: 'EXISTING' }),
    care(2, { use_card: true, card_id: 5 }), care(3), care(4), care(5),
    care(6, { warranty: true }), care(7, { entertain: true })]);
  form._refreshCares(); await settle();
  assert.deepEqual(form.data.displayCares.map(c => c.ticket_code || null), ['EXISTING', null, 'OTHER', 'EARLY', 'LATER', null, null]);
  assert.equal(form.data.displayCares[1].card_id, 5);
});

test('切换招待或质保清除已带入的券卡，保留项目及手动减免，仍可主动选择', async t => {
  for (const special of ['entertain', 'warranty']) {
    const { form } = setup(t, async () => [ticket('OLD')], [
      care(1, { need_repair: 1, repair_memo: '维修', repair_charge: 50, _manualDiscount: 7 }),
    ]);
    form._refreshCares(); await settle();
    assert.equal(form.data.displayCares[0].ticket_code, 'OLD');
    form.onSpecialTap({ currentTarget: { dataset: { cidx: 0, special } } });
    await settle();
    let c = form.data.displayCares[0];
    assert.equal(c[special], true);
    assert.equal(c.ticket_code, null);
    assert.equal(c.ticket, null);
    assert.equal(c.need_edge, 1); assert.equal(c.need_wax, 1);
    assert.equal(c.repair_charge, 50); assert.equal(c.discount, 7);
    assert.equal(form.events.at(-1).detail.cares[0].ticket_code, null);
    form._applyTicketSelection(0, ticket('MANUAL'), null, { preserveServices: true });
    await settle();
    c = form.data.displayCares[0];
    assert.equal(c.ticket_code, 'MANUAL');
    form.onSpecialTap({ currentTarget: { dataset: { cidx: 0, special } } });
    assert.equal(form.data.displayCares[0].ticket_code, 'MANUAL');
  }
});

test('切换招待清除自动次卡与锁定，不影响其他装备或迟到的自动选券', async t => {
  let resolve;
  const { form } = setup(t, () => new Promise(r => { resolve = r; }), [
    care(1, { use_card: true, card_id: 9, card_name: '双项卡', card_equip_lock: true }),
    care(2, { ticket_code: 'OTHER' }),
    care(3),
  ]);
  form._refreshCares(); await settle();
  form.onSpecialTap({ currentTarget: { dataset: { cidx: 0, special: 'entertain' } } });
  form.onSpecialTap({ currentTarget: { dataset: { cidx: 2, special: 'warranty' } } });
  resolve([ticket('OLD')]); await settle();
  assert.equal(form.data.displayCares[0].use_card, false);
  assert.equal(form.data.displayCares[0].card_id, null);
  assert.equal(form.data.displayCares[0].card_equip_lock, false);
  assert.equal(form.data.displayCares[1].ticket_code, 'OTHER');
  assert.equal(form.data.displayCares[2].ticket_code || null, null);
});

test('券列表晚到不覆盖手动不使用，草稿落库换ID后也保持选择', async t => {
  let resolve;
  const { form } = setup(t, () => new Promise(r => { resolve = r; }), [care(0, { timeStamp: 123 })]);
  form._refreshCares(); await settle();
  form._applyTicketSelection(0, null, null);
  form.data.cares[0].id = 81;
  form._refreshCares();
  resolve([ticket('OLD')]); await settle();
  assert.equal(form.data.displayCares[0].ticket_code, null);
  assert.equal(form.data.displayCares[0].need_edge, 1); // 手选“不使用”保留已选项目。
  form.data.cares.push(care(82)); form._refreshCares(); await settle();
  assert.equal(form.data.displayCares[0].ticket_code, null);
  assert.equal(form.data.displayCares[1].ticket_code, 'OLD');
});

test('券列表晚到保留手动选中的其他优惠券', async t => {
  let resolve;
  const { form } = setup(t, () => new Promise(r => { resolve = r; }));
  form._refreshCares(); await settle();
  form._applyTicketSelection(0, { code: 'MANUAL', template_id: 12 }, null);
  resolve([ticket('OLD')]); await settle();
  assert.equal(form.data.displayCares[0].ticket_code, 'MANUAL');
});

test('切换顾客时丢弃旧会员的迟到列表，只选新会员的券', async t => {
  const pending = [];
  const { form } = setup(t, memberId => new Promise(resolve => pending.push({ memberId, resolve })));
  form._refreshCares(); await settle();
  form.data.memberId = 11; form._refreshCares(); await settle();
  pending.find(p => p.memberId === 11).resolve([ticket('NEW', null, 11)]); await settle();
  pending.find(p => p.memberId === 10).resolve([ticket('OLD')]); await settle();
  assert.equal(form.data.displayCares[0].ticket_code, 'NEW');
});

test('散客、购卡模式、忙碌或已提交时不自动选券，异步返回也重新检查模式', async t => {
  const { form, requests } = setup(t, async () => [ticket('OLD')]);
  for (const patch of [{ memberId: 0 }, { memberId: 10, newCardMode: 'single' },
    { newCardMode: '', hasCardSelection: true }, { hasCardSelection: false, cardBusy: true },
    { cardBusy: false, cardSubmitted: true }]) {
    Object.assign(form.data, patch); form._refreshCares(); await settle();
  }
  assert.equal(requests.length, 0);
  await form.onCheckout(); // 已提交购卡单仍可重试打开原结算页。
  assert.equal(form.events.filter(e => e.name === 'checkout').length, 1);
  let resolve;
  const second = setup(t, () => new Promise(r => { resolve = r; })).form;
  second._refreshCares(); await settle();
  second.data.newCardMode = 'dual'; resolve([ticket('OLD')]); await settle();
  assert.equal(second.data.displayCares[0].ticket_code, undefined);
});

test('空可用列表不影响开单，重复刷新不重复查券，清空订单后重新读取', async t => {
  let calls = 0;
  const { form } = setup(t, async () => ++calls === 1 ? [] : [ticket('FRESH')]);
  form._refreshCares(); await settle();
  form._refreshCares(); await settle();
  assert.equal(calls, 1); assert.equal(form.data.summary.canCheckout, true);
  form.data.cares = []; form._refreshCares(); await settle();
  form.data.cares = [care(2)]; form._refreshCares(); await settle();
  assert.equal(calls, 2); assert.equal(form.data.displayCares[0].ticket_code, 'FRESH');
});

test('立即去结算等待自动选券和优惠计价完成，重复点击只提交一次', async t => {
  let listReady, priceReady;
  const listWait = new Promise(r => { listReady = r; });
  const priceWait = new Promise(r => { priceReady = r; });
  const { form } = setup(t, () => listWait, [care(1)], async req => {
    if (req.care.ticket_code) await priceWait;
    return { care: { ...req.care, common_charge: 100, discount: req.care.ticket_code ? 20 : 0 } };
  });
  form._refreshCares(); await settle();
  const checkout = form.onCheckout();
  await form.onCheckout();
  assert.equal(form.data.autoTicketCheckout, true);
  assert.equal(form.events.filter(e => e.name === 'checkout').length, 0);
  listReady([ticket('OLD')]); await settle();
  assert.equal(form.events.filter(e => e.name === 'checkout').length, 0);
  priceReady(); await checkout;
  const events = form.events.filter(e => e.name === 'checkout');
  assert.equal(events.length, 1);
  assert.equal(events[0].detail.cares[0].ticket_code, 'OLD');
  assert.equal(events[0].detail.cares[0].discount, 20);
  assert.equal(form.data.autoTicketCheckout, false);
});

test('捆绑次卡清空旧券后，迟到的普通计价不能恢复旧券优惠', async t => {
  let priceReady, ticketCalls = 0;
  const { form } = setup(t, async () => [ticket('OLD')], [care(1)], req => {
    if (req.care.ticket_code && ++ticketCalls > 1) return new Promise(resolve => {
      priceReady = () => resolve({ care: { ...req.care, common_charge: 100, discount: 20 } });
    });
    return { care: { ...req.care, common_charge: 100, discount: req.care.ticket_code ? 20 : 0 } };
  });
  form._refreshCares(); await settle();
  assert.equal(form.data.displayCares[0].ticket_code, 'OLD');
  form.data.newCardMode = 'dual'; form.data.hasCardSelection = true;
  form.data.cares = [care(1, { ticket_code: null, ticket: null, discount: 0, common_charge: 0 })];
  form._refreshCares();
  priceReady(); await settle();
  assert.equal(form.data.displayCares[0].ticket_code, null);
  assert.equal(form.data.displayCares[0].discount, 0);
  assert.equal(form.data.displayCares[0].common_charge, 0);
});

const noService = { need_edge: 0, need_wax: 0, need_unwax: 0, edge_degree: null };

test('还没选养护项目时不自动带卡券，也不替店员推导服务', async t => {
  const { form, prices, cardRequests } = setup(t, async () => [ticket('OLD')], [care(1, noService)],
    req => ({ care: { ...req.care, need_edge: 1, need_wax: 1, need_unwax: 1, edge_degree: '89', common_charge: 0 } }),
    [punch(7, { card_name: '养护双项次卡' })]);
  form._refreshCares(); await settle();
  const selected = form.data.displayCares[0];
  assert.equal(cardRequests.length, 0);
  assert.ok(!selected.use_card); assert.ok(!selected.card_id); assert.ok(!selected.ticket_code);
  assert.equal(prices.length, 0);
  assert.equal(selected.need_edge, 0); assert.equal(selected.need_wax, 0); assert.equal(selected.need_unwax, 0);
});

test('已经选了养护项目时选次卡保留项目、维修和手动减免，不让服务端重新推导', async t => {
  const { form, prices } = setup(t, async () => [ticket('OLD')], [
    care(1, { need_repair: 1, repair_memo: '维修', repair_charge: 50, discount: 30 })
  ], undefined, [punch(7)]);
  form._refreshCares(); await settle();
  const selected = form.data.displayCares[0];
  assert.equal(selected.card_id, 7); assert.equal(selected.ticket_code, null);
  assert.equal(selected.need_edge, 1); assert.equal(selected.need_wax, 1); assert.equal(selected.need_unwax, 1);
  assert.equal(selected.repair_memo, '维修'); assert.equal(selected.repair_charge, 50); assert.equal(selected.discount, 30);
  assert.ok(prices.length >= 1); assert.ok(prices.every(p => !p.deriveServices));
});

test('次卡按开卡先后用，每件装备占一次，用完的卡和本单别的装备已占的次数都扣掉，没卡了回退老顾客券', async t => {
  const { form } = setup(t, async () => [ticket('OLD')],
    [care(1, { use_card: true, card_id: 3 }), care(2), care(3), care(4)], undefined,
    [punch(9, { remaining: 5 }), punch(3, { remaining: 2 }), punch(5, { remaining: 0, punches: 5 })]);
  form._refreshCares(); await settle();
  assert.deepEqual(form.data.displayCares.map(c => c.card_id || null), [3, 3, 9, 9]);
  assert.deepEqual(form.data.displayCares.map(c => c.ticket_code || null), [null, null, null, null]);
  const one = setup(t, async () => [ticket('OLD')], [care(1), care(2)], undefined, [punch(3, { remaining: 1 })]).form;
  one._refreshCares(); await settle();
  assert.deepEqual(one.data.displayCares.map(c => c.card_id || null), [3, null]);
  assert.deepEqual(one.data.displayCares.map(c => c.ticket_code || null), [null, 'OLD']);
});

test('机打蜡次卡、已退款卡、别人的卡和非养护卡不自动选，仍带老顾客券', async t => {
  const { form } = setup(t, async () => [ticket('OLD')], [care(1)], undefined, [
    punch(2, { card_name: '机打蜡次卡' }), punch(3, { is_refund: true }), punch(4, { member_id: 99 }),
    punch(5, { biz_type: '租赁' })]);
  form._refreshCares(); await settle();
  const selected = form.data.displayCares[0];
  assert.equal(selected.ticket_code, 'OLD'); assert.ok(!selected.use_card); assert.ok(!selected.card_id);
});

function season(id, patch) {
  return { id, biz_type: '养护', card_name: '养护季卡', total: null, punches: 0, remaining: null, isSeason: true,
    usedToday: false, equipBound: false, equip_type: null, equip_brand: null, equip_scale: null, ...patch };
}

test('同价时优先季卡，每张季卡本单只给一件装备，其余件比较券卡', async t => {
  const { form, prices } = setup(t, async () => [ticket('OLD')], [care(1), care(2)], undefined,
    [punch(3, { card_name: '养护双项次卡', care_project_count: 2 }), season(9, { care_project_count: 2 })]);
  form._refreshCares(); await settle();
  assert.deepEqual(form.data.displayCares.map(c => c.card_id), [9, 3]);
  assert.deepEqual(form.data.displayCares.map(c => c.ticket_code || null), [null, null]);
  assert.ok(prices.every(p => !p.deriveServices));
});

test('季卡今天已经用过就跳过，改选次卡；本单别的装备已占用的季卡也不重复选', async t => {
  const used = setup(t, async () => [ticket('OLD')], [care(1)], undefined, [season(9, { usedToday: true }), punch(3)]).form;
  used._refreshCares(); await settle();
  assert.equal(used.data.displayCares[0].card_id, 3);
  const taken = setup(t, async () => [ticket('OLD')], [care(1, { use_card: true, card_id: 9 }), care(2)], undefined,
    [season(9), punch(3)]).form;
  taken._refreshCares(); await settle();
  assert.deepEqual(taken.data.displayCares.map(c => c.card_id), [9, 3]);
});

test('限装备季卡只给装备对得上的那件，对不上就不带；没开卡的打蜡季卡标待开卡', async t => {
  const bound = { equipBound: true, equip_type: '双板', equip_brand: '测试', equip_scale: '170' };
  const match = setup(t, async () => [ticket('OLD')], [care(1)], undefined, [season(9, bound), punch(3)]).form;
  match._refreshCares(); await settle();
  const picked = match.data.displayCares[0];
  assert.equal(picked.card_id, 9); assert.equal(picked.card_equip_lock, false); assert.equal(picked.card_pending_open, false);
  const wax = setup(t, async () => [ticket('OLD')], [care(1)], undefined,
    [season(9, { ...bound, card_name: '热蜡季卡' })]).form;
  wax._refreshCares(); await settle();
  assert.equal(wax.data.displayCares[0].card_equip_lock, true); assert.equal(wax.data.displayCares[0].card_pending_open, false);
  // 品牌或长度填了但对不上，或装备类型已经不一样，都不带季卡，改用次卡
  const other = setup(t, async () => [ticket('OLD')], [care(1, { scale: '165' }),
    care(2, { equipment: '单板', brand: null, scale: null })], undefined, [season(9, bound), punch(3, { remaining: 4 })]).form;
  other._refreshCares(); await settle();
  assert.deepEqual(other.data.displayCares.map(c => c.card_id), [3, 3]);
  const fresh = setup(t, async () => [ticket('OLD')], [care(1)], undefined, [season(9, { card_name: '热蜡季卡' })]).form;
  fresh._refreshCares(); await settle();
  const pending = fresh.data.displayCares[0];
  assert.equal(pending.card_id, 9); assert.equal(pending.card_pending_open, true); assert.equal(pending.card_equip_lock, false);
});

test('装备未填全时先比较可用次卡，填全后自动重新比较季卡', async t => {
  const bound = { equipBound: true, equip_type: '双板', equip_brand: '测试', equip_scale: '170' };
  const blank = { equipment: null, brand: null, scale: null };
  const { form } = setup(t, async () => [ticket('OLD')], [care(1, blank), care(2, blank)], undefined,
    [season(9, bound), punch(3)]);
  form._refreshCares(); await settle();
  assert.deepEqual(form.data.displayCares.map(c => c.card_id || null), [3, 3]);
  assert.deepEqual(form.data.displayCares.map(c => c.ticket_code || null), [null, null]);
  Object.assign(form.data.cares[0], { equipment: '双板', brand: '测试', scale: '170' });
  Object.assign(form.data.cares[1], { equipment: '双板', brand: '测试', scale: '180' });
  form._refreshCares(); await settle();
  assert.deepEqual(form.data.displayCares.map(c => c.card_id), [9, 3]);
  assert.equal(form.data.displayCares[0].card_equip_lock, false);
});

test('既有双项又有单项次卡先选双项，以卡上的项目数为准，历史卡才看卡名，同类按开卡先后', async t => {
  const pick = async cards => {
    const { form } = setup(t, async () => [ticket('OLD')], [care(1)], undefined, cards);
    form._refreshCares(); await settle();
    return form.data.displayCares[0].card_id;
  };
  assert.equal(await pick([punch(3, { care_project_count: 1 }), punch(8, { care_project_count: 2 })]), 8);
  assert.equal(await pick([punch(3, { card_name: '养护单项次卡' }), punch(8, { card_name: '养护双项次卡' })]), 8);
  // 卡上写了单项就是单项，哪怕卡名里有「双项」两个字；没写的历史卡才看卡名
  assert.equal(await pick([punch(3, { card_name: '双项体验次卡', care_project_count: 1 }), punch(8, { care_project_count: 1 })]), 3);
  assert.equal(await pick([punch(3, { care_project_count: 1 }), punch(8, { card_name: '老双项卡' })]), 8);
  assert.equal(await pick([punch(8, { care_project_count: 2 }), punch(3, { care_project_count: 2 })]), 3);
  // 双项卡用完了就退到单项卡
  assert.equal(await pick([punch(3, { care_project_count: 1 }), punch(8, { care_project_count: 2, remaining: 0, punches: 5 })]), 3);
  // 双项季卡也排在单项季卡前面
  assert.equal(await pick([season(3, { care_project_count: 1 }), season(8, { care_project_count: 2 })]), 8);
});

test('已选封板算选了项目，未选项目不因季卡自动选机打蜡', async t => {
  const sealed = setup(t, async () => [ticket('OLD')], [care(1, { ...noService, seal_board: 1 })], undefined, [punch(3)]);
  sealed.form._refreshCares(); await settle();
  assert.equal(sealed.form.data.displayCares[0].card_id, 3); assert.equal(sealed.prices[0].deriveServices, false);
  const machine = setup(t, async () => [ticket('OLD')], [care(1, noService)], undefined, [season(9, { card_name: '机打蜡季卡' })]);
  machine.form._refreshCares(); await settle();
  assert.ok(!machine.form.data.displayCares[0].card_id); assert.equal(machine.prices.length, 0);
});

test('机打蜡选择专用券，非雪季和养板不自动选次卡', async t => {
  const wx = global.wx; global.wx = { showToast() {} }; t.after(() => { global.wx = wx; });
  const { form } = setup(t, async () => [ticket('A'), ticket('B', '2027-02-01'), { ...ticket('W'), template_id: 12 }],
    [care(1, { free_wax: 1, need_edge: 0, need_wax: 0, need_unwax: 0 }), care(2, { summer: 'now' }),
      care(3, { maintain_board: 1 })], undefined, [punch(7)]);
  form._refreshCares(); await settle();
  assert.ok(form.data.displayCares.every(c => !c.card_id && !c.use_card));
  assert.equal(form.data.displayCares[0].ticket_code, 'W');
  assert.deepEqual(form.data.displayCares.slice(1).map(c => c.ticket_code).sort(), ['A', 'B']);
});

test('次卡列表读取失败不声称已比出最优；手选不使用后不再自动换成次卡', async t => {
  const failed = setup(t, async () => [ticket('OLD')], [care(1)], undefined, () => Promise.reject(new Error('offline')));
  const warn = console.warn; console.warn = () => {}; t.after(() => { console.warn = warn; });
  failed.form._refreshCares(); await settle();
  assert.ok(!failed.form.data.displayCares[0].ticket_code);
  assert.equal(failed.form.data.priceError, true);
  const { form } = setup(t, async () => [ticket('OLD')], [care(1)], undefined, [punch(7)]);
  form._refreshCares(); await settle();
  form._applyTicketSelection(0, null, null); await settle();
  form.data.cares.push(care(2)); form._refreshCares(); await settle();
  assert.equal(form.data.displayCares[0].card_id, null); assert.equal(form.data.displayCares[0].ticket_code, null);
  assert.equal(form.data.displayCares[1].card_id, 7);
});

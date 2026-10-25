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
function setup(t, fetch, cares = [care(1)], calculate) {
  const previous = global.getApp;
  global.getApp = () => ({ globalData: { sessionKey: 'staff' }, loginPromiseNew: Promise.resolve() });
  t.after(() => { global.getApp = previous; });
  const prices = [], requests = [];
  const form = loadComponent('components/reception/care_recept_form/care_recept_form.js', {
    getMemberTicketsPromise: (...args) => { requests.push(args); return fetch(...args); },
    calcCareChargePromise: async req => {
      prices.push(req);
      if (calculate) return calculate(req);
      return { care: { ...req.care, common_charge: 100, discount: Math.max(req.care.discount || 0, req.care.ticket_code ? 20 : 0) } };
    }
  });
  Object.assign(form.data, { memberId: 10, shop: '测试店', cares });
  return { form, prices, requests };
}

test('自动选中可用老顾客券并重新计费，已选项目、维修和较大手动减免保留', async t => {
  const { form, prices, requests } = setup(t, async () => [ticket('OLD', '2026-11-01')], [
    care(1, { need_repair: 1, repair_memo: '维修', repair_charge: 5, discount: 30 })
  ]);
  form._refreshCares(); await settle();
  const selected = form.data.displayCares[0];
  assert.deepEqual(requests, [[10, '养护', true, 'staff']]);
  assert.equal(selected.ticket_code, 'OLD'); assert.equal(selected.ticket.name, '老顾客优惠券');
  assert.equal(selected.need_edge, 1); assert.equal(selected.need_wax, 1); assert.equal(selected.need_unwax, 1);
  assert.equal(selected.repair_memo, '维修'); assert.equal(selected.repair_charge, 5);
  assert.equal(selected.discount, 30); assert.equal(selected._summary, 75);
  assert.equal(prices.length, 1); assert.equal(prices[0].deriveServices, false);
  assert.equal(prices[0].care.ticket_code, 'OLD');
  assert.equal(form.events.at(-1).detail.cares[0].ticket_code, 'OLD');
});

test('多件装备一券一件，临近到期优先，不覆盖已有券卡或质保招待', async t => {
  const { form } = setup(t, async () => [ticket('LATER', '2027-01-01'),
    { ...ticket('OTHER', '2026-10-25'), template_id: 12 }, ticket('EARLY', '2026-11-01'),
    ticket('FOREIGN', '2026-10-26', 99)], [care(1, { ticket_code: 'EXISTING' }),
    care(2, { use_card: true, card_id: 5 }), care(3), care(4), care(5),
    care(6, { warranty: true }), care(7, { entertain: true })]);
  form._refreshCares(); await settle();
  assert.deepEqual(form.data.displayCares.map(c => c.ticket_code || null), ['EXISTING', null, 'EARLY', 'LATER', null, null, null]);
  assert.equal(form.data.displayCares[1].card_id, 5);
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
  assert.equal(form.data.displayCares[0].need_edge, 0); // 手选“不使用”的原规则保留。
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
  const { form } = setup(t, () => new Promise(r => { listReady = r; }), [care(1)],
    req => new Promise(resolve => { priceReady = () => resolve({ care: { ...req.care, common_charge: 100, discount: 20 } }); }));
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

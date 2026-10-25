const test = require('node:test');
const assert = require('node:assert/strict');
const { loadComponent, loadPage, settle } = require('./reception_harness');

function care(id = 1, patch = {}) {
  return { id, equipment: '双板', brand: '测试', scale: '170', need_edge: 1, need_wax: 1,
    need_unwax: 1, edge_degree: '89', common_charge: 230, repair_charge: 0, discount: 0, ...patch };
}
function price(req) {
  const c = { ...req.care };
  if (req.changedField === 'need_wax') c.need_unwax = c.need_wax;
  c.common_charge = c.warranty || c.entertain ? 0 : c.need_edge && c.need_wax ? 230 : 170;
  return { care: c };
}
function setup(t, calculate = async req => price(req), rows = [care()]) {
  const oldApp = global.getApp, oldWx = global.wx;
  const toasts = [], requests = [];
  global.getApp = () => ({ globalData: { sessionKey: 'test' }, loginPromiseNew: Promise.resolve() });
  global.wx = { showToast: o => toasts.push(o.title), showModal: o => o.success({ confirm: true }) };
  t.after(() => { global.getApp = oldApp; global.wx = oldWx; });
  const form = loadComponent('components/reception/care_recept_form/care_recept_form.js', {
    getMemberTicketsPromise: async () => [],
    calcCareChargePromise: async req => { requests.push(req); return calculate(req); }
  });
  Object.assign(form.data, { memberId: null, shop: '万龙服务中心', cares: rows });
  form._refreshCares();
  return { form, requests, toasts };
}
function amount(form, field, value, cidx = 0) {
  form.data.amountModal = { cidx, field, value: String(value) };
  form.onAmountModalConfirm();
}

test('质保、招待、附加费、减免和装备字段变化均重新向服务器计价，回填不循环请求', async t => {
  const { form, requests } = setup(t, undefined, [care(1, { need_repair: 1, repair_memo: '维修' })]);
  form.onSpecialTap({ currentTarget: { dataset: { cidx: 0, special: 'warranty' } } });
  assert.equal(form.data.pricePending, true);
  await form.waitForPrices(); assert.equal(form.data.summary.totalLabel, '0.00');
  form.onSpecialTap({ currentTarget: { dataset: { cidx: 0, special: 'none' } } });
  await form.waitForPrices(); assert.equal(form.data.summary.totalLabel, '230.00');
  form.onSpecialTap({ currentTarget: { dataset: { cidx: 0, special: 'entertain' } } });
  await form.waitForPrices(); assert.equal(form.data.summary.totalLabel, '0.00');
  form.onSpecialTap({ currentTarget: { dataset: { cidx: 0, special: 'none' } } });
  await form.waitForPrices();
  amount(form, 'repair_charge', 0.01); await form.waitForPrices();
  assert.equal(form.data.summary.totalLabel, '230.01');
  amount(form, 'discount', 10); await form.waitForPrices();
  assert.equal(form.data.summary.totalLabel, '220.01');
  form.onFieldBlur({ currentTarget: { dataset: { cidx: 0, field: 'scale' } }, detail: { value: '180' } });
  await form.waitForPrices(); await settle();
  assert.equal(requests.length, 7); assert.equal(requests.at(-1).care.scale, '180');
  assert.equal(form.data.pricePending, false);
});

test('同一事件内的金额编辑合并取最新状态，服务按钮仍只请求一次并保留联动参数', async t => {
  const { form, requests } = setup(t);
  amount(form, 'repair_charge', 0.01); amount(form, 'discount', 0.01);
  await form.waitForPrices();
  assert.equal(requests.length, 1); assert.equal(requests[0].care.repair_charge, 0.01);
  assert.equal(requests[0].care.discount, 0.01);
  form.onSvcToggle({ currentTarget: { dataset: { cidx: 0, flag: 'need_wax' } } });
  await form.waitForPrices();
  assert.equal(requests.length, 2); assert.equal(requests[1].changedField, 'need_wax');
  assert.equal(form.data.displayCares[0].need_unwax, 0);
  assert.equal(form.data.summary.totalLabel, '170.00');
});

test('新金额先返回、旧金额后返回时不会回退；草稿获得真实ID后也适用', async t => {
  const pending = [];
  const { form } = setup(t, req => new Promise(resolve => pending.push({ req, resolve })), [care(0, { timeStamp: 123 })]);
  amount(form, 'repair_charge', 1); await settle();
  form.data.cares[0].id = 81; form._refreshCares();
  amount(form, 'discount', 10); await settle();
  pending[1].resolve(price(pending[1].req)); await settle();
  assert.equal(form.data.summary.totalLabel, '221.00');
  pending[0].resolve(price(pending[0].req)); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].id, 81);
  assert.equal(form.data.displayCares[0].discount, 10);
  assert.equal(form.data.summary.totalLabel, '221.00');
});

test('编辑金额后立刻结算会等待最新服务器计价，重复点击只提交一次', async t => {
  let ready;
  const { form } = setup(t, req => new Promise(resolve => { ready = () => resolve(price(req)); }));
  amount(form, 'repair_charge', 0.01);
  const checkout = form.onCheckout(); await form.onCheckout(); await settle();
  assert.equal(form.events.filter(e => e.name === 'checkout').length, 0);
  ready(); await checkout;
  const events = form.events.filter(e => e.name === 'checkout');
  assert.equal(events.length, 1); assert.equal(events[0].detail.cares[0].repair_charge, 0.01);
  assert.equal(events[0].detail.cares[0].common_charge, 230);
});

test('计价失败显示失败状态并阻止结算，重算成功后恢复；不会把费用误置零', async t => {
  let fail = true;
  const { form } = setup(t, async req => { if (fail) throw new Error('offline'); return price(req); });
  amount(form, 'repair_charge', 0.01);
  await assert.rejects(form.waitForPrices(), /计价失败/);
  assert.equal(form.data.priceError, true); assert.equal(form.data.displayCares[0].common_charge, 230);
  await form.onCheckout(); assert.equal(form.events.filter(e => e.name === 'checkout').length, 0);
  fail = false; form.onRetryPrices(); await form.waitForPrices();
  assert.equal(form.data.priceError, false); assert.equal(form.data.summary.totalLabel, '230.01');
});

test('删除装备后，原装备的迟到价格不套用到移动后的下一件', async t => {
  let ready;
  const { form } = setup(t, req => new Promise(resolve => { ready = () => resolve(price(req)); }), [care(1), care(2)]);
  amount(form, 'repair_charge', 100); await settle();
  form.onDeleteCare({ currentTarget: { dataset: { idx: 0 } } });
  ready(); await form.waitForPrices();
  assert.equal(form.data.displayCares.length, 1); assert.equal(form.data.displayCares[0].id, 2);
  assert.equal(form.data.summary.totalLabel, '230.00');
});

test('60.01同时显示卡款与230减170的补差，旧响应缺少价格明细时仍兼容', t => {
  setup(t);
  const cards = require('../utils/careCardSale');
  const raw = { amount: 60.01, cardAmount: 0.01, careAmount: 60, items: [], projects: [
    { careId: 1, need_edge: 1, need_wax: 1, serviceAmount: 230, cardCoveredAmount: 170,
      common_charge: 60, repair_charge: 0, discount: 0, amount: 60 }
  ] };
  const display = cards.displayPreview(raw, [care()]);
  assert.equal(display.amountLabel, '¥60.01'); assert.equal(display.cardAmountLabel, '¥0.01');
  assert.equal(display.singleServiceDifference, '¥230.00 − ¥170.00 ＝ ¥60.00');
  assert.equal(display.projects[0].projectsLabel, '修刃＋热蜡');
  delete raw.projects[0].serviceAmount; delete raw.projects[0].cardCoveredAmount;
  assert.equal(cards.displayPreview(raw, [care()]).singleServiceDifference, '');
});

test('选卡试算先等待普通计价和最新草稿保存，再读取服务器金额', async t => {
  setup(t);
  const page = loadPage('pages/admin/reception/recept_new.js', {});
  Object.assign(page.data, { order: { id: 20, cares: [care()] }, cardSaleShow: true,
    cardSaleProducts: [{ id: 728, quantity: 1 }] });
  let ready;
  page.selectComponent = () => ({ waitForPrices: () => new Promise(resolve => { ready = resolve; }) });
  const order = [];
  page.saveCareReceptOrder = async () => { order.push('save:' + page.data.order.cares[0].repair_charge); };
  page._cardApi = async () => { order.push('preview'); return { amount: 0.02, items: [], projects: [] }; };
  const recalculation = page.onCardRecalculate(); await settle();
  assert.deepEqual(order, []); assert.equal(page.data.cardSalePreview, null);
  page.data.order.cares[0].repair_charge = 0.01; ready(); await recalculation;
  assert.deepEqual(order, ['save:0.01', 'preview']); assert.equal(page.data.cardSalePreview.amountLabel, '¥0.02');
});

test('购卡后附加费与顾客信息变更都会作废旧试算并重新取得合计', async t => {
  setup(t);
  const page = loadPage('pages/admin/reception/recept_new.js', {});
  Object.assign(page.data, { bizType: 'maintain', order: { id: 20, cares: [care()] },
    careCardSelections: [{ productId: 728, quantity: 1 }], careCardPreview: { amount: 60.01 } });
  const calls = [];
  page.saveCareReceptOrder = async () => page.data.order;
  page._cardApi = async action => {
    calls.push(action);
    const c = page.data.order.cares[0];
    return { amount: 0.01 + c.repair_charge, items: [{ productId: 728, price: 0.01, total: 3 }],
      projects: [{ careId: 1, need_edge: 1, common_charge: 0, repair_charge: c.repair_charge, discount: 0 }] };
  };
  page.onSyncCare({ detail: { cares: [care(1, { repair_charge: 0.01 })] } });
  assert.equal(page.data.careCardPreview, null); await settle();
  assert.equal(page.data.careCardPreview.amountLabel, '¥0.02');
  page.onCustomerChange({ detail: { name: '顾客' } });
  assert.equal(page.data.careCardPreview, null); await settle();
  assert.deepEqual(calls, ['SaveDraft', 'SaveDraft']);
  await page._refreshSavedCareCards(page._careCardRevision - 1);
  assert.equal(calls.length, 2);
});

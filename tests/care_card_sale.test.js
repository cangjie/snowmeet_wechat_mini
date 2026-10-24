const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadPage, loadComponent, settle } = require('./reception_harness');

function setup(t) {
  const oldApp = global.getApp;
  const oldWx = global.wx;
  const toasts = [], navigations = [];
  global.getApp = () => ({ globalData: { requestPrefix: 'https://test.invalid/api/', sessionKey: 'test' }, loginPromiseNew: Promise.resolve() });
  global.wx = { showToast: x => toasts.push(x.title), navigateTo: x => navigations.push(x.url) };
  t.after(() => { global.getApp = oldApp; global.wx = oldWx; });
  const page = loadPage('pages/admin/reception/recept_new.js', {});
  Object.assign(page.data, { bizType: 'maintain', customer: { memberId: 10 },
    order: { id: 20, cares: [{ id: 30, equipment: '双板', brand: '测试', scale: '170', need_edge: 1, need_wax: 1, common_charge: 100 }] } });
  page.saveCareReceptOrder = async () => page.data.order;
  return { page, toasts, navigations };
}

function preview(amount = 600) {
  return { amount, careOrderId: 20, items: [{ lineNo: 1, productId: 101, name: '双项10次卡', price: amount,
    total: 10, projectCount: 2, requiresBinding: false, careIds: [30], punches: 1, remaining: 9 }] };
}

test('入口位于添加装备下方，养护选卡与结算展示本次试算', () => {
  const form = fs.readFileSync(path.join(__dirname, '../components/reception/care_recept_form/care_recept_form.wxml'), 'utf8');
  assert.ok(form.indexOf('<text>添加装备</text>') < form.indexOf('<text>添加卡类'));
  const page = fs.readFileSync(path.join(__dirname, '../pages/admin/reception/recept_new.wxml'), 'utf8');
  assert.match(page, /本次试算/);
  assert.match(page, /确认选卡/);
});

test('旧试算晚到不覆盖新选择；试算不下单、不扣次', async t => {
  const { page } = setup(t);
  page.setData({ cardSaleShow: true, cardSaleProducts: [{ id: 101, quantity: 1 }] });
  const pending = [];
  page._cardApi = (action, body) => {
    assert.equal(action, 'Preview');
    return new Promise(resolve => pending.push({ resolve, body }));
  };
  const first = page.onCardRecalculate();
  await settle();
  page.setData({ cardSaleProducts: [{ id: 101, quantity: 2 }] });
  const second = page.onCardRecalculate();
  await settle();
  pending[1].resolve(preview(1200));
  await second;
  pending[0].resolve(preview(600));
  await first;
  assert.equal(page.data.cardSalePreview.amount, 1200);
  assert.equal(page.data.cardSaleLoading, false);
  assert.equal(pending[1].body.selections[0].quantity, 2);
});

test('提交前金额变化需要重新确认，不直接按新价下单', async t => {
  const { page, navigations, toasts } = setup(t);
  page.setData({ cardSaleShow: true, cardSaleProducts: [{ id: 101, quantity: 1 }], cardSalePreview: preview() });
  const actions = [];
  page._cardApi = async action => { actions.push(action); return preview(700); };
  await page.onCareCardConfirm();
  assert.deepEqual(actions, ['SaveDraft']);
  assert.equal(page.data.cardSalePreview.amount, 700);
  assert.equal(navigations.length, 0);
  assert.match(toasts[0], /重新确认/);
});

test('确认选卡只保存草稿和项目，留在开单页；原结算按钮才正式提交', async t => {
  const { page, navigations } = setup(t);
  const trial = preview();
  trial.projects = [{ careId: 30, need_edge: 1, need_wax: 1, need_unwax: 1, free_wax: 0 }];
  page.data.order.cares[0].need_wax = 0;
  page.setData({ cardSaleShow: true, cardSaleProducts: [{ id: 101, quantity: 1 }], cardSalePreview: trial });
  const actions = [];
  page._cardApi = async action => {
    actions.push(action);
    if (action === 'SaveDraft') return trial;
    assert.equal(action, 'Submit'); return { orderId: 40, careOrderId: 20 };
  };
  await page.onCareCardConfirm();
  assert.deepEqual(actions, ['SaveDraft']); assert.equal(navigations.length, 0);
  assert.equal(page.data.cardSaleShow, false); assert.equal(page.data.order.id, 20);
  assert.equal(page.data.order.cares[0].need_wax, 1); assert.equal(page.data.careCardMode, 'dual');
  await page._checkoutCare(false);
  assert.deepEqual(actions, ['SaveDraft', 'SaveDraft', 'Submit']);
  assert.equal(navigations[0], '/pages/payment/settle/index?orderId=40&careOrderId=20');
  assert.equal(page.data.order.id, 0); assert.deepEqual(page.data.careCardSelections, []);
});

test('单项卡可先确认，未逐件选好项目时禁止结算', async t => {
  const { page, navigations } = setup(t);
  const trial = preview(); trial.items[0].projectCount = 1; trial.items[0].name = '单项10次卡';
  trial.canCheckout = false; trial.errors = ['第1件装备请选择修刃或热蜡（单项）'];
  trial.projects = [{ careId: 30, need_edge: 0, need_wax: 0, free_wax: 0 }];
  page.setData({ cardSaleShow: true, cardSaleProducts: [{ id: 101, quantity: 1 }], cardSalePreview: trial });
  const actions = []; page._cardApi = async action => { actions.push(action); return trial; };
  await page.onCareCardConfirm();
  assert.equal(page.data.cardSaleShow, false); assert.equal(page.data.careCardMode, 'single');
  await page._checkoutCare(false);
  assert.deepEqual(actions, ['SaveDraft', 'SaveDraft']); assert.equal(navigations.length, 0);
  assert.match(page.data.careCardError, /单项/);
});

test('下单失败保留已选卡，未选卡仍走普通养护', async t => {
  const { page, navigations } = setup(t);
  let normal = 0; page._doCheckoutCare = () => normal++;
  page._checkoutCare(false); assert.equal(normal, 1);
  page.setData({ careCardSelections: [{ productId: 101, quantity: 1 }], careCardPreview: preview() });
  page._cardApi = async action => { if (action === 'SaveDraft') return preview(); throw new Error('请重试'); };
  await page._checkoutCare(false);
  assert.equal(page.data.order.id, 20); assert.equal(page.data.careCardSelections.length, 1);
  assert.equal(navigations.length, 0); assert.equal(normal, 1); assert.match(page.data.careCardError, /请重试/);
});

test('下单响应丢失时恢复原零售订单，不重复开单', async t => {
  const { page, navigations } = setup(t);
  page.setData({ careCardSelections: [{ productId: 101, quantity: 1 }], careCardPreview: preview() });
  const actions = [];
  page._cardApi = async action => {
    actions.push(action);
    if (action === 'SaveDraft') return preview();
    if (action === 'Submit') throw new Error('响应超时');
    assert.equal(action, 'GetDraft'); return { retailOrderId: 40, careOrderId: 20 };
  };
  await page._checkoutCare(false);
  assert.deepEqual(actions, ['SaveDraft', 'Submit', 'GetDraft']);
  assert.equal(navigations[0], '/pages/payment/settle/index?orderId=40&careOrderId=20');
});

test('换卡自动清空其他品种数量，机打蜡季卡多装备时不可选', async t => {
  const { page } = setup(t); page.onCardRecalculate = async () => {};
  page.data.cardSaleProducts = [{ id: 101, quantity: 2 }, { id: 102, quantity: 0 }, { id: 103, quantity: 0, unavailable: true }];
  page.onCareCardQuantity({ currentTarget: { dataset: { id: 102, delta: 1 } } });
  assert.deepEqual(page.data.cardSaleProducts.map(p => p.quantity), [0, 1, 0]);
  page.onCareCardQuantity({ currentTarget: { dataset: { id: 103, delta: 1 } } });
  assert.deepEqual(page.data.cardSaleProducts.map(p => p.quantity), [0, 1, 0]);
});

test('单项修刃与热蜡互斥；新增装备继承双项默认；季卡不能再添装备', t => {
  setup(t);
  const form = loadComponent('components/reception/care_recept_form/care_recept_form.js', {});
  form.data.newCardMode = 'single'; form.data.displayCares = [{ need_edge: 1, need_wax: 0 }];
  form._mutate = (i, fn) => fn(form.data.displayCares[i]);
  const toggle = flag => form.onSvcToggle({ currentTarget: { dataset: { cidx: 0, flag } } });
  toggle('need_wax'); assert.equal(form.data.displayCares[0].need_edge, 0); assert.equal(form.data.displayCares[0].need_wax, 1);
  toggle('need_edge'); assert.equal(form.data.displayCares[0].need_edge, 1); assert.equal(form.data.displayCares[0].need_wax, 0);
  form.data.newCardMode = 'dual'; form.data.cares = []; form._refreshCares = () => {}; form._emitSync = () => {};
  form.onAddCare(); assert.equal(form.data.cares[0].need_edge, 1); assert.equal(form.data.cares[0].need_wax, 1);
  form.data.newCardMode = 'machine'; form.onAddCare(); assert.equal(form.data.cares.length, 1);
});

test('后端未启用时明确提示，不生成购卡订单', async t => {
  const { page } = setup(t);
  page._cardApi = async action => { assert.equal(action, 'GetProducts'); return { enabled: false }; };
  await page.onAddCareCard();
  assert.match(page.data.cardSaleError, /尚未启用/);
  assert.equal(page.data.order.id, 20);
  assert.equal(page.data.cardSaleBusy, false);
});

test('结算失败提示已收款并可重试，不再次发起付款', async t => {
  const { page: unused } = setup(t);
  const api = require('../utils/careCardSale');
  const original = api.request;
  t.after(() => { api.request = original; });
  const page = loadPage('pages/payment/settle/index.js', {});
  page.data.careOrderId = 20;
  let tries = 0;
  api.request = async action => { assert.equal(action, 'RetryCompletion'); tries++; throw new Error('处理中'); };
  await page.onPaid({ detail: { orderId: 40, order: { type: '零售' } } });
  assert.equal(tries, 1);
  assert.match(page.data.cardCompletionError, /请勿再次收款/);
  assert.equal(page.data.cardCompletionBusy, false);
  assert.equal(unused.data.order.id, 20);
});

test('关联养护从详情进入零售结算，两张订单可以互相查看', t => {
  const { navigations } = setup(t);
  const care = loadPage('pages/admin/care/care_order_detail/care_order_detail.js', {});
  care.data.order = { id: 20, careCardSale: { retailOrderId: 40, careOrderId: 20 } };
  care.onGoPay();
  assert.equal(navigations[0], '/pages/payment/settle/index?orderId=40&careOrderId=20');
  care.onViewCardPurchase();
  assert.equal(navigations[1], '/pages/admin/retail/retail_order_detail?id=40');
  const retail = loadPage('pages/admin/retail/retail_order_detail.js', {});
  retail.data.order = { id: 40, careCardSale: { retailOrderId: 40, careOrderId: 20 } };
  retail.onViewLinkedCare();
  assert.equal(navigations[2], '/pages/admin/care/care_order_detail/care_order_detail?id=20');
});

test('已收卡款未核销的零售单可继续处理，金额显示全部卡款', t => {
  const { navigations } = setup(t);
  const retail = loadPage('pages/admin/retail/retail_order_detail.js', {});
  retail.renderOrder({ id: 40, type: '零售', valid: 1, dealed: 0, closed: 0,
    total_amount: 1200, paying_amount: 1200, paidAmount: 1200,
    careCardSale: { careOrderId: 20, retailOrderId: 40, completed: false },
    retails: [{ id: 1, deal_price: 600 }, { id: 2, deal_price: 600 }] });
  assert.equal(retail.data.view.showGoPay, true);
  assert.equal(retail.data.view.goPayLabel, '继续发卡核销');
  assert.equal(retail.data.view.canEditAmount, false);
  assert.match(retail.data.view.amountStr, /1200/);
  retail.onGoPay();
  assert.equal(navigations[0], '/pages/payment/settle/index?orderId=40&careOrderId=20');
});

test('非打蜡季卡不锁板且不提示首次绑板，打蜡季卡保留绑定提示', t => {
  setup(t);
  const form = loadComponent('components/reception/care_recept_form/care_recept_form.js', {});
  form.data.displayCares = [{ equipment: '双板', brand: '原品牌', scale: '170' }];
  form._mutate = (index, fn) => fn(form.data.displayCares[index]);
  form._fetchPrice = () => {};
  form._applyTicketSelection(0, null, { id: 1, card_name: '双项养护季卡', total: null,
    equipBound: true, equip_type: '单板', equip_brand: '其他品牌', equip_scale: '150' });
  assert.equal(form.data.displayCares[0].equipment, '双板');
  assert.equal(form.data.displayCares[0].card_equip_lock, false);
  assert.equal(form.data.displayCares[0].card_pending_open, false);
  form._applyTicketSelection(0, null, { id: 2, card_name: '机打蜡季卡', total: null, equipBound: false });
  assert.equal(form.data.displayCares[0].card_pending_open, true);
});

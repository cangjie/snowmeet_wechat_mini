const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, loadComponent, settle } = require('./reception_harness');

function setup(t) {
  const oldApp = global.getApp, oldWx = global.wx;
  const navigations = [], toasts = [];
  global.getApp = () => ({ globalData: { sessionKey: 'test' }, loginPromiseNew: Promise.resolve() });
  global.wx = {
    navigateTo: o => { navigations.push(o.url); if (o.success) o.success(); },
    showToast: o => toasts.push(o.title)
  };
  t.after(() => { global.getApp = oldApp; global.wx = oldWx; });
  return { navigations, toasts };
}

function order() {
  return { id: 20, type: '养护', valid: 1, dealed: 0, closed: 0, pay_with_deposit: false, total_amount: 0.02, paying_amount: 0.02,
    careCardSale: { careOrderId: 20, retailOrderId: 20, cardAmount: 0.01, careAmount: 0.01, completed: false },
    retails: [{ id: 10, product_id: 101, retail_type: '养护卡', deal_price: 0.01, product: { name: '测试次卡' } }],
    cares: [{ id: 30, equipment: '双板', need_edge: 1, need_repair: 1, repair_charge: 0.01 }] };
}

test('购卡及养护共用原订单ID进入结算，成功后才清理开单页', async t => {
  const { navigations } = setup(t);
  const page = loadPage('pages/admin/reception/recept_new.js', {});
  const trial = { amount: 0.02, cardAmount: 0.01, careAmount: 0.01, careOrderId: 20,
    items: [{ productId: 101, name: '测试次卡', price: 0.01, total: 3, careIds: [30] }],
    projects: [{ careId: 30, need_edge: 1, repair_charge: 0.01, amount: 0.01 }] };
  page.setData({ bizType: 'maintain', order: order(), careCardSelections: [{ productId: 101, quantity: 1 }], careCardPreview: trial });
  page.saveCareReceptOrder = async () => page.data.order;
  const actions = [];
  page._cardApi = async action => { actions.push(action); return action === 'SaveDraft' ? trial : { orderId: 20, careOrderId: 20 }; };
  await page._checkoutCareCards();
  assert.deepEqual(actions, ['SaveDraft', 'Submit']);
  assert.deepEqual(navigations, ['/pages/payment/settle/index?orderId=20&careOrderId=20']);
  assert.equal(page.data.order.id, 0);
});

test('同一养护订单的结算卡片同时展示卡款、养护费用和本单装备', async t => {
  setup(t);
  const component = loadComponent('components/order-summary-card/index.js', {
    getOrderByStaffPromise: async id => { assert.equal(id, 20); return order(); }
  }, { orderId: 20 });
  component.loadOrder(); await settle();
  assert.equal(component.data.isCare, true);
  assert.equal(component.data.cardNames, '测试次卡');
  assert.equal(component.data.cardAmountStr, '¥0.01');
  assert.equal(component.data.careAmountStr, '¥0.01');
  assert.equal(component.data.payingAmountStr, '¥0.02');
  assert.equal(component.data.cares[0].id, 30);
});

test('同一订单收取两分钱，使用付款流程而非零元核销', async t => {
  setup(t);
  const component = loadComponent('components/order-payment/index.js', {
    getOrderByStaffPromise: async () => order()
  }, { orderId: 20 });
  component.loadOrder(); await settle();
  assert.equal(component.data.isCare, true);
  assert.equal(component.data.careWriteoff, false);
  assert.equal(component.data.payingAmountStr, '¥0.02');
  assert.deepEqual(component.events, []);
});

test('养护详情直接展示本单卡销售与合计，含卡订单禁止打开退款', t => {
  const { navigations, toasts } = setup(t);
  const page = loadPage('pages/admin/care/care_order_detail/care_order_detail.js', {});
  const detail = order(); detail.paidAmount = 0.02; detail.dealed = 1;
  page.renderOrder(detail);
  assert.equal(page.data.careCardRows[0].name, '测试次卡');
  assert.equal(page.data.cardAmountStr, '¥0.01');
  assert.equal(page.data.careAmountStr, '¥0.01');
  assert.equal(page.data.orderTotalStr, '¥0.02');
  assert.equal(page.data.payment.canRefund, false);
  page.onOpenRefundPopup();
  assert.deepEqual(toasts, ['含卡订单不允许退款']);
  page.onGoPay();
  assert.equal(navigations[0], '/pages/payment/settle/index?orderId=20&careOrderId=20');
});

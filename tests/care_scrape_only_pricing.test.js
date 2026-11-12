const test = require('node:test');
const assert = require('node:assert/strict');
const { loadComponent, settle } = require('./reception_harness');

// 万龙服务中心「只选了刮蜡」一口价：老会员 80、其他 100（2026-10-30）。
// 前端没有任何定价逻辑，开单页显示的价格只来自服务端 Care/CalcCareCharge 的返回：
// 服务端规则变了，这里要锁死的是「请求带着会员和店铺、重新计价、显示的就是服务端给的数」。
const OLD_MEMBER = 10, NEW_MEMBER = 11;

function care(patch = {}) {
  return { id: 1, equipment: '双板', brand: '测试', scale: '170', need_edge: 0, need_wax: 0,
    need_unwax: 1, free_wax: 0, edge_degree: null, common_charge: 0, repair_charge: 0, discount: 0, ...patch };
}
// 服务端的价格表（模拟）：单刮蜡看会员，其余按原有规则
function serverPrice(req) {
  const c = { ...req.care };
  if (req.changedField === 'need_wax') c.need_unwax = c.need_wax;
  const scrapeOnly = c.need_unwax === 1 && !c.need_edge && !c.need_wax && !c.free_wax;
  if (req.shop !== '万龙服务中心') c.common_charge = 0;
  else if (scrapeOnly) c.common_charge = req.memberId === OLD_MEMBER ? 80 : 100;
  else c.common_charge = c.need_edge && c.need_wax ? 230 : c.need_edge || c.need_wax ? 170 : 0;
  return { care: c };
}
function setup(t, { memberId, shop = '万龙服务中心' } = {}) {
  const oldApp = global.getApp, oldWx = global.wx;
  const requests = [];
  global.getApp = () => ({ globalData: { sessionKey: 'staff' }, loginPromiseNew: Promise.resolve() });
  global.wx = { showToast() {}, showModal: o => o.success({ confirm: true }) };
  t.after(() => { global.getApp = oldApp; global.wx = oldWx; });
  const form = loadComponent('components/reception/care_recept_form/care_recept_form.js', {
    getMemberTicketsPromise: async () => [],
    calcCareChargePromise: async req => { requests.push(JSON.parse(JSON.stringify(req))); return serverPrice(req); }
  });
  Object.assign(form.data, { memberId, shop, cares: [care()] });
  form._refreshCares();
  return { form, requests };
}
const toggle = (form, flag) => form.onSvcToggle({ currentTarget: { dataset: { cidx: 0, flag } } });

test('单独刮蜡：老会员显示 80，请求带着会员和店铺', async t => {
  const { form, requests } = setup(t, { memberId: OLD_MEMBER });
  form._scheduleAllCarePrices(); await form.waitForPrices(); await settle();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].memberId, OLD_MEMBER); assert.equal(requests[0].shop, '万龙服务中心');
  assert.equal(requests[0].care.need_unwax, 1); assert.equal(requests[0].care.need_wax, 0); assert.equal(requests[0].care.need_edge, 0);
  assert.equal(form.data.displayCares[0].common_charge, 80);
  assert.equal(form.data.summary.totalLabel, '80.00');
});

test('单独刮蜡：新会员 100，没有会员（散客）也是 100', async t => {
  const fresh = setup(t, { memberId: NEW_MEMBER });
  fresh.form._scheduleAllCarePrices(); await fresh.form.waitForPrices(); await settle();
  assert.equal(fresh.form.data.summary.totalLabel, '100.00');
  const walkIn = setup(t, { memberId: null });
  walkIn.form._scheduleAllCarePrices(); await walkIn.form.waitForPrices(); await settle();
  assert.equal(walkIn.requests[0].memberId, null);
  assert.equal(walkIn.form.data.summary.totalLabel, '100.00');
});

test('换会员后重新向服务端计价：新会员 100 → 老会员 80', async t => {
  const { form, requests } = setup(t, { memberId: NEW_MEMBER });
  form._scheduleAllCarePrices(); await form.waitForPrices(); await settle();
  assert.equal(form.data.summary.totalLabel, '100.00');
  // 测试装载器不跑 observers：换会员时组件的 'shop, memberId' 观察者做的就是 _scheduleAllCarePrices
  form.data.memberId = OLD_MEMBER; form._scheduleAllCarePrices(); await form.waitForPrices(); await settle();
  assert.equal(requests.at(-1).memberId, OLD_MEMBER);
  assert.equal(form.data.summary.totalLabel, '80.00');
});

test('刮蜡与别的项目一起选：显示服务端按原有规则给的价，不是 80/100', async t => {
  const { form, requests } = setup(t, { memberId: OLD_MEMBER });
  form._scheduleAllCarePrices(); await form.waitForPrices(); await settle();
  assert.equal(form.data.summary.totalLabel, '80.00');
  toggle(form, 'need_edge'); await form.waitForPrices(); await settle();   // 修刃 + 刮蜡 = 单项
  assert.equal(requests.at(-1).changedField, 'need_edge');
  assert.equal(form.data.displayCares[0].need_unwax, 1);
  assert.equal(form.data.summary.totalLabel, '170.00');
  toggle(form, 'need_edge'); await form.waitForPrices(); await settle();   // 点掉修刃，回到单刮蜡
  assert.equal(form.data.summary.totalLabel, '80.00');
});

test('非万龙服务中心的单刮蜡：显示服务端给的原有价格', async t => {
  const { form, requests } = setup(t, { memberId: OLD_MEMBER, shop: '南山' });
  form._scheduleAllCarePrices(); await form.waitForPrices(); await settle();
  assert.equal(requests[0].shop, '南山');
  assert.equal(form.data.summary.totalLabel, '0.00');
});

// ---------- 只选刮蜡：不选任何券、卡（2026-10-30） ----------
// 单刮蜡是一口价，券和卡都不参与：开单页不自动带老顾客券，服务端发现已选的券/卡/学员卡会清掉并告知前端。
function ticket16(code = 'OLD') {
  return { code, template_id: 16, name: '老顾客优惠券', member_id: OLD_MEMBER, expire_date: '2026-12-01' };
}
function setupWithTickets(t, { rows, calculate, tickets = [ticket16()] }) {
  const oldApp = global.getApp, oldWx = global.wx;
  const toasts = [], requests = [];
  global.getApp = () => ({ globalData: { sessionKey: 'staff' }, loginPromiseNew: Promise.resolve() });
  global.wx = { showToast: o => toasts.push(o.title), showModal: o => o.success({ confirm: true }) };
  t.after(() => { global.getApp = oldApp; global.wx = oldWx; });
  const form = loadComponent('components/reception/care_recept_form/care_recept_form.js', {
    getMemberTicketsPromise: async () => tickets,
    calcCareChargePromise: async req => { requests.push(JSON.parse(JSON.stringify(req))); return calculate ? calculate(req) : serverPrice(req); }
  });
  Object.assign(form.data, { memberId: OLD_MEMBER, shop: '万龙服务中心', cares: rows });
  return { form, requests, toasts };
}

test('单刮蜡的装备不自动带老顾客券；非单刮蜡的照旧自动带', async t => {
  const { form } = setupWithTickets(t, { rows: [care({ id: 1 }), care({ id: 2, need_unwax: 0, need_edge: 1 })] });
  form._refreshCares(); await settle(); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].ticket_code || null, null);
  assert.equal(form.data.displayCares[1].ticket_code, 'OLD');
});

test('万龙体验中心的单刮蜡同样不自动带券，别的店不受这条限制', async t => {
  const experience = setupWithTickets(t, { rows: [care()] });
  experience.form.data.shop = '万龙体验中心';
  experience.form._refreshCares(); await settle();
  assert.equal(experience.form.data.displayCares[0].ticket_code || null, null);
  const nanshan = setupWithTickets(t, { rows: [care()] });
  nanshan.form.data.shop = '南山';
  nanshan.form._refreshCares(); await settle();
  assert.equal(nanshan.form.data.displayCares[0].ticket_code, 'OLD');
});

test('服务端清掉了券、卡、学员卡和减免：本地同步清除并提示，之后也不会被自动带回', async t => {
  const rows = [care({ ticket_code: 'OLD', ticket: ticket16(), use_card: true, card_id: 5, card_name: '次卡',
    coach_card_id: 9, discount: 20, _manualDiscount: 20 })];
  const { form, requests, toasts } = setupWithTickets(t, { rows, calculate: async req => ({
    commonCharge: 80, ticketDiscount: 0, benefitsCleared: true,
    care: { ...req.care, ticket_code: null, use_card: false, card_id: null, card_name: null, coach_card_id: null, discount: 0, common_charge: 80 } }) });
  form._refreshCares();
  form._fetchPrice(0); await form.waitForPrices(); await settle();
  const c = form.data.displayCares[0];
  assert.equal(c.ticket_code, null); assert.equal(c.ticket, null);
  assert.equal(c.use_card, false); assert.equal(c.card_id, null); assert.equal(c.card_name, null);
  assert.equal(c.coach_card_id, null); assert.equal(c.discount, 0);
  assert.equal(c.common_charge, 80); assert.equal(form.data.summary.totalLabel, '80.00');
  assert.equal(toasts.filter(x => /刮蜡/.test(x)).length, 1);
  assert.equal(form.events.at(-1).detail.cares[0].ticket_code, null);   // 同步给草稿的也是清掉之后的
  const before = requests.length;
  form._scheduleOldCustomerTicket(); await settle();
  assert.equal(form.data.displayCares[0].ticket_code || null, null);
  assert.equal(requests.length, before);
});

test('没被服务端清掉东西时不提示、也不动本地的券卡', async t => {
  const rows = [care({ need_unwax: 0, need_edge: 1, ticket_code: 'OLD', ticket: ticket16() })];
  const { form, toasts } = setupWithTickets(t, { rows });
  form._refreshCares(); form._fetchPrice(0); await form.waitForPrices(); await settle();
  assert.equal(form.data.displayCares[0].ticket_code, 'OLD');
  assert.equal(toasts.length, 0);
});

test('在单刮蜡基础上再勾别的项目：自动带上老顾客券', async t => {
  const { form } = setupWithTickets(t, { rows: [care()] });
  form._refreshCares(); await settle(); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].ticket_code || null, null);
  toggle(form, 'need_edge'); await form.waitForPrices(); await settle(); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].ticket_code, 'OLD');
});

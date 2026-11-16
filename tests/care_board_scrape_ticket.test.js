const test = require('node:test');
const assert = require('node:assert/strict');
const { loadComponent, settle, tap } = require('./reception_harness');

// 开板刮蜡券（模板 20，封板取板后发的）：在万龙服务中心「只选刮蜡」时整笔抵掉一口价，抵完 0 元。
// 前端没有任何定价 / 券规则，只照服务端 Care/CalcCareCharge 的返回同步：
//   · 服务端留下这张券（响应 care.ticket_code 还在）→ 本地的券也留着，其余券卡照旧被摘；
//   · 服务端摘了这张券（boardTicketRemoved）→ 本地同步摘掉并提示。
// 下面的假服务端按同一规则回答，锁的是前端的同步行为。
const MEMBER = 10;
const WANLONG = '万龙服务中心';

function care(patch = {}) {
  return { id: 1, equipment: '双板', brand: '测试', scale: '170', need_edge: 0, need_wax: 0, need_unwax: 1,
    free_wax: 0, seal_board: 0, edge_degree: null, common_charge: 0, repair_charge: 0, discount: 0, ...patch };
}
function board(code = 'BOARD') {
  return { code, template_id: 20, name: '开板刮蜡券', member_id: MEMBER, expire_date: '2100-01-01' };
}
function old16() {
  return { code: 'OLD', template_id: 16, name: '老顾客优惠券', member_id: MEMBER, expire_date: '2026-12-01' };
}

function server(req) {
  const c = { ...req.care };
  if (req.deriveServices) {
    // 换券：先清服务项再按券推导；开板刮蜡券 = 只刮蜡
    c.need_edge = c.need_wax = c.need_unwax = c.free_wax = c.seal_board = 0;
    if (c.ticket_code === 'BOARD') c.need_unwax = 1;
  }
  if (req.changedField === 'need_wax') c.need_unwax = c.need_wax;
  const scrapeOnly = c.need_unwax === 1 && !c.need_edge && !c.need_wax && !c.free_wax;
  const applies = req.shop === WANLONG && scrapeOnly;
  let benefitsCleared = false, boardTicketRemoved = false;
  if (c.ticket_code === 'BOARD' && !applies) { c.ticket_code = null; boardTicketRemoved = true; }
  let ticketDiscount = 0;
  if (applies) {
    if (c.use_card || c.card_id || (c.ticket_code && c.ticket_code !== 'BOARD')) {
      c.use_card = false; c.card_id = null; c.card_name = null; c.discount = 0; benefitsCleared = true;
      if (c.ticket_code !== 'BOARD') c.ticket_code = null;
    }
    c.common_charge = 100;
    if (c.ticket_code === 'BOARD') { ticketDiscount = 100; c.discount = 100; }
  } else {
    c.common_charge = req.shop !== WANLONG ? 0 : c.need_edge && c.need_wax ? 230 : c.need_edge || c.need_wax ? 170 : 0;
    if (boardTicketRemoved) c.discount = 0;
  }
  return { commonCharge: c.common_charge, ticketDiscount, care: c, benefitsCleared, boardTicketRemoved };
}

function setup(t, { rows, shop = WANLONG, tickets = [old16()] } = {}) {
  const oldApp = global.getApp, oldWx = global.wx;
  const toasts = [], requests = [];
  global.getApp = () => ({ globalData: { sessionKey: 'staff' }, loginPromiseNew: Promise.resolve() });
  global.wx = { showToast: o => toasts.push(o.title), showModal: o => o.success({ confirm: true }) };
  t.after(() => { global.getApp = oldApp; global.wx = oldWx; });
  const form = loadComponent('components/reception/care_recept_form/care_recept_form.js', {
    getMemberTicketsPromise: async () => tickets,
    getMemberCardsPromise: async () => [],
    getMemberAssetsByStaffPromise: async () => ({ depositTotal: 0 }),
    calcCareChargePromise: async req => { requests.push(JSON.parse(JSON.stringify(req))); return server(req); },
  });
  Object.assign(form.data, { memberId: MEMBER, shop, newCardMode: '', cares: rows });
  form._refreshCares();
  return { form, requests, toasts, c: () => form.data.displayCares[0] };
}

test('已选热蜡时手选开板刮蜡券保留项目，不适用的券由服务端摘除', async t => {
  const { form, requests, toasts, c } = setup(t, { rows: [care({ need_wax: 1, need_unwax: 1 })] });
  await settle(); requests.length = 0;
  await form._applyTicketSelection(0, board(), null); await form.waitForPrices(); await settle();
  assert.equal(requests.at(-1).deriveServices, false);
  assert.equal(requests.at(-1).care.ticket_code, 'BOARD');
  assert.equal(c().ticket_code, null); assert.equal(c().ticket, null);
  assert.equal(c().need_unwax, 1); assert.equal(c().need_wax, 1); assert.equal(c().need_edge, 0);
  assert.equal(c().common_charge, 170); assert.equal(c().discount, 0);
  assert.equal(form.data.summary.totalLabel, '170.00');
  assert.deepEqual(toasts, ['开板刮蜡券仅限万龙单独刮蜡，已取消']);
});

test('单刮蜡 + 开板刮蜡券 + 会员卡：服务端只摘了卡，本地券留着，提示不再说「取消券」', async t => {
  const { form, toasts, c } = setup(t, { rows: [care({ ticket_code: 'BOARD', ticket: board(), use_card: true, card_id: 5, card_name: '次卡' })] });
  form._fetchPrice(0); await form.waitForPrices(); await settle();
  assert.equal(c().use_card, false); assert.equal(c().card_id, null); assert.equal(c().card_name, null);
  assert.equal(c().ticket_code, 'BOARD'); assert.equal(c().ticket.template_id, 20);
  assert.equal(c().discount, 100);
  assert.equal(form.data.summary.totalLabel, '0.00');
  assert.deepEqual(toasts, ['只选刮蜡按一口价，已取消卡和其它优惠']);
  assert.equal(form.events.at(-1).detail.cares[0].ticket_code, 'BOARD');   // 同步给草稿的也还带着券
});

test('别的券（老顾客券 16）在单刮蜡一口价下照旧被整张摘掉，提示不变', async t => {
  const { form, toasts, c } = setup(t, { rows: [care({ ticket_code: 'OLD', ticket: old16() })] });
  form._fetchPrice(0); await form.waitForPrices(); await settle();
  assert.equal(c().ticket_code, null); assert.equal(c().ticket, null);
  assert.equal(c().common_charge, 100); assert.equal(c().discount, 0);
  assert.deepEqual(toasts, ['只选刮蜡按一口价，已取消券和卡']);
});

test('选了开板刮蜡券后再点热蜡：不再是单刮蜡，服务端摘券，本地同步摘掉并提示一次，老顾客券不会趁机顶上来', async t => {
  const { form, requests, toasts, c } = setup(t, { rows: [care()] });
  await settle();
  await form._applyTicketSelection(0, board(), null); await form.waitForPrices(); await settle();   // 店员手选，登记为手动选择
  assert.equal(c().ticket_code, 'BOARD');
  toasts.length = 0; requests.length = 0;
  form.onSvcToggle(tap({ cidx: 0, flag: 'need_wax' })); await form.waitForPrices(); await settle();
  assert.equal(requests[0].changedField, 'need_wax');
  assert.equal(c().need_wax, 1);
  assert.equal(c().ticket_code, null); assert.equal(c().ticket, null);
  assert.equal(c().discount, 0); assert.equal(c().common_charge, 170);
  assert.equal(form.data.summary.totalLabel, '170.00');
  assert.deepEqual(toasts, ['开板刮蜡券仅限万龙单独刮蜡，已取消']);
  assert.ok(requests.length >= 1);   // 变化后可重新试算账户内权益
  assert.equal(form.events.at(-1).detail.cares[0].ticket_code, null);
});

test('别的门店选开板刮蜡券：那里单刮蜡本来免费，券被摘掉并提示', async t => {
  const { form, toasts, c } = setup(t, { shop: '南山', tickets: [], rows: [care()] });
  await settle();
  await form._applyTicketSelection(0, board(), null); await form.waitForPrices(); await settle();
  assert.equal(c().ticket_code, null); assert.equal(c().ticket, null);
  assert.equal(c().common_charge, 0);
  assert.deepEqual(toasts, ['开板刮蜡券仅限万龙单独刮蜡，已取消']);
});

test('已选开板刮蜡券的单刮蜡装备：老顾客券不会把它顶掉', async t => {
  const { form, requests, c } = setup(t, { rows: [care({ ticket_code: 'BOARD', ticket: board(), common_charge: 100, discount: 100 })] });
  await settle(); requests.length = 0;
  await form._scheduleOldCustomerTicket(); await settle();
  assert.equal(c().ticket_code, 'BOARD');
  assert.equal(requests.length, 0);
});

test('没出事就不提示：单刮蜡 + 开板刮蜡券重新计价，券和价格都不变', async t => {
  const { form, toasts, c } = setup(t, { rows: [care({ ticket_code: 'BOARD', ticket: board() })] });
  form._fetchPrice(0); await form.waitForPrices(); await settle();
  form._fetchPrice(0); await form.waitForPrices(); await settle();
  assert.equal(c().ticket_code, 'BOARD'); assert.equal(c().discount, 100);
  assert.deepEqual(toasts, []);
});

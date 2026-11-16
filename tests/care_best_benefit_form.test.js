const test = require('node:test');
const assert = require('node:assert/strict');
const { loadComponent, settle, tap } = require('./reception_harness');

function setup(t, options = {}) {
  const oldApp = global.getApp, oldWx = global.wx;
  global.getApp = () => ({ globalData: { sessionKey: 's' }, loginPromiseNew: Promise.resolve() });
  global.wx = { showToast() {} };
  t.after(() => { global.getApp = oldApp; global.wx = oldWx; });
  const tickets = options.tickets || [], cards = options.cards || [];
  const calls = [];
  const form = loadComponent('components/reception/care_recept_form/care_recept_form.js', {
    getMemberTicketsPromise: options.getTickets || (async () => tickets),
    getMemberCardsPromise: options.getCards || (async () => cards),
    listUsableCoachCardsPromise: async () => ({ cards: options.coaches || [] }),
    calcCareChargePromise: async req => {
      calls.push(req);
      if (options.calculate) return options.calculate(req);
      const c = { ...req.care };
      const full = c.need_edge && c.need_wax ? 230 : c.need_edge || c.need_wax ? 170 : 0;
      c.common_charge = full;
      if (c.card_id === 1) c.common_charge = c.need_wax ? 0 : 160;
      if (c.card_id === 2) c.common_charge = 0;
      if (c.ticket_code === 'SAVE') c.discount = Math.max(c.discount || 0, 30);
      if (c.ticket_code === 'FREE') c.common_charge = c.free_wax ? 0 : full - 20;
      if (c.coach_card_id === 3) c.discount = Math.max(c.discount || 0, 60);
      return { care: c, coach: c.coach_card_id ? { cardId: 3, discount: 60 } : null };
    },
  });
  Object.assign(form.data, { memberId: 10, shop: '测试店', cares: options.cares || [{
    id: 1, equipment: '双板', brand: 'A', scale: '170', need_edge: 0, need_wax: 0,
    need_unwax: 0, free_wax: 0, discount: 0, repair_charge: 0,
  }] });
  form._refreshCares();
  form._loadMachineWaxAvailability(10);
  return { form, calls };
}

const ticket = (code, template = 16, expire = '2027-01-01') => ({ code, template_id: template, member_id: 10, expire_date: expire });
const card = (id, name, total = 10) => ({ id, member_id: 10, biz_type: '养护', card_name: name,
  total, punches: 0, remaining: total, isSeason: total === null, usedToday: false });

test('未选服务不自动带权益，选项目后比较实际应付并随项目变化重新选择', async t => {
  const { form } = setup(t, { tickets: [ticket('SAVE')], cards: [card(1, '打蜡季卡', null)] });
  await settle(); assert.equal(form.data.displayCares[0].use_card, undefined);
  form.onSvcToggle(tap({ cidx: 0, flag: 'need_edge' }));
  await settle(); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].ticket_code, 'SAVE');
  assert.equal(form.data.displayCares[0].need_edge, 1);
  form.onSvcToggle(tap({ cidx: 0, flag: 'need_wax' }));
  await settle(); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].card_id, 1);
  assert.equal(form.data.displayCares[0].need_edge, 1);
  assert.equal(form.data.displayCares[0].need_wax, 1);
});

test('先等待服务端项目联动完成，再按最终项目试算所有券卡', async t => {
  let release;
  const gate = new Promise(r => { release = r; });
  const { form, calls } = setup(t, { tickets: [ticket('FREE', 12)], cares: [
    { id: 1, equipment: '双板', brand: 'A', scale: '170', need_wax: 1, need_unwax: 1, free_wax: 0, discount: 0 },
  ], calculate: async req => {
    const c = { ...req.care };
    if (req.changedField === 'free_wax') { await gate; c.need_wax = c.need_unwax = 0; }
    c.common_charge = c.free_wax ? 0 : 170;
    return { care: c };
  } });
  await settle(); await form.waitForPrices(); calls.length = 0;
  form.onSvcToggle(tap({ cidx: 0, flag: 'free_wax' }));
  await settle();
  assert.equal(calls.filter(r => !r.changedField).length, 0);
  release(); await form.waitForPrices();
  assert.ok(calls.some(r => !r.changedField && r.care.free_wax === 1 && r.care.need_wax === 0));
  assert.equal(form.data.displayCares[0].ticket_code, 'FREE');
  assert.equal(form.data.displayCares[0].need_wax, 0);
});

test('店员手选券卡或不使用时保留已经选好的养护项目', async t => {
  const { form } = setup(t, { cares: [
    { id: 1, equipment: '双板', brand: 'A', scale: '170', need_edge: 1, need_wax: 1, need_unwax: 1,
      edge_degree: '89', discount: 0 },
  ] });
  await settle();
  await form._applyTicketSelection(0, ticket('SAVE'), null);
  let c = form.data.displayCares[0];
  assert.deepEqual([c.need_edge, c.need_wax, c.need_unwax], [1, 1, 1]);
  await form._applyTicketSelection(0, null, null);
  c = form.data.displayCares[0];
  assert.deepEqual([c.need_edge, c.need_wax, c.need_unwax], [1, 1, 1]);
});

test('学员卡参加真实比价；没有优惠的券不会自动核销', async t => {
  const { form } = setup(t, { tickets: [ticket('OTHER')], coaches: [{ cardId: 3, coachName: '教练' }],
    cares: [{ id: 1, equipment: '双板', brand: 'A', scale: '170', need_edge: 1, discount: 0 }] });
  await settle(); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].coach_card_id, 3);
  assert.equal(form.data.displayCares[0].ticket_code, null);
});

test('多件装备共享一张季卡和一张券时按整单最省分配', async t => {
  const { form } = setup(t, { tickets: [ticket('SAVE')], cards: [card(1, '打蜡季卡', null)], cares: [
    { id: 1, equipment: '双板', brand: 'A', scale: '170', need_edge: 1, discount: 0 },
    { id: 2, equipment: '单板', brand: 'B', scale: '150', need_wax: 1, discount: 0 },
  ] });
  await settle(); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].ticket_code, 'SAVE');
  assert.equal(form.data.displayCares[1].card_id, 1);
});

test('去掉已选服务后移除自动权益；点击结算等待比价并同步结果', async t => {
  const { form } = setup(t, { tickets: [ticket('SAVE')], cares: [
    { id: 1, equipment: '双板', brand: 'A', scale: '170', need_edge: 1, need_repair: 1,
      repair_memo: '维修', repair_charge: 20, discount: 0 },
  ] });
  await form.onCheckout();
  assert.equal(form.events.filter(e => e.name === 'checkout').at(-1).detail.cares[0].ticket_code, 'SAVE');
  form.onSvcToggle(tap({ cidx: 0, flag: 'need_edge' }));
  await settle(); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].ticket_code, null);
  assert.equal(form.data.displayCares[0].repair_charge, 20);
});

test('比价失败不能按未经比较的结果结算', async t => {
  const { form } = setup(t, { tickets: [ticket('SAVE')], cares: [
    { id: 1, equipment: '双板', brand: 'A', scale: '170', need_edge: 1, discount: 0 },
  ], calculate: req => {
    if (req.care.ticket_code) throw new Error('quote failed');
    return { care: { ...req.care, common_charge: 170 } };
  } });
  await form.onCheckout();
  assert.equal(form.events.filter(e => e.name === 'checkout').length, 0);
});

test('结算时刷新券卡，券已在别处使用则撤销自动选择', async t => {
  let loads = 0;
  const { form } = setup(t, { getTickets: async () => ++loads === 1 ? [ticket('SAVE')] : [], cares: [
    { id: 1, equipment: '双板', brand: 'A', scale: '170', need_edge: 1, discount: 0 },
  ] });
  await settle(); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].ticket_code, 'SAVE');
  await form.onCheckout();
  assert.equal(form.events.filter(e => e.name === 'checkout').at(-1).detail.cares[0].ticket_code, null);
  assert.ok(loads >= 2);
});

test('手动减免叠加季卡会产生负金额时，不自动选择该季卡', async t => {
  const { form } = setup(t, { cards: [card(1, '打蜡季卡', null)], cares: [
    { id: 1, equipment: '双板', brand: 'A', scale: '170', need_wax: 1, discount: 30 },
  ] });
  await settle(); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].card_id || null, null);
  assert.equal(form.data.displayCares[0].discount, 30);
});

test('顾客持有绑定其他装备的打蜡季卡时仍显示按钮，但不能自动使用不匹配季卡', async t => {
  const bound = { ...card(1, '打蜡季卡', null), equipBound: true, equip_type: '单板', equip_brand: 'B', equip_scale: '150' };
  const { form } = setup(t, { cards: [bound] });
  await settle(); assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, true);
  form.onSvcToggle(tap({ cidx: 0, flag: 'free_wax' }));
  await settle();
  assert.equal(form.data.displayCares[0].card_id || null, null);
  await assert.rejects(form.waitForPrices());
});

test('列表或报价迟到不能覆盖顾客切换或手动选择', async t => {
  let resolveTickets;
  const { form } = setup(t, { getTickets: () => new Promise(r => { resolveTickets = r; }),
    cares: [{ id: 1, equipment: '双板', brand: 'A', scale: '170', need_edge: 1, discount: 0 }] });
  await settle();
  form._applyTicketSelection(0, null, null);
  resolveTickets([ticket('SAVE')]);
  await settle();
  assert.equal(form.data.displayCares[0].ticket_code, null);
});

test('旧草稿券带出的减免不会转移到无券报价', async t => {
  const { form, calls } = setup(t, { cares: [
    { id: 1, equipment: '双板', brand: 'A', scale: '170', need_edge: 1, need_wax: 1,
      ticket_code: 'SAVE', discount: 30 },
  ] });
  form.onSvcToggle(tap({ cidx: 0, flag: 'need_wax' }));
  await settle(); await form.waitForPrices();
  assert.ok(calls.some(r => r.care.ticket_code === 'SAVE' && r.care.need_wax === 1 && r.care.discount === 0));
  assert.equal(form.data.displayCares[0].ticket_code, null);
  assert.equal(form.data.displayCares[0].discount, 0);
});

test('旧草稿中高于券优惠的手动减免仍然保留', async t => {
  const { form } = setup(t, { cares: [
    { id: 1, equipment: '双板', brand: 'A', scale: '170', need_edge: 1, need_wax: 1,
      ticket_code: 'SAVE', discount: 50 },
  ] });
  form.onSvcToggle(tap({ cidx: 0, flag: 'need_wax' }));
  await settle(); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].ticket_code, null);
  assert.equal(form.data.displayCares[0].discount, 50);
});

test('旧券减免查询返回较晚时不覆盖新输入的手动减免', async t => {
  let release;
  const gate = new Promise(r => { release = r; });
  const { form } = setup(t, { cares: [
    { id: 1, equipment: '双板', brand: 'A', scale: '170', need_edge: 1, need_wax: 1,
      ticket_code: 'SAVE', discount: 30 },
  ], calculate: async req => {
    const c = { ...req.care };
    if (c.ticket_code === 'SAVE' && c.need_wax === 1 && c.discount === 0) await gate;
    c.common_charge = 170;
    if (c.ticket_code === 'SAVE') c.discount = Math.max(c.discount || 0, 30);
    return { care: c };
  } });
  form.onSvcToggle(tap({ cidx: 0, flag: 'need_wax' }));
  await settle();
  form.setData({ amountModal: { cidx: 0, field: 'discount', value: '50' } });
  form.onAmountModalConfirm();
  release(); await form.waitForPrices();
  assert.equal(form.data.displayCares[0].discount, 50);
});

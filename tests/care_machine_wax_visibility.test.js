const test = require('node:test');
const assert = require('node:assert/strict');
const { loadComponent, settle } = require('./reception_harness');

function care(patch = {}) {
  return { id: 1, equipment: '双板', brand: '测试', scale: '170', need_edge: 1,
    need_wax: 0, free_wax: 0, ticket_code: null, ...patch };
}

function season(id, patch = {}) {
  return { id, card_name: '机打蜡季卡', biz_type: '养护', total: null, isSeason: true,
    equipBound: true, equip_type: '双板', equip_brand: '测试', equip_scale: '170', usedToday: false, ...patch };
}

function setup(t, fetch = async () => [], patch = {}, fetchCards = async () => []) {
  const previousApp = global.getApp;
  global.getApp = () => ({ globalData: { sessionKey: 'staff' }, loginPromiseNew: Promise.resolve() });
  t.after(() => { global.getApp = previousApp; });
  const requests = [], cardRequests = [];
  const form = loadComponent('components/reception/care_recept_form/care_recept_form.js', {
    getMemberTicketsPromise: (...args) => { requests.push(args); return fetch(...args); },
    getMemberCardsPromise: (...args) => { cardRequests.push(args); return fetchCards(...args); },
    getMemberAssetsByStaffPromise: async () => ({ depositTotal: 0 }),
    getEquipBrandsPromise: async () => [],
    getCareOthersServicePromise: async () => [],
    calcCareChargePromise: async req => ({ care: { ...req.care } }),
  });
  Object.assign(form.data, { memberId: null, shop: '测试店', newCardMode: '', cares: [care()], ...patch });
  form._refreshCares();
  return { form, requests, cardRequests };
}

test('新购机打蜡季卡显示机打蜡，热蜡季卡或草稿旧勾选不能绕过账户权益判断', t => {
  const { form } = setup(t);
  form.data.newCardMode = 'machine'; form._refreshCares();
  assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, true);
  form.data.newCardMode = 'wax'; form._refreshCares();
  assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, false);
  form.data.newCardMode = '';
  form.data.cares = [care({ free_wax: 1 })]; form._refreshCares();
  assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, false);
});

test('普通开单、未选中的季卡和非打蜡次卡季卡不会单独显示机打蜡', t => {
  const { form } = setup(t);
  for (const patch of [{}, { card_name: '机打蜡季卡', use_card: false },
    { use_card: true, card_name: '单项养护10次卡' }, { use_card: true, card_name: '双项养护季卡' }]) {
    form.data.cares = [care(patch)]; form._refreshCares();
    assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, false);
  }
});

test('顾客有可用机打蜡券但未选券时显示按钮，加载与自动选老顾客券共用一次查询', async t => {
  const { form, requests } = setup(t, async () => [{ code: 'WAX', template_id: 12, member_id: 10 }]);
  form.setProperty('memberId', 10);
  form.invokeLifecycle('attached');
  await settle();
  assert.deepEqual(requests, [[10, '养护', true, 'staff']]);
  assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, true);
  assert.equal(form.data.displayCares[0].ticket_code, null);
  assert.equal(form.data.displayCares[0].free_wax, 0);
  assert.equal(form.events.length, 0);
});

test('已选普通会员卡或进入购卡模式时，账户里的机打蜡券仍使按钮显示', async t => {
  for (const patch of [
    { cares: [care({ use_card: true, card_id: 9, card_name: '双项次卡' })] },
    { hasCardSelection: true, newCardMode: 'dual' },
  ]) {
    const { form } = setup(t, async () => [{ code: 'WAX', template_id: 12, member_id: 10 }], patch);
    form.setProperty('memberId', 10); await settle();
    assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, true);
    assert.equal(form.data.displayCares[0].ticket_code, null);
  }
});

test('没有可用机打蜡券时不显示，其他顾客的券和其他模板不算本顾客权益', async t => {
  const { form } = setup(t, async () => [
    { code: 'FOREIGN', template_id: 12, member_id: 99 },
    { code: 'OTHER', template_id: 17, member_id: 10 },
  ]);
  form.setProperty('memberId', 10); await settle();
  assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, false);
});

test('先选顾客后加载已有普通卡的装备，账户里的机打蜡券仍能显示按钮', async t => {
  const { form } = setup(t, async () => [{ code: 'WAX', template_id: 12, member_id: 10 }], { cares: [] });
  form.setProperty('memberId', 10); await settle();
  form.data.cares = [care({ use_card: true, card_id: 9, card_name: '双项次卡' })];
  form._refreshCares(); await settle();
  assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, true);
});

test('切换顾客立即清除旧券可见性，并忽略原顾客的迟到结果', async t => {
  const pending = [];
  const { form } = setup(t, memberId => new Promise(resolve => pending.push({ memberId, resolve })));
  form.setProperty('memberId', 10); await settle();
  form.setProperty('memberId', 11); await settle();
  pending.find(p => p.memberId === 11).resolve([]); await settle();
  pending.find(p => p.memberId === 10).resolve([{ code: 'OLD', template_id: 12, member_id: 10 }]); await settle();
  assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, false);
  form.setProperty('memberId', 12); await settle();
  pending.find(p => p.memberId === 12).resolve([{ code: 'NEW', template_id: 12, member_id: 12 }]); await settle();
  assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, true);
  form.setProperty('memberId', 13);
  assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, false);
  await settle(); pending.find(p => p.memberId === 13).resolve([]); await settle();
  form.setProperty('memberId', null);
  assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, false);
});

test('组件退出后，迟到的券列表不会回写界面', async t => {
  let ready;
  const { form } = setup(t, () => new Promise(resolve => { ready = resolve; }));
  form.setProperty('memberId', 10); await settle();
  form.invokeLifecycle('detached');
  let writes = 0;
  form.setData = () => { writes++; };
  ready([{ code: 'WAX', template_id: 12, member_id: 10 }]); await settle();
  assert.equal(writes, 0);
});

test('账户里有机打蜡券时，现有和随后添加的每套装备都显示选项', async t => {
  const { form } = setup(t, async () => [{ code: 'WAX', template_id: 12, member_id: 10 }],
    { cares: [care(), care({ id: 2, equipment: '单板', brand: '其他', scale: '155' })] }, async () => [season(9)]);
  form.setProperty('memberId', 10); await settle();
  form.data.cares.push(care({ id: 3, brand: '新装备', scale: '180' })); form._refreshCares();
  assert.deepEqual(form.data.displayCares.map(c => c._hasFreeWaxTicket), [true, true, true]);
  assert.ok(form.data.displayCares.every(c => c.free_wax === 0 && !c.use_card && !c.ticket_code));
});

test('账户里有未绑定机打蜡季卡时，现有和随后添加的每套装备都显示选项', async t => {
  const { form, cardRequests } = setup(t, async () => [], { cares: [care(),
    care({ id: 2, equipment: '单板', brand: '其他', scale: '155' })] }, async () => [season(9), season(8,
    { equipBound: false, equip_type: null, equip_brand: null, equip_scale: null })]);
  form.setProperty('memberId', 10); form.invokeLifecycle('attached'); await settle();
  form.data.cares.push(care({ id: 3, equipment: null, brand: null, scale: null })); form._refreshCares();
  assert.deepEqual(form.data.displayCares.map(c => c._hasFreeWaxTicket), [true, true, true]);
  assert.deepEqual(cardRequests, [[10, '养护', 'staff']]);
  assert.equal(form.events.length, 0);
});

test('只有已绑定机打蜡季卡时，只匹配类型、品牌和长度的装备显示选项', async t => {
  const { form } = setup(t, async () => [], { cares: [care(),
    care({ id: 2, scale: '180', free_wax: 1, use_card: true, card_id: 8, card_name: '机打蜡季卡' }),
    care({ id: 3, brand: '其他' }), care({ id: 4, equipment: '单板' }),
    care({ id: 5, equipment: null, brand: null, scale: null })] }, async () => [season(8)]);
  form.setProperty('memberId', 10); await settle();
  assert.deepEqual(form.data.displayCares.map(c => c._hasFreeWaxTicket), [true, false, false, false, false]);
});

test('新增或修改装备信息后，绑定季卡的显示资格随装备变化重新判断', async t => {
  const { form } = setup(t, async () => [], {}, async () => [season(8)]);
  form.setProperty('memberId', 10); await settle();
  assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, true);
  form.onFieldBlur({ currentTarget: { dataset: { cidx: 0, field: 'scale' } }, detail: { value: '180' } });
  await form.waitForPrices(); assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, false);
  form.onFieldBlur({ currentTarget: { dataset: { cidx: 0, field: 'scale' } }, detail: { value: '170' } });
  await form.waitForPrices(); assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, true);
  form.data.cares.push(care({ id: 2, scale: '180' })); form._refreshCares();
  assert.deepEqual(form.data.displayCares.map(c => c._hasFreeWaxTicket), [true, false]);
});

test('已用、已退、其他顾客、租赁或热蜡季卡，以及部分绑定的异常数据，不开放机打蜡', async t => {
  const { form } = setup(t, async () => [], {}, async () => [season(1, { usedToday: true }),
    season(2, { is_refund: true }), season(3, { member_id: 99 }), season(4, { biz_type: '租赁' }),
    season(5, { card_name: '热蜡季卡' }), season(6, { equipBound: false, equip_brand: null, equip_scale: null })]);
  form.setProperty('memberId', 10); await settle();
  assert.equal(form.data.displayCares[0]._hasFreeWaxTicket, false);
});

test('切换顾客立即清除旧季卡资格，旧顾客的迟到卡列表不能扩散到新顾客装备', async t => {
  const pending = [];
  const { form } = setup(t, async () => [], { cares: [care(), care({ id: 2, scale: '180' })] },
    memberId => new Promise(resolve => pending.push({ memberId, resolve })));
  form.setProperty('memberId', 10); await settle();
  form.setProperty('memberId', 11); await settle();
  assert.deepEqual(pending.map(p => p.memberId), [10, 11]);
  pending.find(p => p.memberId === 11).resolve([season(8)]); await settle();
  assert.deepEqual(form.data.displayCares.map(c => c._hasFreeWaxTicket), [true, false]);
  pending.find(p => p.memberId === 10).resolve([season(9,
    { equipBound: false, equip_type: null, equip_brand: null, equip_scale: null })]); await settle();
  assert.deepEqual(form.data.displayCares.map(c => c._hasFreeWaxTicket), [true, false]);
  form.setProperty('memberId', null);
  assert.deepEqual(form.data.displayCares.map(c => c._hasFreeWaxTicket), [false, false]);
});

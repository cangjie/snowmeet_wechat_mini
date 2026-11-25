// 养护开单「封板」（2026-11-09）：热蜡后「刮蜡 / 封板」二选一（默认刮蜡），封板只是 care.seal_board 标志，
// 取板后由服务端发「开板刮蜡券」。服务端 ApplyServiceLinkage / CareSealRules 是联动的真理之源，
// 这里的假服务端按同一规则收敛，验证小程序：按钮单选行为、请求参数、回填、展示文案。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadComponent, loadPage, settle, tap } = require('./reception_harness');
const PHOTO = [{ id: 0, care_id: 0, image_id: 9, status: 'success', url: 'https://img.test/a.jpg', thumb: 'https://img.test/a_t.jpg' }] // 装备照片必填：每件装备都带一张已传好的照片

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function care(id = 1, patch = {}) {
  return { id, equipment: '双板', brand: '测试', scale: '170', careImages: PHOTO, need_edge: 0, edge_degree: null,
    need_wax: 0, need_unwax: 0, seal_board: 0, free_wax: 0, summer: null, use_card: false, card_id: null,
    ticket_code: null, common_charge: 0, repair_charge: 0, discount: 0, ...patch };
}

// 与服务端 CareController.ApplyServiceLinkage + CareSealRules.Normalize 同一套规则
function serverLinkage(req) {
  const c = { ...req.care };
  const canSeal = x => x.need_wax === 1 && x.free_wax !== 1 && !x.summer;
  switch (req.changedField) {
    case 'need_wax':
      c.need_unwax = c.need_wax; c.seal_board = 0;
      if (c.need_wax === 1) c.free_wax = 0;
      break;
    case 'need_unwax':
      c.seal_board = c.need_wax === 1 && c.need_unwax !== 1 ? 1 : 0;
      break;
    case 'seal_board':
      if (c.seal_board === 1) { if (canSeal(c)) c.need_unwax = 0; else c.seal_board = 0; }
      else if (c.need_wax === 1) c.need_unwax = 1;
      break;
    case 'free_wax':
      if (c.free_wax === 1) c.need_wax = c.need_unwax = 0;
      c.seal_board = 0;
      break;
    case 'summer':
      c.seal_board = 0;
      break;
    default:
  }
  if (!canSeal(c)) c.seal_board = 0;
  else if (c.seal_board === 1) c.need_unwax = 0;
  else { c.seal_board = 0; c.need_unwax = 1; }
  return { care: c };
}

function setup(t, { rows = [care()], calculate = serverLinkage, newCardMode = '', tickets = [] } = {}) {
  const oldApp = global.getApp, oldWx = global.wx;
  global.getApp = () => ({ globalData: { sessionKey: 'staff' }, loginPromiseNew: Promise.resolve() });
  const toasts = [], prices = [];
  global.wx = { showToast: options => toasts.push(options.title) };
  t.after(() => { global.getApp = oldApp; global.wx = oldWx; });
  const form = loadComponent('components/reception/care_recept_form/care_recept_form.js', {
    getMemberTicketsPromise: async () => tickets,
    getMemberCardsPromise: async () => [],
    getMemberAssetsByStaffPromise: async () => ({ depositTotal: 0 }),
    calcCareChargePromise: async req => { prices.push(req); return calculate(req); },
  });
  Object.assign(form.data, { memberId: null, shop: '测试店', newCardMode, cares: rows });
  form._refreshCares(); form.setProperty('memberId', 10);
  return { form, prices, toasts, c: () => form.data.displayCares[0] };
}
const tapFlag = (form, flag, cidx = 0) => form.onSvcToggle(tap({ cidx, flag }));

test('空白装备默认不封板（blankCare.seal_board = 0）', () => {
  assert.match(read('components/reception/care_recept_form/care_recept_form.js'), /need_unwax: 0,\s*\n\s*seal_board: 0,/);
});

test('点热蜡：默认带刮蜡、不封板（封板须手动选）', async t => {
  const { form, c, prices } = setup(t);
  await settle(); prices.length = 0;
  tapFlag(form, 'need_wax'); await form.waitForPrices();
  assert.equal(c().need_wax, 1); assert.equal(c().need_unwax, 1); assert.equal(c().seal_board, 0);
  assert.equal(prices.at(-1).changedField, 'need_wax');
});

test('热蜡下点封板：改成封板、不刮蜡，按 seal_board 向服务端重新计价', async t => {
  const { form, c, prices } = setup(t, { rows: [care(1, { need_wax: 1, need_unwax: 1 })] });
  await settle(); prices.length = 0;
  tapFlag(form, 'seal_board'); await form.waitForPrices();
  assert.equal(c().seal_board, 1); assert.equal(c().need_unwax, 0); assert.equal(c().need_wax, 1);
  assert.equal(prices.length, 1);
  assert.equal(prices.at(-1).changedField, 'seal_board');
  assert.equal(prices.at(-1).care.seal_board, 1); assert.equal(prices.at(-1).care.need_unwax, 0);
  assert.ok(c()._svcChipsView.includes('封板'));
});

test('封板后点刮蜡：切回刮蜡并取消封板', async t => {
  const { form, c, prices } = setup(t, { rows: [care(1, { need_wax: 1, need_unwax: 0, seal_board: 1 })] });
  await settle(); prices.length = 0;
  tapFlag(form, 'need_unwax'); await form.waitForPrices();
  assert.equal(c().need_unwax, 1); assert.equal(c().seal_board, 0);
  assert.equal(prices.at(-1).changedField, 'need_unwax');
  assert.ok(!c()._svcChipsView.includes('封板'));
});

test('刮蜡 / 封板像单选：点已选中的那个不动、不发请求、不取消', async t => {
  const { form, c, prices } = setup(t, { rows: [care(1, { need_wax: 1, need_unwax: 1 })] });
  await settle(); prices.length = 0;
  tapFlag(form, 'need_unwax'); await settle();               // 已是刮蜡
  assert.equal(c().need_unwax, 1); assert.equal(c().seal_board, 0); assert.equal(prices.length, 0);
  tapFlag(form, 'seal_board'); await form.waitForPrices();   // 切到封板
  prices.length = 0;
  tapFlag(form, 'seal_board'); await settle();               // 已是封板
  assert.equal(c().seal_board, 1); assert.equal(c().need_unwax, 0); assert.equal(prices.length, 0);
});

test('刮蜡和封板始终恰好选中其一（热蜡下来回切换）', async t => {
  const { form, c } = setup(t, { rows: [care(1, { need_wax: 1, need_unwax: 1 })] });
  await settle();
  for (const flag of ['seal_board', 'need_unwax', 'seal_board', 'seal_board', 'need_unwax']) {
    tapFlag(form, flag); await form.waitForPrices();
    assert.equal((c().need_unwax === 1 ? 1 : 0) + (c().seal_board === 1 ? 1 : 0), 1, `点 ${flag} 之后`);
  }
});

test('没选热蜡时点封板：提示先选热蜡，不改状态、不计价', async t => {
  const { form, c, prices, toasts } = setup(t, { rows: [care(1, { need_edge: 1, edge_degree: '89' })] });
  await settle(); prices.length = 0;
  tapFlag(form, 'seal_board'); await settle();
  assert.deepEqual(toasts, ['封板需先选热蜡或养板']);
  assert.equal(c().seal_board, 0); assert.equal(prices.length, 0);
});

test('只刮蜡（没有热蜡）不受封板影响，仍是单独刮蜡', async t => {
  const { form, c } = setup(t);
  await settle();
  tapFlag(form, 'need_unwax'); await form.waitForPrices();
  assert.equal(c().need_unwax, 1); assert.equal(c().seal_board, 0); assert.equal(c().need_wax, 0);
});

test('封板后取消热蜡：刮蜡、封板一起清掉', async t => {
  const { form, c } = setup(t, { rows: [care(1, { need_wax: 1, need_unwax: 0, seal_board: 1 })] });
  await settle();
  tapFlag(form, 'need_wax'); await form.waitForPrices();
  assert.equal(c().need_wax, 0); assert.equal(c().need_unwax, 0); assert.equal(c().seal_board, 0);
});

test('封板后改选机打蜡：热蜡、刮蜡、封板都清掉', async t => {
  // 机打蜡需要有一张机打蜡券（模板 12）才能选
  const { form, c } = setup(t, { rows: [care(1, { need_wax: 1, need_unwax: 0, seal_board: 1 })],
    tickets: [{ code: 'WAX', template_id: 12, member_id: 10, expire_date: '2027-01-01' }] });
  await settle();
  tapFlag(form, 'free_wax'); await form.waitForPrices();
  assert.equal(c().free_wax, 1); assert.equal(c().need_wax, 0); assert.equal(c().need_unwax, 0); assert.equal(c().seal_board, 0);
});

test('非雪季养护不能封板（提示固定，不改状态）', async t => {
  const { form, c, prices, toasts } = setup(t, { rows: [care(1, { summer: 'later', need_edge: 1, need_wax: 1, need_unwax: 1 })] });
  await settle(); prices.length = 0;
  tapFlag(form, 'seal_board'); await settle();
  assert.deepEqual(toasts, ['非雪季养护项目固定']);
  assert.equal(c().seal_board, 0); assert.equal(c().need_unwax, 1); assert.equal(prices.length, 0);
});

test('封板后切到非雪季养护：本地先清封板，服务端结果也不封板', async t => {
  const { form, c, prices } = setup(t, { rows: [care(1, { need_wax: 1, need_unwax: 0, seal_board: 1 })] });
  await settle(); prices.length = 0;
  form.onSummerTap(tap({ cidx: 0, mode: 'later' })); await form.waitForPrices();
  assert.equal(prices.at(-1).care.seal_board, 0);
  assert.equal(c().seal_board, 0);
});

test('服务端回填 seal_board：以服务端为准（0 → 1、1 → 0 都跟着变）', async t => {
  let answer = 1;
  const { form, c } = setup(t, {
    rows: [care(1, { need_wax: 1, need_unwax: 1 })],
    calculate: req => ({ care: { ...req.care, seal_board: answer, need_unwax: answer ? 0 : 1 } }),
  });
  await settle();
  tapFlag(form, 'need_unwax'); await settle();      // 触发一次不发请求的无效点击后，改用价格重算入口
  form._fetchPrice(0, { changed: 'seal_board' }); await form.waitForPrices();
  assert.equal(c().seal_board, 1); assert.equal(c().need_unwax, 0);
  answer = 0;
  form._fetchPrice(0, { changed: 'seal_board' }); await form.waitForPrices();
  assert.equal(c().seal_board, 0); assert.equal(c().need_unwax, 1);
});

test('服务端不返回 seal_board（老版本服务端）按 0 处理，不会残留旧值', async t => {
  const { form, c } = setup(t, {
    rows: [care(1, { need_wax: 1, need_unwax: 0, seal_board: 1 })],
    calculate: req => { const r = { ...req.care }; delete r.seal_board; return { care: r }; },
  });
  await settle();
  form._fetchPrice(0, { changed: 'need_wax' }); await form.waitForPrices();
  assert.equal(c().seal_board, 0);
});

test('结算提交的装备带 seal_board，且封板时 need_unwax 为 0', async t => {
  const { form } = setup(t, { rows: [care(1, { need_wax: 1, need_unwax: 1 })] });
  await settle();
  tapFlag(form, 'seal_board'); await form.waitForPrices();
  await form.onCheckout(); await settle();
  const submitted = form.events.filter(e => e.name === 'checkout');
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].detail.cares[0].seal_board, 1);
  assert.equal(submitted[0].detail.cares[0].need_unwax, 0);
  assert.equal(submitted[0].detail.cares[0].need_wax, 1);
});

test('购卡模式（newCardMode）不出现封板：按钮不渲染，点了也无效', async t => {
  const { form, c, prices } = setup(t, { newCardMode: 'single', rows: [care(1, { need_wax: 1, need_unwax: 1 })] });
  await settle(); prices.length = 0;
  tapFlag(form, 'seal_board'); await settle();
  assert.equal(c().seal_board, 0); assert.equal(prices.length, 0);
  assert.match(read('components/reception/care_recept_form/care_recept_form.wxml'),
    /<view wx:if="\{\{!newCardMode\}\}"[^>]*\n[^>]*seal_board/);
});

test('封板按钮：排在刮蜡之后；没选热蜡或非雪季时置灰；选中时高亮', () => {
  const wxml = read('components/reception/care_recept_form/care_recept_form.wxml');
  const unwax = wxml.indexOf('data-flag="need_unwax"');
  const seal = wxml.indexOf('data-flag="seal_board"');
  const freeWax = wxml.indexOf('data-flag="free_wax"');
  assert.ok(unwax > 0 && seal > unwax && seal < freeWax, '封板紧跟在刮蜡后面');
  const chip = wxml.slice(wxml.lastIndexOf('<view', seal), wxml.indexOf('</view>', seal));
  assert.match(chip, /care\.seal_board === 1 \? 'rent-mode-btn--active'/);
  assert.match(chip, /care\.summer != null \|\| \(care\.need_wax !== 1 && care\.maintain_board !== 1\)\) \? 'rent-mode-btn--disabled'/);
  assert.match(chip, />封板\s*$/);
});

test('养护详情、未取板列表、结算页、标签都能看到封板', async t => {
  const detail = read('pages/admin/care/care_order_detail/care_order_detail.js');
  assert.match(detail, /care\.seal_board === 1\) chips\.push\(\{ text: '封板'/);
  assert.match(read('pages/order/payment_entry.js'), /seal_board == 1\) svcs\.push\('封板'\)/);
  assert.match(read('components/care/print_care_label.wxml'), /care\.seal_board == 1\? '封板 '/);
  const label = read('components/care/print_care_label.js');
  assert.match(label, /care\.seal_board == 1 \? "封板（不刮蜡）" : "刮蜡："/);

  // 未取板列表：热蜡 + 封板 → 「热蜡、封板」，不出现单独的「刮蜡」
  const oldApp = global.getApp;
  global.getApp = () => ({ globalData: {}, loginPromiseNew: Promise.resolve() });
  t.after(() => { global.getApp = oldApp; });
  const page = loadPage('pages/admin/care/care_unpicked_list.js', {
    IMAGE_HOST: 'http://img', getUnpickedCareItemsByStaffPromise: async () => ({ items: [], total: 0 }),
  });
  const items = [
    { id: 1, need_wax: 1, need_unwax: 0, seal_board: 1, common_charge: 100 },
    { id: 2, need_wax: 1, need_unwax: 1, seal_board: 0, common_charge: 100 },
  ];
  page.renderItems(items, 2, 1, 50);
  assert.equal(page.data.items[0].svcStr, '热蜡、封板');
  assert.equal(page.data.items[1].svcStr, '热蜡');
});

// 养护开单「养板」（2026-11-10）：排在热蜡之后，与热蜡同一类业务、互斥、互相替换；
// 选了养板就默认带刮蜡，且和热蜡一样「刮蜡 / 封板」必选其一。
// 价格（服务端定）：单选养板 220 / 老顾客券 200，修刃+养板 280 / 老顾客券 250。养板只认老顾客券。
// 服务端 ApplyServiceLinkage / CareSealRules 是联动的真理之源，这里的假服务端按同一规则收敛，
// 验证小程序：按钮互斥与单选行为、请求参数、回填、展示文案、自动带老顾客券。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadComponent, loadPage, settle, tap } = require('./reception_harness');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function care(id = 1, patch = {}) {
  return { id, equipment: '双板', brand: '测试', scale: '170', need_edge: 0, edge_degree: null,
    need_wax: 0, need_unwax: 0, seal_board: 0, maintain_board: 0, free_wax: 0, summer: null, use_card: false, card_id: null,
    ticket_code: null, common_charge: 0, repair_charge: 0, discount: 0, ...patch };
}

// 与服务端 CareController.ApplyServiceLinkage + CareSealRules.Normalize 同一套规则
function serverLinkage(req) {
  const c = { ...req.care };
  const hasWax = x => x.need_wax === 1 || x.maintain_board === 1;
  const canSeal = x => hasWax(x) && x.free_wax !== 1 && !x.summer;
  switch (req.changedField) {
    case 'need_wax':
      if (c.need_wax === 1) { c.maintain_board = 0; c.free_wax = 0; }
      else if (c.maintain_board === 1) break;
      c.need_unwax = c.need_wax; c.seal_board = 0;
      break;
    case 'maintain_board':
      if (c.maintain_board === 1) {
        if (c.summer) { c.maintain_board = 0; c.seal_board = 0; break; }
        c.need_wax = 0; c.free_wax = 0; c.need_unwax = 1; c.seal_board = 0;
      } else { c.need_unwax = 0; c.seal_board = 0; }
      break;
    case 'need_unwax':
      c.seal_board = hasWax(c) && c.need_unwax !== 1 ? 1 : 0;
      break;
    case 'seal_board':
      if (c.seal_board === 1) { if (canSeal(c)) c.need_unwax = 0; else c.seal_board = 0; }
      else if (hasWax(c)) c.need_unwax = 1;
      break;
    case 'free_wax':
      if (c.free_wax === 1) c.need_wax = c.need_unwax = c.maintain_board = 0;
      c.seal_board = 0;
      break;
    case 'summer':
      c.seal_board = 0; c.maintain_board = 0;
      break;
    default:
  }
  if (c.maintain_board === 1 && (c.free_wax === 1 || c.summer)) c.maintain_board = 0;
  if (c.maintain_board === 1) c.need_wax = 0;
  if (!canSeal(c)) c.seal_board = 0;
  else if (c.seal_board === 1) c.need_unwax = 0;
  else { c.seal_board = 0; c.need_unwax = 1; }
  return { care: c };
}

function setup(t, { rows = [care()], calculate = serverLinkage, newCardMode = '', tickets = [], shop = '万龙服务中心' } = {}) {
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
  Object.assign(form.data, { memberId: null, shop, newCardMode, cares: rows });
  form._refreshCares(); form.setProperty('memberId', 10);
  return { form, prices, toasts, c: () => form.data.displayCares[0] };
}
const tapFlag = (form, flag, cidx = 0) => form.onSvcToggle(tap({ cidx, flag }));
const state = c => [c.need_wax, c.need_unwax, c.seal_board, c.maintain_board];

test('空白装备默认不养板（blankCare.maintain_board = 0）', () => {
  assert.match(read('components/reception/care_recept_form/care_recept_form.js'), /seal_board: 0,[^\n]*\n\s*maintain_board: 0,/);
});

// ---------- 按钮互斥与默认 ----------

test('点养板：默认带刮蜡、不封板，向服务端按 maintain_board 重新计价', async t => {
  const { form, c, prices } = setup(t);
  await settle(); prices.length = 0;
  tapFlag(form, 'maintain_board'); await form.waitForPrices();
  assert.deepEqual(state(c()), [0, 1, 0, 1]);
  assert.equal(prices.length, 1);
  assert.equal(prices.at(-1).changedField, 'maintain_board');
  assert.equal(prices.at(-1).care.maintain_board, 1);
});

test('热蜡开着时点养板：热蜡被换掉（互斥、互相替换）', async t => {
  const { form, c } = setup(t, { rows: [care(1, { need_wax: 1, need_unwax: 1 })] });
  await settle();
  tapFlag(form, 'maintain_board'); await form.waitForPrices();
  assert.deepEqual(state(c()), [0, 1, 0, 1]);
});

test('养板开着时点热蜡：养板被换掉，回到热蜡+刮蜡', async t => {
  const { form, c } = setup(t, { rows: [care(1, { maintain_board: 1, need_unwax: 1 })] });
  await settle();
  tapFlag(form, 'need_wax'); await form.waitForPrices();
  assert.deepEqual(state(c()), [1, 1, 0, 0]);
});

test('再点一次养板：取消，刮蜡 / 封板一起清掉', async t => {
  const { form, c } = setup(t, { rows: [care(1, { maintain_board: 1, need_unwax: 1 })] });
  await settle();
  tapFlag(form, 'maintain_board'); await form.waitForPrices();
  assert.deepEqual(state(c()), [0, 0, 0, 0]);
  const sealed = setup(t, { rows: [care(1, { maintain_board: 1, need_unwax: 0, seal_board: 1 })] });
  await settle();
  tapFlag(sealed.form, 'maintain_board'); await sealed.form.waitForPrices();
  assert.deepEqual(state(sealed.c()), [0, 0, 0, 0]);
});

test('养板下刮蜡 / 封板像单选：点另一个就切过去，点已选中的不动、不发请求', async t => {
  const { form, c, prices } = setup(t, { rows: [care(1, { maintain_board: 1, need_unwax: 1 })] });
  await settle(); prices.length = 0;
  tapFlag(form, 'need_unwax'); await settle();                 // 已是刮蜡
  assert.deepEqual(state(c()), [0, 1, 0, 1]); assert.equal(prices.length, 0);
  tapFlag(form, 'seal_board'); await form.waitForPrices();     // 切到封板
  assert.deepEqual(state(c()), [0, 0, 1, 1]);
  assert.equal(prices.at(-1).changedField, 'seal_board');
  prices.length = 0;
  tapFlag(form, 'seal_board'); await settle();                 // 已是封板
  assert.deepEqual(state(c()), [0, 0, 1, 1]); assert.equal(prices.length, 0);
  tapFlag(form, 'need_unwax'); await form.waitForPrices();     // 切回刮蜡
  assert.deepEqual(state(c()), [0, 1, 0, 1]);
  assert.equal(prices.at(-1).changedField, 'need_unwax');
});

test('养板下刮蜡和封板始终恰好选中其一（来回切换）', async t => {
  const { form, c } = setup(t, { rows: [care(1, { maintain_board: 1, need_unwax: 1 })] });
  await settle();
  for (const flag of ['seal_board', 'need_unwax', 'seal_board', 'seal_board', 'need_unwax']) {
    tapFlag(form, flag); await form.waitForPrices();
    assert.equal((c().need_unwax === 1 ? 1 : 0) + (c().seal_board === 1 ? 1 : 0), 1, `点 ${flag} 之后`);
  }
});

test('没选热蜡也没选养板时点封板：提示先选，不改状态、不计价', async t => {
  const { form, c, prices, toasts } = setup(t, { rows: [care(1, { need_edge: 1, edge_degree: '89' })] });
  await settle(); prices.length = 0;
  tapFlag(form, 'seal_board'); await settle();
  assert.deepEqual(toasts, ['封板需先选热蜡或养板']);
  assert.equal(c().seal_board, 0); assert.equal(prices.length, 0);
});

test('养板与修刃可以同选（修刃+养板），互不影响', async t => {
  const { form, c } = setup(t, { rows: [care(1, { need_edge: 1, edge_degree: '89' })] });
  await settle();
  tapFlag(form, 'maintain_board'); await form.waitForPrices();
  assert.equal(c().need_edge, 1); assert.equal(c().maintain_board, 1); assert.equal(c().need_unwax, 1);
});

test('改选机打蜡：养板（连同刮蜡、封板）一起清掉', async t => {
  // 机打蜡需要有一张机打蜡券（模板 12）才能选
  const { form, c } = setup(t, { rows: [care(1, { maintain_board: 1, need_unwax: 0, seal_board: 1 })],
    tickets: [{ code: 'WAX', template_id: 12, member_id: 10, expire_date: '2027-01-01' }] });
  await settle();
  tapFlag(form, 'free_wax'); await form.waitForPrices();
  assert.equal(c().free_wax, 1); assert.deepEqual(state(c()), [0, 0, 0, 0]);
});

test('非雪季养护没有养板：点了提示固定，不改状态、不计价', async t => {
  const { form, c, prices, toasts } = setup(t, { rows: [care(1, { summer: 'later', need_edge: 1, need_wax: 1, need_unwax: 1 })] });
  await settle(); prices.length = 0;
  tapFlag(form, 'maintain_board'); await settle();
  assert.deepEqual(toasts, ['非雪季养护项目固定']);
  assert.equal(c().maintain_board, 0); assert.equal(prices.length, 0);
});

test('养板后切到非雪季养护：本地先清养板，服务端结果也没有养板', async t => {
  const { form, c, prices } = setup(t, { rows: [care(1, { maintain_board: 1, need_unwax: 1 })] });
  await settle(); prices.length = 0;
  form.onSummerTap(tap({ cidx: 0, mode: 'later' })); await form.waitForPrices();
  assert.equal(prices.at(-1).care.maintain_board, 0);
  assert.equal(c().maintain_board, 0); assert.equal(c().seal_board, 0);
});

test('购卡模式（newCardMode）不出现养板：点了无效、不计价', async t => {
  const { form, c, prices } = setup(t, { newCardMode: 'single', rows: [care(1, { need_wax: 1, need_unwax: 1 })] });
  await settle(); prices.length = 0;
  tapFlag(form, 'maintain_board'); await settle();
  assert.equal(c().maintain_board, 0); assert.equal(c().need_wax, 1); assert.equal(prices.length, 0);
});

// ---------- 服务端回填 ----------

test('服务端回填 maintain_board：以服务端为准（0 → 1、1 → 0 都跟着变）', async t => {
  let answer = 1;
  const { form, c } = setup(t, {
    rows: [care(1, { need_wax: 1, need_unwax: 1 })],
    calculate: req => ({ care: { ...req.care, maintain_board: answer, need_wax: answer ? 0 : 1 } }),
  });
  await settle();
  form._fetchPrice(0, { changed: 'maintain_board' }); await form.waitForPrices();
  assert.equal(c().maintain_board, 1); assert.equal(c().need_wax, 0);
  answer = 0;
  form._fetchPrice(0, { changed: 'maintain_board' }); await form.waitForPrices();
  assert.equal(c().maintain_board, 0); assert.equal(c().need_wax, 1);
});

test('服务端不返回 maintain_board（老版本服务端）按 0 处理，不会残留旧值', async t => {
  const { form, c } = setup(t, {
    rows: [care(1, { maintain_board: 1, need_unwax: 1 })],
    calculate: req => { const r = { ...req.care }; delete r.maintain_board; return { care: r }; },
  });
  await settle();
  form._fetchPrice(0, { changed: 'need_wax' }); await form.waitForPrices();
  assert.equal(c().maintain_board, 0);
});

test('服务端摘掉了别的券卡（养板只认老顾客券）：本地同步清除并给出对应提示', async t => {
  const { form, c, toasts } = setup(t, {
    rows: [care(1, { maintain_board: 1, need_unwax: 1, ticket_code: 'WAX12', ticket: { code: 'WAX12', template_id: 12 }, discount: 40 })],
    calculate: req => ({ care: { ...req.care, ticket_code: null, discount: 0 }, benefitsCleared: true, commonCharge: 220 }),
  });
  await settle(); toasts.length = 0;
  form._fetchPrice(0, { changed: 'maintain_board' }); await form.waitForPrices();
  assert.equal(c().ticket_code, null); assert.equal(c().discount, 0);
  assert.deepEqual(toasts, ['养板只能用老顾客券，已取消其它券和卡']);
});

test('养板留着老顾客券：服务端没摘券时本地的券保留', async t => {
  const { form, c } = setup(t, {
    rows: [care(1, { maintain_board: 1, need_unwax: 1, ticket_code: 'OLD16', ticket: { code: 'OLD16', template_id: 16 } })],
    calculate: req => ({ care: { ...req.care, common_charge: 220, discount: 20 }, commonCharge: 220, ticketDiscount: 20 }),
  });
  await settle();
  form._fetchPrice(0, { changed: 'maintain_board' }); await form.waitForPrices();
  assert.equal(c().ticket_code, 'OLD16'); assert.equal(c().common_charge, 220); assert.equal(c().discount, 20);
});

// ---------- 自动带老顾客券：养板不是「只刮蜡」 ----------

test('养板（自带刮蜡）不算只选刮蜡：会自动带上老顾客券，单独的刮蜡则不带', async t => {
  const tickets = [{ code: 'OLD16', template_id: 16, member_id: 10, expire_date: '2027-01-01' }];
  const calculate = req => {
    const result = serverLinkage(req), c = result.care;
    c.common_charge = c.maintain_board ? 220 : 100;
    if (c.ticket_code && c.maintain_board) c.discount = 20;
    else if (c.ticket_code) { c.ticket_code = null; result.benefitsCleared = true; }
    return result;
  };
  const board = setup(t, { rows: [care(1, { maintain_board: 1, need_unwax: 1 })], tickets, calculate });
  await settle();
  assert.equal(board.c().ticket_code, 'OLD16');
  const scrape = setup(t, { rows: [care(1, { need_unwax: 1 })], tickets, calculate });
  await settle();
  assert.equal(scrape.c().ticket_code || null, null);
});

// ---------- 提交与展示 ----------

test('结算提交的装备带 maintain_board，且养板不带热蜡', async t => {
  const { form } = setup(t, { rows: [care(1, { need_wax: 1, need_unwax: 1 })] });
  await settle();
  tapFlag(form, 'maintain_board'); await form.waitForPrices();
  await form.onCheckout(); await settle();
  const submitted = form.events.filter(e => e.name === 'checkout');
  assert.equal(submitted.length, 1);
  const submittedCare = submitted[0].detail.cares[0];
  assert.equal(submittedCare.maintain_board, 1); assert.equal(submittedCare.need_wax, 0); assert.equal(submittedCare.need_unwax, 1);
});

test('已选项目 chips：养板、修刃+养板，养板的刮蜡不再单列；封板照常显示', async t => {
  const one = setup(t, { rows: [care(1, { maintain_board: 1, need_unwax: 1 })] });
  await settle();
  assert.deepEqual(one.c()._svcChipsView.filter(x => ['养板', '修刃+养板', '刮蜡', '热蜡', '封板'].includes(x)), ['养板']);
  const two = setup(t, { rows: [care(1, { maintain_board: 1, need_edge: 1, edge_degree: '89', need_unwax: 0, seal_board: 1 })] });
  await settle();
  assert.deepEqual(two.c()._svcChipsView.filter(x => ['养板', '修刃+养板', '刮蜡', '热蜡', '封板', '修刃'].includes(x)), ['修刃+养板', '封板']);
});

test('只选了养板也算已选项目（不会提示「未选项目」）', async t => {
  const { form } = setup(t, { rows: [care(1, { maintain_board: 1, need_unwax: 1 })] });
  assert.equal(form.evalCare(care(1, { maintain_board: 1, need_unwax: 1 })).ok, true);
});

test('养板按钮：紧跟热蜡之后、排在刮蜡之前；夏季置灰；选中高亮；购卡模式不渲染', () => {
  const wxml = read('components/reception/care_recept_form/care_recept_form.wxml');
  const wax = wxml.indexOf('data-flag="need_wax"');
  const maintain = wxml.indexOf('data-flag="maintain_board"');
  const unwax = wxml.indexOf('data-flag="need_unwax"');
  assert.ok(wax > 0 && maintain > wax && maintain < unwax, '养板紧跟在热蜡后面、刮蜡前面');
  const chip = wxml.slice(wxml.lastIndexOf('<view', maintain), wxml.indexOf('</view>', maintain));
  assert.match(chip, /wx:if="\{\{!newCardMode\}\}"/);
  assert.match(chip, /care\.maintain_board === 1 \? 'rent-mode-btn--active'/);
  assert.match(chip, /care\.summer != null \? 'rent-mode-btn--disabled'/);
  assert.match(chip, />养板\s*$/);
});

test('封板按钮：热蜡或养板都能封，两样都没选 / 非雪季才置灰', () => {
  const wxml = read('components/reception/care_recept_form/care_recept_form.wxml');
  const seal = wxml.indexOf('data-flag="seal_board"');
  const chip = wxml.slice(wxml.lastIndexOf('<view', seal), wxml.indexOf('</view>', seal));
  assert.match(chip, /care\.summer != null \|\| \(care\.need_wax !== 1 && care\.maintain_board !== 1\)\) \? 'rent-mode-btn--disabled'/);
});

test('养护详情、结算页、标签、关联装备摘要、未取板列表都能看到养板', async t => {
  assert.match(read('pages/admin/care/care_order_detail/care_order_detail.js'), /care\.maintain_board === 1\) chips\.push\(\{ text: '养板'/);
  assert.match(read('pages/order/payment_entry.js'), /maintain_board == 1\) svcs\.push\(/);
  assert.match(read('components/care/print_care_label.wxml'), /care\.maintain_board == 1\? '养板 '/);
  assert.match(read('components/care/print_care_label.js'), /care\.maintain_board == 1 \? "养板：" : "热打蜡："/);
  assert.match(read('components/linked-care-summary/index.js'), /care\.maintain_board === 1\) projects\.push\('养板'\)/);

  // 未取板列表：养板 → 「养板」，修刃+养板 → 「修刃+养板」，封板跟在后面；不出现「热蜡」和单独的「刮蜡」
  const oldApp = global.getApp;
  global.getApp = () => ({ globalData: {}, loginPromiseNew: Promise.resolve() });
  t.after(() => { global.getApp = oldApp; });
  const page = loadPage('pages/admin/care/care_unpicked_list.js', {
    IMAGE_HOST: 'http://img', getUnpickedCareItemsByStaffPromise: async () => ({ items: [], total: 0 }),
  });
  const items = [
    { id: 1, maintain_board: 1, need_unwax: 1, common_charge: 220 },
    { id: 2, maintain_board: 1, need_edge: 1, need_unwax: 0, seal_board: 1, common_charge: 280 },
  ];
  page.renderItems(items, 2, 1, 50);
  assert.equal(page.data.items[0].svcStr, '养板');
  assert.equal(page.data.items[1].svcStr, '修刃+养板、封板');
});

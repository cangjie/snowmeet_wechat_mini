const test = require('node:test');
const assert = require('node:assert/strict');
const { loadComponent } = require('./reception_harness');

function receipt(t, { created = '2026-10-25T12:11:00', bizDate = created, pickDate = null, urgent = 0 } = {}) {
  const previousApp = global.getApp;
  global.getApp = () => ({ globalData: {} });
  t.after(() => { global.getApp = previousApp; });
  const care = { id: 25757, equipment: '双板', brand: '测试品牌', scale: '180', need_edge: 1, need_wax: 0,
    free_wax: 0, need_unwax: 0, task_flow_code: 'WF-261025-001', customerName: '测试顾客', customerCell: '',
    create_date: created, member_pick_date: pickDate, urgent };
  const order = { id: 72071, code: 'WF_YH_261025_00006', biz_date: bizDate, paidAmount: 0 };
  const component = loadComponent('components/care/print_care_label.js', {}, { care, order });
  Object.assign(component.data, { order, connectingIndex: 0, availablePrinters: [{ printer: { name: 'GP-3120TUC' } }] });
  return label => new TextDecoder('gb18030').decode(Uint8Array.from(component.getCommand(label)));
}

for (const label of ['【存根】', '【客户联】']) {
  test(label + '：已付款购卡养护无取板日期仍可生成实际打印指令', t => {
    const print = receipt(t);
    const command = print(label);
    assert.match(command, /取板 次日 10-26/);
    assert.match(command, /https:\/\/mini\.snowmeet\.top\/mapp\/admin\/care\/care_order_detail\?orderId=72071&careId=25757/);
    assert.match(command, /PRINT 1,1/);
  });

  test(label + '：立等默认当日，已指定取板日期优先', t => {
    const urgentPrint = receipt(t, { urgent: 1 });
    assert.match(urgentPrint(label), /取板 当日 10-25/);
    const scheduledPrint = receipt(t, { pickDate: '2026-10-30T00:00:00' });
    assert.match(scheduledPrint(label), /取板 多日 10-30/);
  });

  test(label + '：跨月、跨年仍为次日取板，采用订单业务日期', t => {
    const monthEnd = receipt(t, { created: '2026-10-30T18:00:00', bizDate: '2026-10-31T12:00:00' });
    assert.match(monthEnd(label), /取板 次日 11-1/);
    assert.match(monthEnd(label), /订单日期：10-31/);
    const yearEnd = receipt(t, { created: '2026-12-31T18:00:00' });
    assert.match(yearEnd(label), /取板 次日 1-1/);
  });
}

// ---- 含包 / 含杖：存根打两张，标签上写明 ----
function printWith(t, careExtra) {
  const previousApp = global.getApp;
  global.getApp = () => ({ globalData: {} });
  t.after(() => { global.getApp = previousApp; });
  const care = Object.assign({ id: 25757, equipment: '双板', brand: '测试品牌', scale: '180', need_edge: 1, need_wax: 0,
    free_wax: 0, need_unwax: 0, task_flow_code: 'WF-261025-001', customerName: '测试顾客', customerCell: '',
    create_date: '2026-10-25T12:11:00', urgent: 0 }, careExtra);
  const order = { id: 72071, code: 'WF_YH_261025_00006', biz_date: '2026-10-25T12:11:00', paidAmount: 0 };
  const component = loadComponent('components/care/print_care_label.js', {}, { care, order });
  Object.assign(component.data, { order, connectingIndex: 0, availablePrinters: [{ printer: { name: 'GP-3120TUC' } }] });
  const text = label => new TextDecoder('gb18030').decode(Uint8Array.from(component.getCommand(label)));
  return { component, text };
}

test('含包：存根打两张并写「含包」；顾客联一张，也写「含包」', t => {
  const { component, text } = printWith(t, { with_bag: true });
  const stub = text('【存根】');
  assert.equal(component.data.copies, 2);
  assert.match(stub, /TEXT 420,45,"[^"]+",0,2,2,"含包"/);
  assert.doesNotMatch(stub, /含杖/);
  const receiptText = text('【客户联】');
  assert.equal(component.data.copies, 1);
  assert.match(receiptText, /"含包"/);
});

test('含杖：存根打两张并写「含杖」；装备那一行不再带「含杖」尾巴（避免重复、也免得一行写不下）', t => {
  const { component, text } = printWith(t, { with_pole: true });
  const stub = text('【存根】');
  assert.equal(component.data.copies, 2);
  assert.match(stub, /TEXT 420,45,"[^"]+",0,2,2,"含杖"/);
  assert.doesNotMatch(stub, /长度：180\s*含杖/);
  assert.match(stub, /双板：测试品牌 长度：180"/);
});

test('不含包也不含杖（含历史数据 NULL / false）：存根一张，标签上没有这个标注', t => {
  for (const flags of [{}, { with_bag: null, with_pole: null }, { with_bag: false, with_pole: false }]) {
    const { component, text } = printWith(t, flags);
    const stub = text('【存根】');
    assert.equal(component.data.copies, 1, JSON.stringify(flags));
    assert.doesNotMatch(stub, /含包|含杖/);
    assert.doesNotMatch(stub, /TEXT 420,45/);
  }
});

test('数据里万一既含包又含杖（不该发生）：如实都写、字不放大以免出边，存根仍两张', t => {
  const { component, text } = printWith(t, { with_bag: true, with_pole: true });
  const stub = text('【存根】');
  assert.equal(component.data.copies, 2);
  assert.match(stub, /TEXT 420,45,"[^"]+",0,1,1,"含包 含杖"/);
});

test('打印确认提示：含包 / 含杖时写明共 2 张；没有时还是原来的提示', t => {
  const modals = [];
  const previousWx = global.wx;
  global.wx = { showModal: o => modals.push(o.content) };
  t.after(() => { global.wx = previousWx; });
  printWith(t, { with_bag: true }).component.printCommonLabel({});
  printWith(t, { with_pole: true }).component.printCommonLabel({});
  printWith(t, {}).component.printCommonLabel({});
  assert.deepEqual(modals, ['即将打印【标签存根】，共 2 张（含包）', '即将打印【标签存根】，共 2 张（含杖）', '即将打印【标签存根】']);
});

test('打两张是真的发两遍：存根含包时同一份指令通过蓝牙写出两次，不含时只写一次；顾客联永远一次', t => {
  const bytesWritten = (careExtra, printType) => {
    const { component } = printWith(t, careExtra);
    const writes = [];
    const previousWx = global.wx;
    global.wx = { writeBLECharacteristicValue: o => { writes.push(o.value.byteLength); o.success && o.success({}); o.complete && o.complete({}); }, showToast() {} };
    try {
      Object.assign(component.data, { printType, currentDevice: { deviceId: 'd', writeServiceId: 's', writeUUID: 'w' } });
      component.print({});
    } finally { global.wx = previousWx; }
    const single = component.getCommand(printType === '顾客小票' ? '【客户联】' : '【存根】').length;
    return { total: writes.reduce((a, b) => a + b, 0), single };
  };
  const bag = bytesWritten({ with_bag: true }, '标签存根');
  assert.equal(bag.total, bag.single * 2);
  const plain = bytesWritten({}, '标签存根');
  assert.equal(plain.total, plain.single);
  const receiptBag = bytesWritten({ with_bag: true }, '顾客小票');
  assert.equal(receiptBag.total, receiptBag.single);
});

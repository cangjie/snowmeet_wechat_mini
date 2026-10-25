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

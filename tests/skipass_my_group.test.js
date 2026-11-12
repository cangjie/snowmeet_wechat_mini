// 「我的雪票」按 票种 + 日期 + 手机号 合并成一条 × n，每张票各自的状态、二维码和能不能退。
const test = require('node:test')
const assert = require('node:assert/strict')
const g = require('../utils/skipass_my_group.js')

const raw = (id, over) => Object.assign({
  id, product_id: 641, product_name: '【万龙】全雪区日场4小时雪票-11.6', reserve_date: '2026-11-03T00:00:00',
  contact_cell: '13501177897', deal_price: 309, ticket_price: 296.67, status: '已确认', reserve_no: 'N' + id,
  card_no: 'C' + id, qr_code_url: 'https://img/' + id + '.png'
}, over || {})

test('同一订单里票种、日期、手机号相同的合并成一条，张数 n，金额是各张实付之和，按票号排序', () => {
  const groups = g.buildMyGroups([
    raw(12, { order_id: 100 }), raw(11, { order_id: 100 }), raw(13, { order_id: 100, reserve_date: '2026-11-04T00:00:00' }),
    raw(14, { order_id: 100, contact_cell: '13900139000' }), raw(15, { order_id: 100, product_id: 643 })
  ])
  assert.equal(groups.length, 4)
  const first = groups[0]
  assert.deepEqual([first.count, first.amountNum, first.validDate, first.cell], [2, 618, '2026-11-03', '13501177897'])
  assert.deepEqual(first.tickets.map(t => t.id), [11, 12])
  assert.equal(first.statusText, '2 张可使用')
  assert.equal(first.tab, 'unused')
  assert.deepEqual(groups.map(x => x.count), [2, 1, 1, 1])
})

test('不同订单（order_id 不同）的票一定分开，哪怕票种、日期、手机号都一样', () => {
  const groups = g.buildMyGroups([raw(1, { order_id: 100 }), raw(2, { order_id: 200 }), raw(3, { order_id: 100 }), raw(4, { order_id: 200 })])
  assert.equal(groups.length, 2)
  assert.deepEqual(groups.map(x => [x.orderId, x.count, x.tickets.map(t => t.id)]), [[100, 2, [1, 3]], [200, 2, [2, 4]]])
  // 没有订单号的老数据各自归在「无订单」一组，不会和有订单的混在一起
  const mixed = g.buildMyGroups([raw(1, { order_id: 100 }), raw(2, { order_id: null }), raw(3, { order_id: null })])
  assert.deepEqual(mixed.map(x => [x.orderId, x.count]), [[100, 1], [null, 2]])
})

test('一张票的状态：可使用、出票中、已使用、退票中、已退票、取消失败，以及能不能退', () => {
  const t = (over) => g.parseTicket(raw(1, over))
  let x = t()
  assert.deepEqual([x.kind, x.stateText, x.usable, x.canCancel], ['ready', '可使用', true, true])
  x = t({ status: '已付款', reserve_no: null, card_no: null, qr_code_url: null })
  assert.deepEqual([x.kind, x.stateText, x.usable, x.canCancel], ['issuing', '出票中', true, false])
  x = t({ status: '已取卡' })
  assert.deepEqual([x.kind, x.stateText, x.usable, x.canCancel], ['used', '已使用', false, false])
  x = t({ status: '取消中' })
  assert.deepEqual([x.kind, x.stateText, x.usable, x.canCancel], ['cancelling', '退票中', false, false])
  x = t({ status: '已申请退款' })
  assert.deepEqual([x.kind, x.stateText, x.usable, x.canCancel], ['refunded', '已退票', false, false])
  x = t({ status: '退款成功' })
  assert.equal(x.stateText, '已退票')
  x = t({ status: '取消失败' })
  assert.deepEqual([x.kind, x.stateText, x.usable, x.canCancel], ['cancelFailed', '退票未成功', true, true])
  x = t({ status: '出票失败', reserve_no: null })
  assert.deepEqual([x.kind, x.usable, x.canCancel], ['failed', false, false])
})

test('一组里有的用了有的退了：汇总状态，只要还有能用的票就在「未使用」', () => {
  const groups = g.buildMyGroups([raw(1), raw(2, { status: '已取卡' }), raw(3, { status: '已申请退款' }), raw(4, { status: '取消中' })])
  assert.equal(groups[0].statusText, '1 张可使用 · 1 张已使用 · 1 张退票中 · 1 张已退票')
  assert.equal(groups[0].tab, 'unused')
  assert.equal(groups[0].usableCount, 1)
})

test('一组全部退完 → 「已使用」页，印章「已退票」；全部用完 → 「已使用」；混合 → 「已完成」', () => {
  let grp = g.buildMyGroups([raw(1, { status: '已申请退款' }), raw(2, { status: '退款成功' })])[0]
  assert.deepEqual([grp.tab, grp.stampText, grp.statusText], ['used', '已退票', '2 张已退票'])
  grp = g.buildMyGroups([raw(1, { status: '已取卡' }), raw(2, { status: '已取卡' })])[0]
  assert.deepEqual([grp.tab, grp.stampText], ['used', '已使用'])
  grp = g.buildMyGroups([raw(1, { status: '已取卡' }), raw(2, { status: '已申请退款' })])[0]
  assert.deepEqual([grp.tab, grp.stampText], ['used', '已完成'])
})

test('只有一张时：汇总就是这张的状态，显示供应商订单号和状态说明', () => {
  const grp = g.buildMyGroups([raw(1, { status: '取消中' })])[0]
  assert.equal(grp.statusText, '退票中')
  assert.match(grp.statusHint, /几分钟内确认/)
  assert.equal(grp.serial, 'N1')
  const many = g.buildMyGroups([raw(1), raw(2)])[0]
  assert.equal(many.serial, '')
  assert.equal(many.statusHint, '')
})

test('空数据、非数组不报错', () => {
  assert.deepEqual(g.buildMyGroups(null), [])
  assert.deepEqual(g.buildMyGroups([]), [])
})

test('出票失败：确认出不来了，不管有没有退款都显示「出票失败」，不能退票，说明票款自动退回', () => {
  const t = (over) => g.parseTicket(raw(1, over))
  let x = t({ status: '出票失败', is_cancel: -2, reserve_no: null, card_no: null, qr_code_url: null })
  assert.deepEqual([x.kind, x.stateText, x.usable, x.canCancel], ['failed', '出票失败', false, false])
  assert.match(x.stateHint, /票款会自动原路退回/)
  // 退款提交后后台状态变成「已申请退款」，这里仍是出票失败（不是顾客退的票）
  x = t({ status: '已申请退款', is_cancel: -2, have_refund: 1, reserve_no: null, card_no: null, qr_code_url: null })
  assert.deepEqual([x.kind, x.stateText], ['failed', '出票失败'])
  assert.match(x.stateHint, /票款已原路退回/)
  const grp = g.buildMyGroups([raw(1, { status: '已申请退款', is_cancel: -2, have_refund: 1, reserve_no: null }),
    raw(2, { status: '出票失败', is_cancel: -2, reserve_no: null })])[0]
  assert.deepEqual([grp.tab, grp.stampText, grp.statusText], ['used', '出票失败', '2 张出票失败'])
})

test('出票中：不能退票，提示出票期间不能退，超时会自动退回', () => {
  const x = g.parseTicket(raw(1, { status: '已付款', reserve_no: null, card_no: null, qr_code_url: null }))
  assert.deepEqual([x.kind, x.stateText, x.canCancel], ['issuing', '出票中', false])
  assert.match(x.stateHint, /出票期间不能退票/)
  assert.match(x.stateHint, /30 分钟/)
})

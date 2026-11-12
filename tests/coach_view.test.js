// 教练平台展示与表单转换（纯函数）：价格摘要、养护 4 格编辑模型、折扣/一口价输入换算、试算
const test = require('node:test')
const assert = require('node:assert/strict')
const v = require('../pages/coach/common/coach-view.js')

const prices = [
  { shop: '万龙服务中心', tier: '单项', mode: 'rate', value: 0.8 },
  { shop: '万龙服务中心', tier: '双项', mode: 'rate', value: 0.85 },
  { shop: '崇礼旗舰店', tier: '双项', mode: 'fixed', value: 128 }
]

test('单格显示：无 / 折扣 / 一口价', () => {
  assert.equal(v.cellText(null), '无')
  assert.equal(v.cellText({ mode: 'none', value: 0 }), '无')
  assert.equal(v.cellText({ mode: 'rate', value: 0.8 }), '8折')
  assert.equal(v.cellText({ mode: 'rate', value: 0.85 }), '8.5折')
  assert.equal(v.cellText({ mode: 'fixed', value: 68 }), '¥68')
  assert.equal(v.cellText({ mode: 'fixed', value: 68.5 }), '¥68.5')
})

test('列表价格摘要：两家店的单/双项 + 租赁', () => {
  assert.deepEqual(v.priceChips(prices, 0.9), ['万龙 单8折 双8.5折', '崇礼 单无 双¥128', '租赁 9折'])
  assert.deepEqual(v.priceChips([], null), ['万龙 单无 双无', '崇礼 单无 双无', '租赁 不优惠'])
})

test('编辑模型固定 4 格，折扣按「折」填、一口价按元', () => {
  const cells = v.editCells(prices)
  assert.equal(cells.length, 4)
  assert.deepEqual(cells.map(c => c.shop + c.tier), ['万龙服务中心单项', '万龙服务中心双项', '崇礼旗舰店单项', '崇礼旗舰店双项'])
  assert.deepEqual(cells.map(c => [c.mode, c.text]), [['rate', '8'], ['rate', '8.5'], ['none', ''], ['fixed', '128']])
})

test('4 格转接口入参：折扣 8 → 0.8，一口价按元，none 值为 0', () => {
  const cells = v.editCells(prices)
  const r = v.cellsPayload(cells)
  assert.deepEqual(r.care, [
    { shop: '万龙服务中心', tier: '单项', mode: 'rate', value: 0.8 },
    { shop: '万龙服务中心', tier: '双项', mode: 'rate', value: 0.85 },
    { shop: '崇礼旗舰店', tier: '单项', mode: 'none', value: 0 },
    { shop: '崇礼旗舰店', tier: '双项', mode: 'fixed', value: 128 }
  ])
})

test('4 格校验：没填、折扣超范围、一口价为负数', () => {
  const base = () => v.editCells([])
  const set = (i, mode, text) => { const c = base(); c[i].mode = mode; c[i].text = text; return v.cellsPayload(c) }
  assert.match(set(0, 'rate', '').error, /万龙单项：请填写折扣/)
  assert.match(set(1, 'rate', '0').error, /折扣填 0.1～10/)
  assert.match(set(1, 'rate', '11').error, /折扣填 0.1～10/)
  assert.match(set(2, 'fixed', '').error, /崇礼单项：请填写一口价/)
  assert.match(set(3, 'fixed', '-5').error, /不能为负数/)
  assert.equal(set(3, 'rate', '10').care[3].value, 1)       // 10 折 = 不打折，合法
  assert.equal(set(3, 'fixed', '0').care[3].value, 0)       // 一口价 0 合法
})

test('租赁折扣输入：空 = 不优惠，8.5 → 0.85，超范围报错', () => {
  assert.deepEqual(v.rentalPayload(''), { rate: null })
  assert.deepEqual(v.rentalPayload(undefined), { rate: null })
  assert.deepEqual(v.rentalPayload('9'), { rate: 0.9 })
  assert.deepEqual(v.rentalPayload('8.5'), { rate: 0.85 })
  assert.match(v.rentalPayload('0').error, /0.1～10/)
  assert.match(v.rentalPayload('abc').error, /0.1～10/)
  assert.equal(v.rentalEditText(0.9), '9')
  assert.equal(v.rentalEditText(null), '')
})

test('试算：折扣率与一口价（一口价高于原价不涨价）', () => {
  assert.deepEqual(v.previewPrice({ mode: 'rate', value: 0.8 }, 168), { price: 134.4, discount: 33.6 })
  assert.deepEqual(v.previewPrice({ mode: 'fixed', value: 128 }, 188), { price: 128, discount: 60 })
  assert.deepEqual(v.previewPrice({ mode: 'fixed', value: 500 }, 120), { price: 120, discount: 0 })
  assert.deepEqual(v.previewPrice({ mode: 'none', value: 0 }, 168), { price: 168, discount: 0 })
})

test('权益三行：门店养护两行 + 租赁', () => {
  const b = v.benefitLines(prices, 0.9)
  assert.deepEqual(b.lines.map(l => [l.label, l.one, l.two]), [['万龙服务中心 · 养护', '8折', '8.5折'], ['崇礼旗舰店 · 养护', '无', '¥128']])
  assert.equal(b.rental, '9折')
})

test('卡状态与日期显示', () => {
  assert.deepEqual(v.statusTag('issued'), { text: '待领取', tone: 'warn' })
  assert.deepEqual(v.statusTag('claimed'), { text: '已领取', tone: 'ok' })
  assert.equal(v.statusTag('revoked').text, '已撤销')
  assert.equal(v.dayText('2027-04-30T23:59:59'), '2027-04-30')
  assert.equal(v.dateText('2026-10-30T14:20:00'), '10-30 14:20')
  assert.equal(v.dateText(null), '')
})

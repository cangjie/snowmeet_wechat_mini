// 雪票详情页价格月历：有价格的日期可点，没价格的灰掉。
const test = require('node:test')
const assert = require('node:assert/strict')
const { buildMonths } = require('../utils/skipass_calendar.js')

const prices = [
  { date: '2026-11-02', price: 399 },
  { date: '2026-11-03', price: 399 },
  { date: '2026-11-07', price: 479 },
  { date: '2026-12-05', price: 371.07 }
]

const real = m => m.cells.filter(c => !c.empty)

test('从第一个有价月份到最后一个有价月份，每月标题和天数正确', () => {
  const months = buildMonths(prices, '2026-11-02')
  assert.deepEqual(months.map(m => m.title), ['2026年11月', '2026年12月'])
  assert.equal(real(months[0]).length, 30)
  assert.equal(real(months[1]).length, 31)
})

test('月初按周日起排空格：2026-11-01 是周日、2026-12-01 是周二', () => {
  const months = buildMonths(prices, '2026-11-02')
  assert.equal(months[0].cells.filter(c => c.empty).length, 0)
  assert.equal(months[1].cells.filter(c => c.empty).length, 2)
  assert.equal(months[1].cells[2].day, 1)
})

test('只有有价格的日期可点，其余灰掉', () => {
  const [nov, dec] = buildMonths(prices, '2026-11-02')
  const enabled = [...real(nov), ...real(dec)].filter(c => c.enabled).map(c => c.date)
  assert.deepEqual(enabled, ['2026-11-02', '2026-11-03', '2026-11-07', '2026-12-05'])
  const nov1 = real(nov)[0]
  assert.equal(nov1.enabled, false)
  assert.equal(nov1.priceStr, '')
})

test('格子里写价格：整数不带小数，有小数保留两位', () => {
  const [nov, dec] = buildMonths(prices, '2026-11-02')
  assert.equal(real(nov)[1].priceStr, '399')
  assert.equal(real(dec)[4].priceStr, '371.07')
})

test('选中的日期只标有价格的那一天；选了没价格的日期不会被标', () => {
  let [nov] = buildMonths(prices, '2026-11-03')
  assert.deepEqual(real(nov).filter(c => c.selected).map(c => c.date), ['2026-11-03'])
  ;[nov] = buildMonths(prices, '2026-11-04')
  assert.deepEqual(real(nov).filter(c => c.selected), [])
})

test('格子的 idx 在月内唯一，可以做 wx:key', () => {
  const [nov, dec] = buildMonths(prices, '')
  ;[nov, dec].forEach(m => {
    const idx = m.cells.map(c => c.idx)
    assert.equal(new Set(idx).size, idx.length)
  })
})

test('跨年的价格也能排', () => {
  const months = buildMonths([{ date: '2026-12-30', price: 500 }, { date: '2027-01-02', price: 500 }], '2026-12-30')
  assert.deepEqual(months.map(m => m.title), ['2026年12月', '2027年1月'])
})

test('没有价格返回空', () => {
  assert.deepEqual(buildMonths([], ''), [])
  assert.deepEqual(buildMonths(null, ''), [])
})

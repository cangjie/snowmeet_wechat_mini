// 全站统一的日期区间控件（components/date-range-picker）新增快捷键：
//   「本雪季」= 最近一个 10 月 15 日（含当天）到今天；「全部」= 2015-10-15 到今天。
// 只在区间模式出现，单日模式没有快捷键；原有「今天/昨天/本周/上周」不受影响。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadComponent, tap } = require('./reception_harness')

const COMPONENT = 'components/date-range-picker/index.js'
const WXML = fs.readFileSync(path.join(__dirname, '..', 'components/date-range-picker/index.wxml'), 'utf8')

function press(t, today, key) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(today) })
  const picker = loadComponent(COMPONENT, {}, { mode: 'range' })
  picker.onShortcut(tap({ key }))
  const change = picker.events.filter(e => e.name === 'change')
  assert.equal(change.length, 1)
  return { picker, range: change[0].detail }
}

test('本雪季：10-15 之后取当年 10-15，到今天', t => {
  const { picker, range } = press(t, '2026-11-14T13:09:00', 'season')
  assert.deepEqual(range, { startDate: '2026-10-15', endDate: '2026-11-14' })
  assert.equal(picker.data.activeShortcut, 'season')
})

test('本雪季：10-15 当天算新雪季的第一天，前一天仍属上一个雪季', t => {
  assert.deepEqual(press(t, '2026-10-15T00:00:00', 'season').range, { startDate: '2026-10-15', endDate: '2026-10-15' })
  t.mock.timers.reset()
  assert.deepEqual(press(t, '2026-10-14T23:59:00', 'season').range, { startDate: '2025-10-15', endDate: '2026-10-14' })
})

test('本雪季：年初到 10-14 之间取上一年的 10-15', t => {
  assert.deepEqual(press(t, '2026-03-01T09:00:00', 'season').range, { startDate: '2025-10-15', endDate: '2026-03-01' })
})

test('全部：从 2015-10-15 到今天', t => {
  const { picker, range } = press(t, '2026-11-14T13:09:00', 'all')
  assert.deepEqual(range, { startDate: '2015-10-15', endDate: '2026-11-14' })
  assert.equal(picker.data.activeShortcut, 'all')
})

test('原有快捷键不变：今天 / 本周', t => {
  assert.deepEqual(press(t, '2026-11-14T13:09:00', 'today').range, { startDate: '2026-11-14', endDate: '2026-11-14' })
  t.mock.timers.reset()
  // 2026-11-14 是周六，本周从周一 11-09 开始
  assert.deepEqual(press(t, '2026-11-14T13:09:00', 'thisweek').range, { startDate: '2026-11-09', endDate: '2026-11-14' })
})

test('模板：本雪季和全部两个按钮与原有四个并排，且只在区间模式出现', () => {
  const block = WXML.slice(WXML.indexOf('dpr-shortcuts'), WXML.indexOf('</view>\n</view>'))
  const keys = [...block.matchAll(/data-key="(\w+)"/g)].map(m => m[1])
  assert.deepEqual(keys, ['today', 'yesterday', 'thisweek', 'lastweek', 'season', 'all'])
  assert.match(WXML, /class="dpr-shortcuts" wx:if="\{\{mode != 'single'\}\}"/)
  assert.match(block, />本雪季<\/view>/)
  assert.match(block, />全部<\/view>/)
})

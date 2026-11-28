// 养护订单详情页：订单里的装备信息和顾客装备列表里对应那件不一样时做标注（用户 2026-11-28）。
//   · 装备卡标题行有「与装备列表不一致」标签（卡片折叠时也看得到）；
//   · 展开后在「装备信息」下面逐项写出装备列表里的值；
//   · 差异由后端给（equipmentDiffs）；旧后端没有这个字段、匹配不到那件装备时什么都不标。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage } = require('./reception_harness.js')

const PAGE = 'pages/admin/care/care_order_detail/care_order_detail.js'
const taskOf = (name, status, sort) => ({ id: sort + 1, care_id: 7, task_name: name, status, sort, valid: 1 })
const tasks = () => [taskOf('安全检查', '已完成', 10), taskOf('发板', '未开始', 60)]

function detail() {
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk', staff: { id: 5, title_level: 100 } } })
  global.wx = { showToast() {} }
  const page = loadPage(PAGE, { IMAGE_HOST: 'https://img.example' })
  delete global.getApp
  page._uiState = { expanded: {}, veriType: {}, safeCheck: {}, cancelReason: {} }
  page.loadOrder = () => {}
  return { page, done() { delete global.wx } }
}
const rendered = (page, extra) => page._renderCare(Object.assign({ id: 7, order_id: 11, equipment: '双板', brand: 'ATOMIC', scale: '170', careImages: [], tasks: tasks() }, extra || {}))

test('装备带差异时给出逐项文字', () => {
  const { page, done } = detail()
  const texts = (diffs) => rendered(page, { equipmentDiffs: diffs })._equipDiffLines.map(l => l.text)
  assert.deepEqual(texts([
    { field: 'scale', orderValue: '178', listValue: '180' },
    { field: 'serials', orderValue: '20556', listValue: null },
  ]), ['装备列表中的长度：180', '装备列表中的序列号：未填'])
  assert.deepEqual(texts([
    { field: 'equipment', orderValue: '双板', listValue: '单板' },
    { field: 'brand', orderValue: 'APO', listValue: 'Burton/伯顿' },
    { field: 'serials', orderValue: 'A1|B2', listValue: 'A1|' },
  ]), ['装备列表中的类型：单板', '装备列表中的品牌：Burton/伯顿', '装备列表中的序列号：左:A1 / 右:无'])
  done()
})

test('旧后端没有差异字段、null、空数组都不标', () => {
  const { page, done } = detail()
  for (const equipmentDiffs of [undefined, null, []]) {
    assert.deepEqual(rendered(page, { equipmentDiffs })._equipDiffLines, [])
  }
  done()
})

test('标签在标题行（折叠时可见），逐项文字在展开区装备信息下面', () => {
  const wxml = fs.readFileSync(path.join(__dirname, '..', PAGE.replace(/\.js$/, '.wxml')), 'utf8')
  const head = wxml.slice(wxml.indexOf('<view class="care-head"'), wxml.indexOf('<view class="care-chips">'))
  assert.match(head, /_equipDiffLines\.length > 0\}\}" class="chip chip-diff">与装备列表不一致</)
  const body = wxml.slice(wxml.indexOf('class="care-body"'))
  const at = (s) => body.indexOf(s)
  assert.ok(at('class="equip-diff"') > at('class="info-grid"') && at('class="equip-diff"') < at('class="edit-panel"'))
  assert.match(body, /⚠ \{\{line\.text\}\}/)
})

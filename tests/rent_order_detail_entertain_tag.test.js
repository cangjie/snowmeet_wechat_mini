// 租赁订单详情页「按租赁商品」列表：招待的租赁在折叠态就标出「招待」（2026-11-22 用户要求，用一个不同颜色的文字），
// 不用展开才能看出来；不是招待的不显示。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const DIR = path.join(__dirname, '../pages/admin/rent/rent_order_detail')
const WXML = fs.readFileSync(path.join(DIR, 'rent_order_detail.wxml'), 'utf8')
const WXSS = fs.readFileSync(path.join(DIR, 'rent_order_detail.wxss'), 'utf8')

// 折叠态那一行：从 class="rental-head" 到「展开态」注释之前
const head = (() => {
  const start = WXML.indexOf('class="rental-head"')
  const end = WXML.indexOf('<!-- 展开态 -->', start)
  assert.ok(start > 0 && end > start, '找不到折叠态的租赁行')
  return WXML.slice(start, end)
})()

test('折叠态那一行有「招待」标注，只在 item.entertain 为真时显示', () => {
  assert.match(head, /<text class="rental-head-entertain" wx:if="\{\{item\.entertain\}\}">招待<\/text>/)
})

test('「招待」标注在商品名之后、价格信息之前，不会被展开态的内容盖住', () => {
  const name = head.indexOf('rental-head-name')
  const tag = head.indexOf('rental-head-entertain')
  const meta = head.indexOf('rental-head-meta')
  assert.ok(name > 0 && tag > name && meta > tag)
})

test('标注是文字颜色，和价目标签、套餐/单品标签的颜色都不同', () => {
  const rule = WXSS.match(/\.rental-head-entertain\s*\{([^}]*)\}/)
  assert.ok(rule, '缺少 .rental-head-entertain 样式')
  const color = rule[1].match(/(?:^|[;\s])color:\s*(#[0-9a-fA-F]{3,6})/)
  assert.ok(color, '标注要有文字颜色')
  const used = (WXSS.match(/(?:^|[;\s{])color:\s*#[0-9a-fA-F]{3,6}/g) || [])
  const sceneColors = ['#6f7881', '#0b8fd6', '#b7791f', '#0369a1', '#6b7280']
  assert.ok(!sceneColors.includes(color[1].toLowerCase()), '不能和价目标签、套餐/单品标签同色')
  assert.ok(used.length > 0)
})

test('标注不收缩：商品名太长时被省略的是名字，不是「招待」', () => {
  const rule = WXSS.match(/\.rental-head-entertain\s*\{([^}]*)\}/)[1]
  assert.match(rule, /flex-shrink:\s*0/)
})

test('展开态原有的招待显示（费用格、复选框）保持不变', () => {
  assert.ok(WXML.includes('wx:if="{{item.entertain}}" class="rental-showcase-fee-cell"'))
  assert.ok(WXML.includes('onToggleEntertain'))
})

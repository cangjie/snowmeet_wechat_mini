// 会员详情页先不显示龙珠（2026-11-22 用户：这个界面，显示的龙珠，先隐藏掉）。
// 只是隐藏：代码和数据（member.points）都留着，把页面 data 里的 showPoints 改成 true 就恢复。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')

test('会员详情页：龙珠开关 showPoints 默认关闭', () => {
  assert.match(read('pages/admin/member/member_detail.js'), /showPoints:\s*false/)
})

test('会员详情页：「可用龙珠」整块受 showPoints 控制，关闭时不渲染', () => {
  const wxml = read('pages/admin/member/member_detail.wxml')
  const cell = wxml.match(/<view[^>]*class="asset-cell asset-cell--r"[^>]*>[\s\S]*?<\/view>/)
  assert.ok(cell, '龙珠那一块还在（只是隐藏）')
  assert.match(cell[0], /wx:if="\{\{showPoints\}\}"/)
  assert.match(cell[0], /可用龙珠/)
  assert.match(cell[0], /\{\{member\.points\}\}/)
})

test('会员详情页：卡片标题龙珠隐藏时只写「储值」，打开时仍是「储值与龙珠」', () => {
  const wxml = read('pages/admin/member/member_detail.wxml')
  assert.match(wxml, /\{\{showPoints \? '储值与龙珠' : '储值'\}\}/)
  assert.doesNotMatch(wxml, /<text class="card-title-txt">储值与龙珠<\/text>/)
})

test('只动会员详情页：会员列表、合并提示不受影响', () => {
  assert.match(read('pages/admin/member/member_list.wxml'), /龙珠 \{\{item\.points\}\}/)
  assert.match(read('pages/admin/member/member_detail.wxml'), /订单、储值、龙珠、次卡、优惠券将全部转移/)
})

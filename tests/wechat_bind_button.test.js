// 「绑定会员微信」页（顾客扫店员出示的二维码后打开）的「授权手机号并绑定」按钮：文字被截掉（2026-11-23 用户截图）。
// 原因同优惠券页：app.wxss 给所有 button 设了固定高度 65rpx、padding-top 10rpx 和凹槽边框，字号一大文字就被切掉；
// 这里用自己的样式盖掉：固定高度 + 同高的行高、不留上下内边距、不用 size="mini"（它的内置样式优先级更高）。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')

test('模板：授权按钮用自己的样式类，不写 size="mini"，原有的授权逻辑不变', () => {
  const wxml = read('pages/member/wechat_bind.wxml')
  const button = wxml.match(/<button[^>]*open-type="getPhoneNumber"[^>]*>/)
  assert.ok(button)
  assert.match(button[0], /class="bind-btn"/)
  assert.doesNotMatch(button[0], /size="mini"/)
  assert.match(button[0], /bindgetphonenumber="onPhone"/)
  assert.match(wxml, /授权手机号并绑定/)
})

test('样式：按钮高 88rpx、行高 88rpx、无上下内边距、无凹槽边框，文字完整显示', () => {
  const wxss = read('pages/member/wechat_bind.wxss')
  const rule = (wxss.match(/\.card \.bind-btn\s*\{([^}]*)\}/) || [])[1] || ''
  assert.match(rule, /height:\s*88rpx/)
  assert.match(rule, /line-height:\s*88rpx/)
  assert.match(rule, /padding:\s*0\b/)
  assert.match(rule, /border:\s*none/)
  assert.match(rule, /font-size:\s*\d+rpx/)
  assert.match(wxss, /\.card \.bind-btn::after\s*\{[^}]*border:\s*none/)
})

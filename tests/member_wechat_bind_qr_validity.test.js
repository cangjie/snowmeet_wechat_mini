// 会员绑定微信的二维码有效期由 2 分钟改成 30 分钟（2026-11-23 用户）。后端是 MemberWechatBindController.QrValidMinutes，
// 店员页（会员详情「扫码绑定」）显示的提示文字要和它一致。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const js = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/member/member_detail.js'), 'utf8')

test('店员页提示：二维码 30 分钟内有效，不再写两分钟', () => {
  assert.match(js, /请会员扫码并授权本人手机号，二维码 30 分钟内有效/)
  assert.doesNotMatch(js, /二维码两分钟内有效/)
})

test('店员页不自己判断过期时间：过期以后端状态 expired 为准', () => {
  assert.match(js, /result\.stage === 'expired'/)
})

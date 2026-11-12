const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, settle } = require('./reception_harness.js')

test('员工订票码编码正式环境链接并携带员工编号', async () => {
  const app = { loginPromiseNew: Promise.resolve(), globalData: { domainName: 'api.test', sessionKey: 'key', staff: { id: 42, valid: 1, title_level: 200 } } }
  global.getApp = () => app
  global.wx = { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial' } }), request: o => o.success({statusCode: 200, data: 'https://old.test/code'}) }
  const page = loadPage('pages/admin/ski_pass/reserve_qrcode.js', {})
  page.onLoad({})
  await settle()
  assert.equal(page.data.bookingUrl, 'https://mini.snowmeet.top/mapp/skipass_book?staffId=42')
  assert.equal(page.data.qrUrl, 'https://api.test/api/MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent(page.data.bookingUrl))
  delete global.getApp
  delete global.wx
})

test('扫码参数只接受本系统的正式订票链接和有效员工编号', () => {
  const scene = require('../utils/skipass_staff_scene.js')
  const q = value => ({ q: encodeURIComponent(value) })
  assert.equal(scene.fromOptions(q('https://mini.snowmeet.top/mapp/skipass_book?staffId=42')), '42')
  assert.equal(scene.fromOptions(q('https://other.test/mapp/skipass_book?staffId=42')), '')
  assert.equal(scene.fromOptions(q('https://mini.snowmeet.top/mapp/skipass_book?staffId=0')), '')
  assert.equal(scene.fromOptions(q('https://mini.snowmeet.top/mapp/skipass_book?staffId=2147483648')), '')
  assert.equal(scene.fromOptions({ q: '%broken' }), '')
  assert.equal(scene.fromOptions({ scene: 's%3D42' }), '42')
})

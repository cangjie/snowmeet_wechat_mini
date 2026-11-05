// utils/util.js performWebRequest：网络失败时拒绝值仍是对象（旧调用方按 {} 处理），但带上微信返回的 errMsg
const test = require('node:test')
const assert = require('node:assert/strict')

function loadUtil(request) {
  global.wx = { request, showToast() {} }
  global.getApp = () => ({ globalData: {} })
  return require('../utils/util.js')
}

test('wx.request 失败：拒绝值是带 errMsg 的对象', async t => {
  t.after(() => { delete global.wx; delete global.getApp })
  const util = loadUtil(o => o.fail({ errMsg: 'request:fail timeout' }))
  await assert.rejects(util.performWebRequest('https://example.test/x'), err => {
    assert.equal(typeof err, 'object')
    assert.equal(err.errMsg, 'request:fail timeout')
    return true
  })
})

test('wx.request 失败且没有 errMsg：仍是对象，errMsg 为空串', async t => {
  t.after(() => { delete global.wx; delete global.getApp })
  const util = loadUtil(o => o.fail({}))
  await assert.rejects(util.performWebRequest('https://example.test/x'), err => {
    assert.equal(typeof err, 'object')
    assert.equal(err.errMsg, '')
    return true
  })
})

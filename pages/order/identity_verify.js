// pages/order/identity_verify.js
// 微信身份核验落地页（纯核验，不涉及支付）：顾客扫「储值付租金」核验二维码进入，
// 登录拿到本人 member_id 后调 VerifyWechatIdentity，与订单会员比对；命中则后端把
// order.wechat_unverified 置 1，店员端轮询到后放行「储值付租金」勾选。
const app = getApp()
const data = require('../../utils/data.js')

Page({
  data: {
    orderId: 0,
    state: 'loading',   // loading | matched | mismatch | error
    message: '',
    maskedCell: ''
  },

  onLoad(options) {
    var orderId = parseInt(options.orderId || '0')
    // 兼容普通链接二维码直达（q 里带 verifyOrderId），与 payment_entry 同口径
    if ((!orderId || isNaN(orderId)) && options.q != undefined) {
      var url = decodeURIComponent(options.q)
      var urlArr = url.split('?')
      var queryStr = urlArr[urlArr.length - 1]
      orderId = parseInt(queryStr.replace('verifyOrderId=', ''))
    }
    this.setData({ orderId: orderId })
  },

  onShow() {
    var that = this
    if (!that.data.orderId || isNaN(that.data.orderId)) {
      that.setData({ state: 'error', message: '核验参数缺失' })
      return
    }
    app.loginPromiseNew.then(function () {
      data.verifyWechatIdentityPromise(that.data.orderId, app.globalData.sessionKey).then(function (res) {
        if (res && res.matched) {
          that.setData({ state: 'matched' })
        } else {
          that.setData({ state: 'mismatch', maskedCell: (res && res.orderMemberMaskedCell) || '' })
        }
      }).catch(function (msg) {
        that.setData({ state: 'error', message: (typeof msg === 'string' && msg) ? msg : '核验失败，请重试' })
      })
    }).catch(function () {
      that.setData({ state: 'error', message: '登录失败，请重试' })
    })
  }
})

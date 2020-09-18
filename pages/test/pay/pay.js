// pages/test/pay/pay.js
var md5 = require('../../../utils/md5.js')
Page({

  /**
   * Page initial data
   */
  data: {

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var nonce = Math.random().toString().replace('0.', '')
    if (nonce.length > 32) {
      nonce = nonce.substr(0, 31)
    }
    var appId = 'wxd1310896f2aa68bb'
    var prePayId = 'wx18211635069509ed85376deffcba200000'
    var timeStamp = new Date().valueOf().toString()
    var payStr = 'appId=' + appId + '&nonceStr=' + nonce + '&package=prepay_id=' + prePayId + '&signType=MD5&timeStamp=' + timeStamp
    wx.requestPayment({
      timeStamp: timeStamp,
      nonceStr: nonce,
      package: 'prepay_id=' + prePayId,
      signType: "MD5",
      paySign: md5(payStr),
      success: function(res) {
        console.log(res)
      },
      fail: function(res) {
        console.log(res)
      }
    })

  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  }
})
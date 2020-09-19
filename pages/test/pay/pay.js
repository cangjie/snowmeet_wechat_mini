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


    var nonce = '5f65c189a158c'
    var appId = 'wxd1310896f2aa68bb'
    var prePayId = 'wx19163001458924eb4dbd3f509cd2000000'
    var timeStamp = '1600504201'
    var paySign = '55A62DF9D3366552724249AEBA37F9C0'



    var payStr = 'appId=' + appId + '&nonceStr=' + nonce + '&package=prepay_id=' + prePayId + '&signType=MD5&timeStamp=' + timeStamp + '&key=jihuowangluoactivenetworkjarrodc'



    wx.requestPayment({
      timeStamp: timeStamp,
      nonceStr: nonce,
      package: 'prepay_id=' + prePayId,
      signType: "MD5",
      paySign: paySign,
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
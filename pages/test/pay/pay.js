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


    var nonce = '5faba423536a5'
    var appId = 'wxd1310896f2aa68bb'

    var prePayId = 'wx11164315231153e7a4b222a09654c00000'
    var timeStamp = '1605084195'
    var paySign = 'D69B65CBFC380D1928AF315FCDAF2E36'



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
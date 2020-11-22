// pages/payment/payment.js
const app = getApp()
var wxloginModule = require('../../utils/wxlogin.js')
Page({

  /**
   * Page initial data
   */
  data: {
    needValidCell: true,
    orderId: 0,
    prepayId:'',
    timeStamp:'',
    nonce:'',
    sign:'',
    totalString: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var totalString = 'nonceStr=' + options.nonce + '&package=prepay_id=' + options.prepayid + '&signType=MD5&timeStamp=' + options.timestamp
    wxloginModule.wxlogin()
    this.setData({orderId : options.orderid, prepayId: options.prepayid, timeStamp: options.timestamp, nonce: options.nonce, sign: options.sign})
    wx.requestPayment({
      appId: app.globalData.appId,      
      timeStamp: options.timestamp,
      nonceStr: options.nonce,
      package: 'prepay_id=' + options.prepayid,
      signType: 'MD5',
      paySign: options.sign,
      success: (res) => {

      },
      fail: (res) => {

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

  },
  onUpdateSuccess: function(){
    this.setData({needValidCell: false})
  }
})
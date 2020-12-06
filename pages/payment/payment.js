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
    totalString: '',
    havePaid: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var totalString = 'nonceStr=' + options.nonce + '&package=prepay_id=' + options.prepayid + '&signType=MD5&timeStamp=' + options.timestamp
    wxloginModule.wxlogin()
    var orderId = options.orderid
    this.setData({orderId : options.orderid, prepayId: options.prepayid, timeStamp: options.timestamp, nonce: options.nonce, sign: options.sign})
    wx.requestPayment({
      appId: app.globalData.appId,      
      timeStamp: options.timestamp,
      nonceStr: options.nonce,
      package: 'prepay_id=' + options.prepayid,
      signType: 'MD5',
      paySign: options.sign,
      success: (res) => {
        
        var orderInfoUrl = 'https://' + app.globalData.domainName + '/api/order_info_get.aspx?orderid=' + orderId + '&sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: orderInfoUrl,
          success: (res) => {
            if (res.data.status == 0) {
              if (res.data.order_online.type.trim()=='雪票') {
                /*
                wx.requestSubscribeMessage({
                  tmplIds: ['Fp_lJYTxVZVbc5PdvA-z-8UqUrf6VNAYH4EVFuf2af8'],
                  success: (res)=>{ 

                  }
                })
                */
              }
              this.setData({havePaid: true, orderInfo: res.data.order_online})
            }
          }
        })
        
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
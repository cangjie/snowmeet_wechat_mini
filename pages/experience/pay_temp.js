// pages/experience/pay_temp.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({paymentId: options.paymentId})
    app.loginPromiseNew.then(function(resolve){
      var paymentUrl = 'https://' + app.globalData.domainName + '/core/OrderPayment/TenpayRequest/' + that.data.paymentId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: paymentUrl,
        method: 'GET',
        success:(res)=>{
          wx.requestPayment({
            nonceStr: res.data.nonce,
            package: 'prepay_id=' + res.data.prepay_id,
            paySign: res.data.sign,
            timeStamp: res.data.timeStamp,
            signType: 'MD5',
            success:(res)=>{
              wx.showToast({
                title: '支付成功。',
                icon: 'none'
              })
            }
          })
        }
      })

    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  }
})
// pages/payment/order_payment.js
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
  onLoad: function (options) {
    app.loginPromiseNew.then(function(resolve){
      var wepayUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/Pay/'+options.orderid + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: wepayUrl,
        method: 'GET',
        success:(res)=>{
          console.log('prepay', res)
          
          var wepay = res.data
          wx.requestPayment({
            nonceStr: wepay.nonce,
            package: 'prepay_id=' + wepay.prepay_id,
            paySign: wepay.sign,
            timeStamp: wepay.timestamp,
            signType: 'RSA',
            success: (res) => {
              console.log('pay success', res)  
              wx.navigateTo({
                url: '/pages/mine/my_ski_pass/my_ski_pass',
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
// pages/payment/confirm_payment.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    id:0,
    controller: '',
    action: '',
    doValidCell: false,
    paySuccess: false,
    doValidInfo: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    this.data.controller = options.controller
    this.data.action = options.action
    this.data.id = options.id
    app.loginPromiseNew.then(function(resolve){
      if (resolve == null || resolve.cellNumber == null || resolve.cellNumber.trim() == ''){
        that.setData({doValidCell: true})
      }
      else {
        that.placeOrder()
      }
    })
  },
  placeOrder: function(){
    var that = this
    var placeOrderUrl = 'https://' + app.globalData.domainName + '/core/' + this.data.controller + '/' + this.data.action + '/' + this.data.id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: placeOrderUrl,
      method: 'GET',
      success:(res)=>{
        var orderId = res.data.id
        console.log('Order created.', res)
        that.setData({orderId: res.data.id})
        var wepayUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/Pay/' + encodeURIComponent(app.globalData.sessionKey)+ '?id=' + orderId
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

              }
            })
          }
        })
      }
    })
  },

  cellUpdate: function() {
    this.placeOrder()
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
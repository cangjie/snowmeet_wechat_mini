// pages/maintain/in_shop_request_payment/in_shop_request_payment.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    needValidCell: true,
    id: 0,
    paymentStep: 0
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    this.data.id = options.scene
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
  onUpdateSuccess: function() {
    this.setData({needValidCell: false})
    var that = this
    app.loginPromise.then(function(resolve) {
      var paymentStep = that.data.paymentStep
      paymentStep = 1
      that.setData({paymentStep: paymentStep})
      var updatePromise = new Promise(function(resolve){
        var updateInfo = {}
        updateInfo.open_id = ''
        var urlUpdate = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_modify.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&id=' + that.data.id
        wx.request({
          url: urlUpdate,
          method: 'POST',
          data: updateInfo,
          success: (res) => {
            if (res.data.status == 0 && res.data.result > 0) {
              resolve({result: res.data.result})
            }
          }
        })
      })
      var placeOrderPromise = new Promise(function(resolve) {
        var urlPlaceOrder = 'https://' + app.globalData.domainName + '/api/maintain_task_order_place_in_shop_quickly.aspx?id=' + that.data.id + '&sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: urlPlaceOrder,
          success: (res) => {
            if (res.data.status==0) {
              //that.data.orderId = res.data.order_id
              resolve({orderId: res.data.order_id})
            }
          }
        })
      })
      updatePromise.then(function(resolve) {
        var paymentStep = that.data.paymentStep
        paymentStep = 2
        that.setData({paymentStep: paymentStep})
        if (resolve.result > 0) {
          placeOrderPromise.then(function(resolve) {
            var paymentStep = that.data.paymentStep
            paymentStep = 3
            that.setData({paymentStep: paymentStep})
            var orderId = resolve.orderId
            that.setData({orderId: orderId})
            wx.navigateTo({
              url: '../../payment/payment?orderid=' + orderId
            })
          })
        }
      })
    })
  }
})
// pages/payment/pay_hub.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    needAuth: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    if (options.paymentId != undefined){
      that.setData({paymentId: options.paymentId})
    }
    if (options.orderId != undefined){
      that.setData({orderId: options.orderId})
    }
    app.loginPromiseNew.then(function(resolve){
      that.setData({needAuth: true})
    })
  },

  jump(){
    var that = this
    var getOrderUrl = 'https://' + app.globalData.domainName + '/core/'
    if (that.data.paymentId != undefined){
      getOrderUrl = getOrderUrl + 'OrderPayment/GetWholeOrder/' + that.data.paymentId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    }
    else{
      getOrderUrl = getOrderUrl + 'OrderOnlines/GetOrderOnline/' + that.data.orderId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    }
    wx.request({
      url: getOrderUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){
          var jumpUrl = ''
          var order = res.data
          switch(order.type){
            case '店销现货':
              jumpUrl = '../shop_sale/order_info'
              break;
            case '服务':
              jumpUrl = '../maintain/maintain_info'
              break;
            default:
              break;
          }
          if (that.data.paymentId != undefined){
            jumpUrl = jumpUrl + '?paymentId=' + that.data.paymentId
          }
          if (that.data.orderId != undefined){
            jumpUrl = jumpUrl + '?orderId=' + that.data.orderId
          }
          wx.redirectTo({
            url: jumpUrl
          })
        }
      }
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
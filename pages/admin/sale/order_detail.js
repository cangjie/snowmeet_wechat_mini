// pages/admin/sale/order_detail.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    isOrderInfoReady: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.setData({role: app.globalData.role})
      var orderId = parseInt(options.id)
      var getOrderUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/GetWholeOrderByStaff/' + orderId + '?staffSessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getOrderUrl,
        method: 'GET',
        success:(res)=>{
          var order = res.data
          order.date = util.formatDate(new Date(order.create_date))
          order.time = util.formatTimeStr(new Date(order.create_date))
          for(var i = 0; i < order.payments.length; i++){
            var payment = order.payments[i]
            payment.date = util.formatDate(new Date(payment.create_date))
            payment.time = util.formatTimeStr(new Date(payment.create_date))
          }
          that.setData({order: order, isOrderInfoReady: true})
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
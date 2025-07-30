// pages/admin/fd/fd_order_confirm.js
const app = getApp()
const util = require('../../../utils/util.js')
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
    that.setData({orderId: options.orderId})
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
    var that = this
    app.loginPromiseNew.then(function(resovle){
      that.setData({staff: app.globalData.staff})
      that.getData()
    })
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

  },
  getData(){
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Order/GetOrderByStaff/' + that.data.orderId + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, null).then(function(resolve){
      console.log('order', resolve)
      var order = resolve
      order.total_amountStr = util.showAmount(order.total_amount)
      order.totalChargeStr = util.showAmount(order.totalCharge)
      that.setData({order})
    })
  }
})
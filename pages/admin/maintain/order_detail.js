// pages/admin/maintain/order_detail.js
const util = require('../../../utils/util.js')
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
    var orderId = options.orderId
    app.loginPromiseNew.then(function(resolve){
      var getOrderInfoUrl = 'https://' + app.globalData.domainName + '/core/maintainlive/GetMaintainOrder/' + orderId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getOrderInfoUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode == 200){
            var order = res.data
            var orderDate = new Date(order.order.create_date)
            order.date = util.formatDate(orderDate)
            order.time = util.formatTimeStr(orderDate)
            that.setData({order: order, tasks: order.items})
          }
        },
        fail:(res)=>{
          console.log(res)
        },
        complete:(res)=>{
          console.log(res)
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
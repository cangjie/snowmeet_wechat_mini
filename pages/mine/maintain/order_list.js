// pages/mine/maintain/order_list.js
const app = getApp();
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {

  },

  gotoDetail(e){
    wx.navigateTo({
      url: 'order_detail?id=' + e.currentTarget.id,
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function (resolve) {
      var getOrdersUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetMyMaintainOrders?sessionKey=' + app.globalData.sessionKey
      wx.request({
        url: getOrdersUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode == 200){
            var orders = res.data
            for(var i = 0; i < orders.length; i++){
              var order = orders[i]
              order.date = util.formatDate(new Date(order.order.create_date))
              order.time = util.formatTimeStr(new Date(order.order.create_date))
            }
            that.setData({orders: orders})
          }
          
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
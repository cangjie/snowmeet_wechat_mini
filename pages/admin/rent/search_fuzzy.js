// pages/admin/rent/search_fuzzy.js
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
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

  },
  setKey(e){
    var that = this
    that.data.key = e.detail.value
  },
  search(e){
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Rent/GetOrdersFuzzyByStaff?key=' + encodeURIComponent(that.data.key) + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, null).then(function(orders){
      for(var i = 0; orders != null && i < orders.length; i++){
        var order = orders[i]
        var orderDate = new Date(order.biz_date)
        order.biz_dateDateStr = util.formatDate(orderDate)
        order.biz_dateTimeStr = util.formatTimeStr(orderDate)
      }
      that.setData({orders})
    })
  },
  gotoDetail(e){
    var that = this
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'rent_details?id='+id,
    })
  }
})
// pages/admin/rent/rent_item_change.js
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
    var that = this
    that.data.orderId = options.orderId
    that.data.rentItemId = options.rentItemId
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
    data.getOrderByStaffPromise(that.data.orderId, app.globalData.sessionKey).then(function (order){
      that.data.order = order
      var rentItem = that.getRentItem(that.data.rentItemId)
      console.log('get rent item', rentItem)
      rentItem = that.renderRentItem(rentItem)
      data.getRentCategoryPromise(rentItem.category_id).then(function (category){
        rentItem.category = category
        that.setData({rentItem})
      })
      //that.setData({rentItem})
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
  getRentItem(id){
    var that = this
    var order = that.data.order
    var item = null
    for(var i = 0; item == null && i < order.rentals.length; i++){
      var rental = order.rentals[i]
      for(var j = 0; item== null && j < rental.rentItems.length; j++){
        if (rental.rentItems[j].id == that.data.rentItemId){
          item = rental.rentItems[j]
        }
      }
    }
    return item
  },
  renderRentItem(item){
    var pickDate = new Date(item.pickDate)
    item.pickDateDateStr = util.formatDate(pickDate)
    item.pickDateTimeStr = util.formatTimeStr(pickDate)
    return item
  }
  
})
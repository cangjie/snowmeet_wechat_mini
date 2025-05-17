// pages/admin/rent/rent_details.js
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
    that.setData({id: options.id})
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
    var id = that.data.id
    var getUrl = app.globalData.requestPrefix + 'Order/GetOrderByStaff/' + id + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, undefined).then(function(resolve){
      var order = resolve
      console.log('get order', order)
      
      var bizDate = new Date(order.biz_date)
      order.bizDateStr = util.formatDate(bizDate)
      order.bizTimeStr = util.formatTimeStr(bizDate)
      var packageNum = 0
      for(var i = 0; i < order.rentals; i++){
        if (order.rentals[i].isPackage == 1){
          packageNum++
        }
      }
      that.setData({order, packageNum, rentalNum: order.rentals.length})
    }).catch(function (){

    })
  }
})
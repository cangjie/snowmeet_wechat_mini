// pages/admin/retail/retail_order_list.js
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
    that.data.startDate = new Date("2025-10-1")
    that.data.endDate = new Date("2026-12-31")
    app.loginPromiseNew.then(function (resolve){
      that.getData()
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

  },
  getData(){
    var that = this
    data.getOrdersByStaffPromise(null, null, null, null, '零售', '2025-10-01', '2026-12-31', 
    null, null, null, null, null, null, null, app.globalData.sessionKey).then(function (orders){
      console.log('get orders', orders)
      that.setData({orders})
    }).catch(function (exp){

    })
  }
})
// pages/admin/unipay/unipay_list.js
const app = getApp()
const data = require('../../../utils/data.js')
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    querying: true
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
    app.loginPromiseNew.then(function (resolve){

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
  dateSelected(e){
    console.log('date', e)
    var startDate = e.detail.startDate
    var endDate = e.detail.endDate
    var that = this
    that.setData({querying: false, startDate, endDate})
  },
  getData(){
    var that = this
    that.setData({querying: true})
    data.getUnipayOrderPromise(that.data.startDate, that.data.endDate, app.globalData.sessionKey)
      .then(function(orders){
        util.renderUnipayOrders(orders)
        that.setData({orders, querying: false})
      })
  },
  gotoDetail(e){
    //var that = this
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'unipay_detail?id=' + id
    })
  },
})
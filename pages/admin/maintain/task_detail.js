// pages/admin/maintain/task_detail.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    txtColor: '',
    bgColor: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var id = options.id
    that.setData({id})
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
    app.loginPromiseNew.then(function(resolve){
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
    var url = app.globalData.requestPrefix + 'Care/GetCareByStaff/' + that.data.id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    util.performWebRequest(url, undefined).then(function(resolve){
      console.log('get care', resolve)
      var task = resolve
      task.order.paidAmountStr = util.showAmount(task.order.paidAmount)
      task.order.refundAmountStr = util.showAmount(task.order.refundAmount)
      task.order.surplus = task.order.paidAmount - task.order.refundAmount
      task.order.surplusStr = util.showAmount(task.order.surplus)
      that.setData({task})
    })
  }
})
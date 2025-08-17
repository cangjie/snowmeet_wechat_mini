// pages/admin/fd/fd_order_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    showMemo: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var orderId = options.orderId
    that.setData({orderId})
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
    app.loginPromiseNew.then(function (resolve){
      that.getOrderPromise(that.data.orderId).then(function (resolve){
        that.renderOrder(resolve)
      })
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
  displayMemo(){
    var that = this
    that.setData({showMemo: true})
  },
  closeMemo(){
    var that = this
    that.setData({showMemo: false})
  },
  getOrderPromise(id){
    var that = this
    return new Promise(function (resolve, reject){
      var getUrl = app.globalData.requestPrefix + 'Order/GetOrderByStaff/' + id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      util.performWebRequest(getUrl, null).then(function (order){
        resolve(order)
      }).catch(function (reject){

      })
    })
  },
  renderOrder(order){
    var that = this
    var bizDate = new Date(order.biz_date)
    order.dateStr = util.formatDate(bizDate)
    order.timeStr = util.formatTimeStr(bizDate)
    order.is_testStr = order.is_test == 1 ? '测试':'营业'
    order.haveEnterainStr = order.haveEnterain? '是' : '否'
    order.is_packageStr = order.is_package == 1? '是':'否'
    order.creditInfo = order.haveOnCredit? '是':'否'
    order.haveDiscountStr = order.haveDiscount? '包含' : '不含'
    that.setData({order})
  }
})
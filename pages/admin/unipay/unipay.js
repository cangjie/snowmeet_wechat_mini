// pages/admin/unipay/unipay.js
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
    var that = this
    app.loginPromiseNew.then(function (resolve){
      var qrUrl = 'https://' + app.globalData.domainName + '/unipay/unipay_qr.png'
      that.setData({qrUrl})
      var interval = setInterval(that.getData, 1000)
      that.setData({interval})
    })
  },
  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {
    var that = this
    try{
      clearInterval(that.data.interval)
    }
    catch{

    }
  },
  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {
    var that = this
    try{
      clearInterval(that.data.interval)
    }
    catch{

    }
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
    var now = new Date()
    var startDate = util.formatDate(now)
    var endDate = startDate
    data.getUnipayOrderPromise(startDate, endDate, app.globalData.sessionKey)
      .then(function (orders){
        console.log('get unipay orders', orders)
        that.renderOrders(orders)
        that.setData({orders})
      })
  },
  renderOrders(orders){
    var that = this
    for(var i = 0; i < orders.length; i++){
      that.renderOrder(orders[i])
    }
  },
  renderOrder(order){
    order.paidAmountStr = util.showAmount(order.paidAmount)
    var bizDate = new Date(order.biz_date)
    var dateStrArr = util.formatDate(bizDate).split('-')
    order.biz_dateStr = dateStrArr[1] + '-' + dateStrArr[2]
    order.biz_timeStr = util.formatTimeStr(bizDate)
  },
  gotoDetail(e){
    //var that = this
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'unipay_detail?id=' + id
    })
  },
  gotoList(){
    wx.navigateTo({
      url: 'unipay_list'
    })
  }
})
// pages/admin/sale/order_list.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    shop: '',
    statusSelectedIndex: 0,
    startDate: new Date(),
    endDate: new Date(),
    nowDateStr: '',
    statusList:['全部', '待支付', '部分支付', '暂缓支付', '支付完成', '订单关闭']
  },

  statusSelected(e){
    var that = this
    that.setData({statusSelectedIndex: e.detail.value})
  },

  shopSelected(e){
    var that = this
    console.log('shop selected:', e)
    that.setData({shop: e.detail.shop})
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var nowDate = new Date()
    var nowDateStr = nowDate.getFullYear().toString() + '-' + (nowDate.getMonth() + 1).toString() + '-' + nowDate.getDate().toString()
    that.setData({startDate: nowDateStr, endDate: nowDateStr, nowDate: nowDateStr})
    console.log('now date', nowDate)
    app.loginPromiseNew.then(function(resolve) {
      that.setData({role: app.globalData.role})
    })
  },

  startDateSelected(e){
    console.log('start date selected:', e)
    var that = this
    that.setData({startDate: e.detail.value})
  },
  endDateSelected(e){
    var that = this
    that.setData({endDate: e.detail.value})
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
  gotoDetail(){
    wx.navigateTo({
      url: 'order_detail',
    })
  }
})
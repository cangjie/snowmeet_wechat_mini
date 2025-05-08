// pages/admin/maintain/task_list.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    orderList:[],
    totalAmount: 0,
    totalAmountStr: '¥0.00',
    querying: false,
    payOption: ''
  },
  GoBack(){
    wx.redirectTo({
      url: '../admin',
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var end = new Date()
    var start = new Date()
    start.setDate(start.getDate()-1)
    that.setData({start: util.formatDate(start), end: util.formatDate(end)})
    app.loginPromiseNew.then(function (resolve){

      //that.getData()
    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },
  shopSelected(e){
    console.log('shop selected', e)
    var that = this
    that.setData({shop: e.detail.shop})
    //that.getData()
  },
  getData(){
    var that = this
    that.setData({querying: true})
    var getTaskUrl = app.globalData.requestPrefix + 'Order/GetOrdersByStaff'
      + '?type=' + encodeURIComponent('养护') 
      + ((that.data.shop == undefined) ? '' :  ('&shop=' + encodeURIComponent(that.data.shop)))
      + (that.data.payOption == ''? '' :  ('&payOption=' + encodeURIComponent(that.data.payOption)) )
      + '&startDate=' + encodeURIComponent(that.data.start)  
      + '&endDate=' + encodeURIComponent(that.data.end) 
      + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      
    util.performWebRequest(getTaskUrl, undefined).then(function(resolve){
      console.log('maintian orders', resolve)
      that.setData({querying: false})
      var orders = resolve
      var totalTask = 0
      var totalAmount = 0
      for(var i = 0; i < orders.length; i++){
        var order = orders[i]
        totalAmount += order.paidAmount
        order.total_amountStr = util.showAmount(order.total_amount)
        order.discountStr = util.showAmount(order.discount)
        order.ticket_discountStr = util.showAmount(order.ticket_discount)
        order.paidAmountStr = util.showAmount(order.paidAmount)
        order.bizDateStr = util.formatDate(new Date(order.biz_date))
        order.bizTimeStr = util.formatTimeStr(new Date(order.biz_date))
        totalTask += (order.cares == null)? 0 : order.cares.length
        for(var j = 0; j < order.cares.length; j++){
          var care = order.cares[j]
          care.common_chargeStr = util.showAmount(care.common_charge)
          care.repair_chargeStr = util.showAmount(care.repair_charge)
          care.discountStr = util.showAmount(care.discount)
          care.ticket_discountStr = util.showAmount(care.ticket_discount)
          care.summary = care.common_charge + care.repair_charge - care.discount - care.ticket_discount
          care.summaryStr = util.showAmount(care.summary)
        }
      }
      that.setData({orders, totalTask, totalAmountStr: util.showAmount(totalAmount)})
    }).catch(function(){
      that.setData({querying: false})
    })
  },
  /**
   * Lifecycle function--Called when page show
   */
  onShow() {
    var that = this
    that.getData()
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
    console.log('date selected', e)
    var that = this
    that.setData({start: e.detail.start, end: e.detail.end})
    //that.getData()
  },
  gotoDetail(e){
    wx.navigateTo({
      url: 'task_detail?id=' + e.currentTarget.id,
    })
  },
  changePayOption(e){
    var that = this
    that.setData({payOption: e.detail.value})
    //that.data.payOption = e.detail.value
  }
})
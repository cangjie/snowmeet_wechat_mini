// pages/admin/rent/rent_list.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    startDate: util.formatDate(new Date()),
    endDate: util.formatDate(new Date()),
    statusList: ['全部', '已付押金', '全部归还', '已退款', '免押金'],
    statusSelectedIndex: 0,
    shop: '',
    querying: false,
    orderInfo:{
      code: 'abc',
      userName: 'test'
    }
  },

  gotoDetail(e){
    wx.navigateTo({
      url: 'rent_details?id=' + e.currentTarget.id,
    })
  },
  setDate(e){
    var id = e.currentTarget.id
    var dateStr = e.detail.value
    var that = this
    //var date = util.formatDateString(dateStr)
    switch(id){
      case 'start':
        that.setData({startDate: dateStr})
        break
      case 'end':
        that.setData({endDate: dateStr})
        break
      default:
        break
    }
  },
  setStatus(e){
    var that = this
    that.setData({statusSelectedIndex: e.detail.value})
  },

  shopSelected(e){
    var that = this
    that.setData({shop: e.detail.shop})
  },
  GoBack(){
    wx.redirectTo({
      url: '../admin',
    })
  },
  getData(){
    var that = this
    that.setData({querying: true})
    var totalPaid = 0
    var totalRefund = 0
    var qUrl = app.globalData.requestPrefix + 'Order/GetOrdersByStaff?type=' + encodeURIComponent('租赁') + '&sessionKey=' + app.globalData.sessionKey
     + '&startDate=' + encodeURIComponent(that.data.startDate) + '&endDate=' + encodeURIComponent(that.data.endDate) 
     + (that.data.shop == ''? '' : '&shop=' + encodeURIComponent(that.data.shop))
     //+ (that.data.statusSelectedIndex == 0 ? '' : '&status=' + encodeURIComponent(that.data.statusList[that.data.statusSelectedIndex]))
    console.log('q url', qUrl)
    util.performWebRequest(qUrl, undefined).then(function(resolve){
      console.log('get rent orders', resolve)
      var orders = resolve
      for(var i = 0; i < orders.length; i++){
        var order = orders[i]
        if (order.biz_date){
          var bizDate = new Date(order.biz_date)
          order.biz_dateDateStr = util.formatDate(bizDate)
          order.biz_dateTimeStr = util.formatTimeStr(bizDate)
        }
        else{
          order.biz_dateDateStr = '——'
          order.biz_dateTimeStr = '——'
        }
        if (order.rentalLastRefundDate){
          var rDate = new Date(order.rentalLastRefundDate)
          order.rentalLastRefundDateDateStr = util.formatDate(rDate)
          order.rentalLastRefundDateTimeStr = util.formatTimeStr(rDate)
        }
        else {
          order.rentalLastRefundDateDateStr = '——'
          order.rentalLastRefundDateTimeStr = '——'
        }
        order.guarantyAmountStr = util.showAmount(order.guarantyAmount)
        totalPaid += order.guarantyAmount
      }
      that.setData({querying: false, orders: orders, totalPaidStr: util.showAmount(totalPaid)})
    }).catch(function(){
      that.setData({querying: false})
    })
  },
  getData1(){
    var that = this
    that.setData({querying: true})
    var totalPaid = 0
    var totalRefund = 0
    var qUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentOrderListByStaff?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
     + '&start=' + encodeURIComponent(that.data.startDate) + '&end=' + encodeURIComponent(that.data.endDate) 
     + (that.data.shop == ''? '' : '&shop=' + encodeURIComponent(that.data.shop))
     + (that.data.statusSelectedIndex == 0 ? '' : '&status=' + encodeURIComponent(that.data.statusList[that.data.statusSelectedIndex]))
    console.log('q url', qUrl)
    wx.request({
      url: qUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){
          var orders = res.data
          for(var i = 0; i < orders.length; i++){
            var dueEndDate = new Date(orders[i].due_end_date)
            var createDate = new Date(orders[i].create_date)
            orders[i].due_end_date_str = util.formatDate(dueEndDate) + ' ' + util.formatTimeStr(dueEndDate)
            orders[i].create_dateStr = util.formatDate(createDate) + ' ' + util.formatTimeStr(createDate)
            orders[i].totalChargeStr = util.showAmount(orders[i].totalCharge)
            if (orders[i].end_date != null){
              var endDate = new Date(orders[i].end_date)
              orders[i].end_dateStr = util.formatDate(endDate) + ' ' + util.formatTimeStr(endDate)
            }
            else {
              orders[i].end_dateStr = '--'
            }
            
            orders[i].deposit_final_str = util.showAmount(orders[i].deposit_final)
            totalPaid = totalPaid + orders[i].deposit_final
            totalRefund = totalRefund + orders[i].refund
            if (orders[i].discount > 0 || orders[i].ticketDiscount > 0
              || orders[i].noDeposit ||  orders[i].status == '已退款'
              ||  orders[i].status == '已完成' ){
              orders[i].textColor = '#FF0000'
            }
            else if (orders[i].status == '已关闭'){
              orders[i].textColor = '#C0C0C0'
            }
            else {
              orders[i].textColor = ''
            }
            if (orders[i].pay_option == '招待'){
              orders[i].backColor = 'yellow'
            }
            else {
              orders[i].backColor = ''
            }
            if (orders[i].status == '未支付'){
              orders[i].statusTextColor = '#FF0000'
            }
          }
          console.log('get orders', orders)
          that.setData({orders: orders, totalPaidStr: util.showAmount(totalPaid), 
            totalRefundStr: util.showAmount(totalRefund)})
        }
      },
      complete:(res)=>{
        that.setData({querying: false})
      }
    })
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

  }
})
// pages/admin/rent/rent_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    showCreditGallery: false
  },

  showGallery(e){
    var that = this
    var id = e.currentTarget.id
    if (id.indexOf('credit')>=0){
      that.setData({showCreditGallery: true})
    }
  },

  getData(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentOrder/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){
          var rentOrder = res.data
          rentOrder.guarantee_credit_photos_arr = rentOrder.guarantee_credit_photos.split(',')
          
          rentOrder.deposit_real_str = util.showAmount(rentOrder.deposit_real)
          rentOrder.deposit_reduce_str = util.showAmount(rentOrder.deposit_reduce)
          rentOrder.deposit_final_str = util.showAmount(rentOrder.deposit_final)
          var dueEndTime = new Date(rentOrder.due_end_date)
          rentOrder.due_end_time_str = util.formatDate(dueEndTime) + ' ' + util.formatTimeStr(dueEndTime)
          if (rentOrder.order_id > 0){
            var payTime = new Date(rentOrder.order.payments[0].create_date)
            rentOrder.paidTimeStr = util.formatDate(payTime) + ' ' + util.formatTimeStr(payTime)
            rentOrder.outTradeNo = rentOrder.order.payments[0].out_trade_no
          }
          else{
            rentOrder.paidTimeStr = '-'
            rentOrder.outTradeNo = '-'
          }
          for(var i = 0; i < rentOrder.details.length; i++)
          {
            var detail = rentOrder.details[i]
            detail.suggestRental_str = util.showAmount(detail.suggestRental)
            if (detail.status == '未归还'){
              detail.real_rental = detail.suggestRental
            }
            
            detail.unit_rental_str = util.showAmount(detail.unit_rental)
            detail.deposit_str = util.showAmount(detail.deposit)
            detail.refund_str = util.showAmount(detail.deposit - detail.real_rental)
            rentOrder.details[i] = detail

          }
          that.setData({rentOrder: rentOrder})
        }
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var id = options.id
    that.setData({id: id})
    app.loginPromiseNew.then(function(resolve){
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

  }
})
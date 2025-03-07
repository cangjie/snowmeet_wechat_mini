// pages/admin/rent/set_award.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    noM7OrderId: false
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
    app.loginPromiseNew.then(function(resolve){
      that.getRentOrder()
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
  getRentOrder(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentOrder/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var rentOrder = res.data
        rentOrder.create_dateStr = util.formatDate(new Date(rentOrder.create_date))
        rentOrder.unRefundedAmount = rentOrder.totalCharge - rentOrder.totalRefund
        rentOrder.unRefundedAmountStr = util.showAmount(rentOrder.unRefundedAmount)
        for(var i = 0; i < rentOrder.payments.length; i++){
          var p = rentOrder.payments[i]
          p.create_dateStr = util.formatDate(new Date(p.create_date))
          p.unRefundedAmountStr = util.showAmount(p.unRefundedAmount)
        }
        that.setData({rentOrder})
      }
    })
  },
  selectRefundItem(e){
    var that = this
    console.log('set refund', e)
    var rentOrder = that.data.rentOrder
    
    var payments = rentOrder.payments
    for(var i = 0; payments && i < payments.length; i++){
      var payment = payments[i]
      payment.checked = false
      for(var j = 0; j < e.detail.value.length; j++){
        if (payment.id == parseInt(e.detail.value[j])){
          payment.checked = true
          break
        }
      }
    }
    that.setData({rentOrder})
  },
  setNoMi7OrderId(e){
    var that = this
    
  }
})
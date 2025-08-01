// pages/admin/fd/fd_order_confirm.js
const app = getApp()
const util = require('../../../utils/util.js')
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
    that.setData({orderId: options.orderId})
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
    app.loginPromiseNew.then(function(resovle){
      that.setData({staff: app.globalData.staff})
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
    var getUrl = app.globalData.requestPrefix + 'Order/GetOrderByStaff/' + that.data.orderId + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, null).then(function(resolve){
      console.log('order', resolve)
      var order = resolve
      order.total_amountStr = util.showAmount(order.total_amount)
      order.totalChargeStr = util.showAmount(order.totalCharge)
      that.setData({order})
    })
  },
  fillDiscount(e){
    var that = this
    var value = e.detail.value
    that.setData({filledDiscount: value})
  },
  setDiscount(e){
    var that = this
    var filledDiscount = that.data.filledDiscount
    if (isNaN(filledDiscount)){
      wx.showToast({
        title: '减免必须是数字',
        icon: 'error'
      })
      return
    }
    var setUrl = app.globalData.requestPrefix + 'Order/SetDiscount/' + that.data.order.id + '?discountAmount=' + that.data.filledDiscount + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(setUrl, null).then(function (resolve){
      var discounts = resolve
      if (discounts == null){
        wx.showToast({
          title: '设置失败',
          icon: 'error'
        })
        return
      }
      wx.showToast({
        title: '设置成功',
        icon: 'success'
      })
      that.getData()
    })
  },
  setMemo(e){
    var that = this
    var memo = e.detail.value
    var order = that.data.order
    order.memo = memo
    var updateUrl = app.globalData.requestPrefix + 'Order/UpdateOrderByStaff?scene=' + encodeURIComponent('修改订单备注') + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(updateUrl, order).then(function(resolve){
      var order = resolve
      console.log('order memo', order.memo)
    })
  },
  setPayMethod(e){
    var that = this
    var paymethod = e.detail.value
    var order = that.data.order
    var getUrl = app.globalData.requestPrefix + 'Order/'
    switch(paymethod){
      case '支付宝':
        getUrl += 'GetAlipayPaymentQrCode/' + order.id.toString() + '?sessionKey=' + app.globalData.sessionKey
        break
      default:
        break
    }
    util.performWebRequest(getUrl, null).then(function(resolve){
      console.log('get ali qr', resolve)
    })
  }
})
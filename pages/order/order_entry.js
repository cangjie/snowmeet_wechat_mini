// pages/order/order_entry.js
const app = getApp()
const util = require('../../utils/util.js')
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
    var orderId = options.orderId
    var that = this
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
    app.loginPromiseNew.then(function(resolve){
      var getUrl = app.globalData.requestPrefix + 'Order/GetOrderByCustomer/' + that.data.orderId.toString() + '?sessionKey=' + app.globalData.sessionKey
      util.performWebRequest(getUrl, null).then(function (resolve){
        var order = resolve
        console.log('get order', order)
        //that.setData({order})
        switch(order.type){
          case '餐饮':
            wx.setNavigationBarTitle({
              title: '请您确认订单并支付',
            })
            that.renderFdOrder(order)
            break
          default:
            break
        }
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
  renderFdOrder(order){
    var that = this
    var total = 0
    for(var i = 0; i < order.fdOrders.length; i++){
      var fdOrder = order.fdOrders[i]
      fdOrder.unit_priceStr = util.showAmount(fdOrder.unit_price)
      fdOrder.summary = fdOrder.count * fdOrder.unit_price
      total += fdOrder.summary
      fdOrder.summaryStr = util.showAmount(fdOrder.summary)
    }
    order.total = total
    order.totalStr = util.showAmount(total)
    order.discountAmountStr = util.showAmount(order.discountAmount)
    order.totalChargeStr = util.showAmount(order.totalCharge)
    that.setData({order})
  },
  pay(){
    var that = this
    var order = that.data.order
    var payUrl = app.globalData.requestPrefix + 'Order/WechatPay/' + order.id.toString() + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(payUrl, null).then(function (resolve){
      console.log('payment', resolve)
      var payment = resolve
      wx.requestPayment({
        nonceStr: payment.nonce,
        package: 'prepay_id=' + payment.prepay_id,
        paySign: payment.sign,
        timeStamp: payment.timestamp,
        signType: 'MD5',
        success:(res)=>{
          wx.showToast({
            title: '支付成功',
            icon: 'success'
          })
        },
        fail:(res)=>{
          console.log('payment fail', res)
        }
      })
    })
  }
})
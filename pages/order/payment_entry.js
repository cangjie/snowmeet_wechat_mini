// pages/order/payment_entry.js
const app = getApp()
const data = require('../../utils/data.js')
const util = require('../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    paying: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var paymentId = options.paymentId
    var that = this
    that.setData({paymentId})
    if (options.q != undefined){
      var url = decodeURIComponent(options.q)
      console.log('scan url', url)
      var urlArr = url.split('?')
      var queryStr = urlArr[urlArr.length - 1]
      paymentId = parseInt(queryStr.replace('paymentId=', ''))
      that.setData({paymentId})
    }
  },
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {
    var that = this
    app.loginPromiseNew.then(function (resolve){
      data.getOrderFromPaymentByCustomer(that.data.paymentId, app.globalData.sessionKey).then(function (order){
        that.renderData(order)
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
  renderData(order){
    var that = this
    order.paying_amountStr = util.showAmount(order.paying_amount)
    order.paidAmountStr = util.showAmount(order.paidAmount)
    order.dataStr = util.formatDate(new Date(order.biz_date))
    order.timeStr = util.formatTimeStr(new Date(order.biz_date))
    var payment = null
    for (var i = 0; order.payments && i < order.payments.length; i++){
      if (order.payments[i].valid == 1 && order.payments[i].pay_method == '微信支付' && order.payments[i].status == '待支付'){
        payment = order.payments[i]
      }
    }
    that.setData({order, payment})
  },
  pay(){
    var that = this
    that.setData({paying: true})
    var payment = that.data.payment
    //var order = that.data.order
    if (payment.pay_method != '微信支付' || payment.status != '待支付'){
      wx.showToast({
        title: '不可支付',
        icon: 'error'
      })
      return
    }
    var payUrl = app.globalData.requestPrefix + 'Order/WechatPayByOrderPayment/' + payment.id + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(payUrl, null).then(function (payment){
      wx.requestPayment({
        nonceStr: payment.nonce,
        package: 'prepay_id=' + payment.prepay_id,
        paySign: payment.sign,
        timeStamp: payment.timestamp,
        signType: 'MD5',
        success: (res) => {
          wx.showToast({
            title: '支付成功',
            icon: 'success'
          })
          data.getOrderFromPaymentByCustomer(payment.id, app.globalData.sessionKey).then(function (order){
            /*
            var currentPayment = null
            for(var i = 0; i < order.payments.length; i++){
              if (order.payments[i].id == payment.id){
                currentPayment = order.payments[i]
                break
              }
            }
            */
            //that.setData({payment: currentPayment})
            that.renderData(order)
            //that.setData({payment: currentPayment})
          })
        },
        fail: (res) => {
          console.log('payment fail', res)
          that.setData({paying: false})
        }
      })
    })
  }
})
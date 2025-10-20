// pages/admin/fire/fire_order_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
Page({

  /**
   * Page initial data
   */
  data: {
    refunding: false
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
    app.loginPromiseNew.then(function (resolve){
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
    data.getOrderByStaffPromise(that.data.id, app.globalData.sessionKey).then(function (order){
      console.log('order', order)
      order.dateStr = util.formatDate(new Date(order.biz_date))
      order.timeStr = util.formatTimeStr(new Date(order.biz_date))
      order.paidAmountStr = util.showAmount(order.paidAmount)
      var payMethod = ''
      for(var i = 0; i < order.payments.length; i++){
        if (order.payments[i].status = '支付成功' && order.payments[i].valid == 1){
          payMethod = order.payments[i].pay_method
        }
      }
      order.payMethod = payMethod
      order.refundAmountStr = util.showAmount(order.refundAmount)
      that.setData({order})
    })
  },
  refund(e){
    var that = this
    var order = that.data.order
    var paidAmount = order.paidAmount
    var refundedAmount = order.refundAmount
    var refundAmount = that.data.refundAmount
    that.setData({refunding: true})
    if (isNaN(refundAmount)){
      wx.showToast({
        title: '未填写退款金额',
        icon: 'error'
      })
      return
    }
    if (refundAmount + refundedAmount > paidAmount){
      wx.showToast({
        title: '超额退款',
        icon: 'error'
      })
      return
    }
    wx.showModal({
      title: '确认退款',
      content: '退款金额：'+util.showAmount(refundAmount),
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          var payment= null
          for(var i = 0; order && order.availablePayments && i < order.availablePayments.length; i++){
            console.log('refund amount', order.availablePayments[i].unRefundedAmount)
            var paymentUnRefund = parseFloat(order.availablePayments[i].unRefundedAmount.toString())
            if (order.availablePayments[i].status == '支付成功'
              && paymentUnRefund >= parseFloat(refundAmount)){
              payment = order.availablePayments[i]
              break
            }
          }
          if (payment == null){
            wx.showToast({
              title: '无可退款支付记录',
              icon:'error'
            })
            return
          }
          var refunds = [{
            payment_id: payment.id,
            amount: refundAmount,
            reason: '临时租赁退押金'
          }]
          data.refundPromise(order.id, refunds, app.globalData.sessionKey).then(function (order){
            that.getData()
            wx.showToast({
              title: '退款成功',
              icon: 'success'
            })
          })
    
        }
      }
    })
  },
  setRefundAmount(e){
    var that = this
    var value = e.detail.value
    if (!isNaN(value)){
      that.setData({refundAmount: parseFloat(value)})
    }
  }
})
// pages/admin/unipay/unipay_detail.js
const app = getApp()
const data = require('../../../utils/data.js')
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    modding: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.data.id = options.id
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
  mod(){
    var that = this
    that.setData({modding: true})
  },
  cancel(){
    var that = this
    that.getData()
    that.setData({modding: false})
    
  },
  getData(){
    var that = this
    data.getOrderByStaffPromise(that.data.id, app.globalData.sessionKey)
      .then(function (order){
        util.renderUnipayOrder(order)
        that.setData({order})
      })
  },
  /*
  renderOrder(order){
    var that = this
    order.paidAmountStr = util.showAmount(order.paidAmount)
    var bizDate = new Date(order.biz_date)
    order.biz_dateStr = util.formatDate(bizDate)
    order.biz_timeStr = util.formatTimeStr(bizDate)
  },
  */
  setMemo(e){
    var that = this
    var order = that.data.order
    var value = e.detail.value
    order.memo = value
  },
  confirm(e){
    var that = this
    var order = that.data.order
    data.updateOrderPromise(order, '聚合支付详情页修改备注', app.globalData.sessionKey)
      .then(function (order){
        that.renderOrder(order)
        that.setData({order, modding: false})
        wx.showToast({
          title: '修改成功',
          duration: 2000,
          icon: 'success'

        })
      })
  },
  setRefundAmount(e){
    var that = this
    var value = e.detail.value
    if (isNaN(value)){
      return
    }
    that.data.refundAmount = parseFloat(value)
  },
  refund(){
    var that = this
    var refundAmount = that.data.refundAmount
    var order = that.data.order
    if (refundAmount == null || refundAmount == '' || isNaN(refundAmount)){
      wx.showToast({
        icon:'error',
        title:'退款金额不对',
        duration: 2000
      })
      return
    }
    refundAmount = parseFloat(refundAmount)
    if (refundAmount > parseFloat((order.paidAmount - order.refundAmount).toFixed(2))){
      wx.showToast({
        icon:'error',
        title:'超额退款',
        duration: 2000
      })
      return
    }
    var refund = {
      id: 0,
      payment_id: order.availablePayments[0].id,
      amount: parseFloat(refundAmount),
      reason: '聚合支付退款'
    }
    data.refundPromise(order.id, [refund], app.globalData.sessionKey)
      .then(function(order){
        wx.showToast({
          icon: 'success',
          title: '退款成功',
          duration: 2000,
          success:()=>{
            util.renderUnipayOrder(order)
            that.setData()
          }
        })
      })
  }
})
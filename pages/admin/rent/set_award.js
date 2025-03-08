// pages/admin/rent/set_award.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    noM7OrderId: false,
    isMyOwnMi7Order: true,
    refundAmount: 0,
    refundAmountStr: '¥0.00'
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
        var totalRewardAmount = rentOrder.totalRewardAmount
        for(var i = 0; rentOrder.rewards && i < rentOrder.rewards.length; i++){
          rentOrder.rewards[i].create_dateStr = util.formatDate(new Date(rentOrder.rewards[i].create_date))
          rentOrder.rewards[i].mi7Order.real_chargeStr = util.showAmount(rentOrder.rewards[i].mi7Order.real_charge)
          rentOrder.rewards[i].totalRefundAmountStr = util.showAmount(rentOrder.rewards[i].totalRefundAmount)
        }
        that.setData({rentOrder, totalRewardAmount, 
          totalRewardAmountStr: util.showAmount(totalRewardAmount)})
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
    var value = e.detail.value
    that.setData({noM7OrderId: value})
  },
  inputMi7OrderId(e){
    var that = this
    var value = e.detail.value

    if (value.length < 15){
      return
    }
    var url = 'https://' + app.globalData.domainName + '/core/Mi7Order/GetMi7Order/' + value + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        console.log('get mi 7 order', res)
        var mi7Order = res.data
        var payTime = new Date(mi7Order.order.pay_time)
        mi7Order.order.pay_timeStr = util.formatDate(payTime)
        //mi7Order.order.paidAmountStr = util.showAmount(mi7Order.order.paidAmount)
        mi7Order.real_chargeStr = util.showAmount(mi7Order.real_charge)
        var rentOrder = that.data.rentOrder
        var isMyOwnMi7Order = true
        if (mi7Order.order && mi7Order.order.member && rentOrder.order && rentOrder.order.member
          && mi7Order.order.member.id != rentOrder.order.member.id ){
            isMyOwnMi7Order = false
        }
        else{
          isMyOwnMi7Order = true
        }
        if (!mi7Order.order.member){
          isMyOwnMi7Order = false
        }
        that.setData({mi7Order, isMyOwnMi7Order, mi7OrderId: value})
      }
    })
  },
  setRefundAmount(e){
    var that = this
    that.setData({refundAmount: e.detail.value})
    var rentOrder = that.data.rentOrder
    var payment = rentOrder.payments[0]
    payment.checked = true
    payment.filledRefundAmount = isNaN(e.detail.value)? undefined : parseFloat(e.detail.value)
    that.setData({rentOrder})
  },
  setMemo(e){
    var that = this
    that.setData({memo: e.detail.value})
  },
  checkValid(){
    var that = this
    var msg = ''
    if (!that.data.noM7OrderId && (!that.data.mi7OrderId || that.data.mi7OrderId == '')){
      msg = '七色米订单号未填'
    }
    if (isNaN(that.data.refundAmount)){
      msg = '抵扣金额必须是数字'
    }
    if (msg != ''){
      wx.showToast({
        title: msg,
        icon: 'error'
      })
      return false
    }
    else{
      return true
    }
  },
  setSubRefundAmount(e){
    var that = this
    var id = e.currentTarget.id
    var rentOrder = that.data.rentOrder
    var value = e.detail.value
    rentOrder.payments[id].filledRefundAmount = value
    var totalRefund = 0;
    for(var i = 0; i < rentOrder.payments.length; i++){
      var payment = rentOrder.payments[i]
      if (payment.checked && !isNaN(payment.filledRefundAmount)){
        totalRefund += parseFloat(payment.filledRefundAmount)
      }
    }
    that.setData({rentOrder, refundAmount: totalRefund, refundAmountStr: util.showAmount(totalRefund)})
  },
  save(e){
    var that = this
    if (!that.checkValid()){
      return
    }
    var rentOrder = that.data.rentOrder
    var mi7OrderId = that.data.mi7OrderId
    if (that.data.noM7OrderId){
      mi7OrderId = null
    }
    var rentReward = {
      id: 0,
      rent_list_id: rentOrder.id,
      mi7_order_id: mi7OrderId,
      memo: that.data.memo? that.data.memo: null,
      amount: that.data.refundAmount
    }
    var rentRewardRefunds = []
    for(var i = 0; i < rentOrder.payments.length; i++){
      var payment = rentOrder.payments[i]
      if (payment.checked && !isNaN(payment.filledRefundAmount)){
        var rewardRefund = {
          id: 0,
          rent_reward_id: 0,
          payment_id: payment.id,
          amount: parseFloat(payment.filledRefundAmount)
        }
        rentRewardRefunds.push(rewardRefund)
      }
      
    }
    rentReward.rentRewardRefunds = rentRewardRefunds
    var url = 'https://' + app.globalData.domainName + '/core/Rent/RewardRefund?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'POST',
      data: rentReward,
      success: (res)=>{
        if (res.statusCode != 200){
          return
        }
      }
    })
  }
})
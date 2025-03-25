// pages/admin/sale/order_detail.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    isOrderInfoReady: false,
    payMethod: '微信支付',
    chargeAmount: 0,
    showModal: false,
    refunding: false
  },
  goHome(){
    wx.redirectTo({
      url: '../admin',
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var orderId = parseInt(options.id)
    that.setData({orderId})
    
  },

  modMi7OrderNo(e){
    var id = e.currentTarget.id
    console.log('mi7 order id', e)
    wx.navigateTo({
      url: 'mod_mi7_order_no?id=' + id,
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
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.setData({role: app.globalData.role})
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
  charge(){
    var that = this
    
    wx.pageScrollTo({
      duration: 0,
      scrollTop: 100000
    })
    
    that.setData({showModal: true})
  },
  confirmCharge(){
    var that = this
    var amount = that.data.chargeAmount
    var order = that.data.order
    if (amount==0){
      amount = order.final_price - order.paidAmount
    }
    var title = '确认已经收到用户通过' + that.data.payMethod + '支付的¥' + amount + '了吗？' 
    if (that.data.payMethod == '微信支付'){
      title = '请用户扫描下方二维码，支付¥' + amount
    }
    wx.showModal({
      cancelColor: 'cancelColor',
      title: title,
      success:(res)=>{
        console.log('confirm payment', res)
        if (res.cancel){
          that.setData({showModal: false})
        }
        if (res.confirm){
          var rechargeUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/OrderChargeByStaff/' + order.id + '?amount=' + encodeURIComponent(amount) + '&payMethod=' + encodeURIComponent(that.data.payMethod) + '&staffSessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: rechargeUrl,
            method: 'GET',
            success:(res)=>{
              var getOrderUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/GetWholeOrderByStaff/' + order.id + '?staffSessionKey=' + encodeURIComponent(app.globalData.sessionKey)
              wx.request({
                url: getOrderUrl,
                method: 'GET',
                success:(res)=>{
                  that.setData({showModal: false, order: res.data})
                  
                }
              })
            }
          })
          
        }
      }
    })

  },
  payMethodChanged(e){
    var that = this
    that.setData({payMethod: e.detail.payMethod})
  },
  setChargeAmount(e){
    var that = this
    var amount = parseFloat(e.detail.value)
    if (isNaN(amount)){
      wx.showToast({
        title: '请填写正确的支付金额',
        icon: 'none'
      })
    }
    else{
      that.setData({chargeAmount: amount})
    }
  },
  hideModal(){
    this.setData({showModal: false})
  },
  setMemo(e){
    var that = this
    var order = that.data.order
    order.memo = e.detail.value
    that.setData({order: order})
    var setUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/SetOrderMemo/' + order.id + '?sessionKey=' +  encodeURIComponent(app.globalData.sessionKey) + '&memo=' + encodeURIComponent(e.detail.value)
    wx.request({
      url: setUrl,
      method: 'GET',
      success:(res)=>{

      },
      complete:(res)=>{
        
      }
      
    })

  },
  getData(){
    var that = this
    var getOrderUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/GetWholeOrderByStaff/' + that.data.orderId + '?staffSessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getOrderUrl,
      method: 'GET',
      success:(res)=>{
        var order = res.data
        order.date = util.formatDate(new Date(order.create_date))
        order.time = util.formatTimeStr(new Date(order.create_date))
        for(var i = 0; i < order.payments.length; i++){
          var payment = order.payments[i]
          payment.date = util.formatDate(new Date(payment.create_date))
          payment.time = util.formatTimeStr(new Date(payment.create_date))
          payment.amountStr = util.showAmount(payment.amount)
          payment.refundStr = util.showAmount(payment.refundedAmount)
        }
        for(var i = 0; order.refunds && i < order.refunds.length; i++){
          var r = order.refunds[i]
          var createDate = new Date(r.create_date)
          r.dateStr = util.formatDate(createDate)
          r.timeStr = util.formatTimeStr(createDate)
          r.staffName = '——'
          r.amountStr = util.showAmount(r.amount)
          if (r.msa && r.msa.member){
            r.staffName = r.msa.member.real_name
          }
        }
        that.setData({order: order, isOrderInfoReady: true})
      }
    })
  },
  refundInput(e){
    var that = this
    var id = e.currentTarget.id
    var value = e.detail.value
    switch(id){
      case 'reason':
        that.setData({reason: value})
        break
      case 'refundAmount':
        that.setData({refundAmount: value})
        break
      default:
        break
    }
  },
  refund(e){
    var id = e.currentTarget.id
    var that = this
    var msg = ''
    if (!that.data.reason || that.data.reason == ''){
      msg = '必须填写退款原因'
    }
    if (!that.data.refundAmount || isNaN(that.data.refundAmount)){
      msg = '退款金额是数字'
    }
    if (msg != ''){
      wx.showToast({
        title: msg,
        icon: 'error'
      })
      return
    }
    that.setData({refunding: true})
    wx.showModal({
      title: '确认退款',
      content: '该操作不可逆，且店长以下操作会失败。是否确认？',
      complete: (res) => {
        if (res.cancel) {
          that.setData({refunding: false})
        }
    
        if (res.confirm) {
          var refundUrl = 'https://' + app.globalData.domainName + '/core/OrderPayment/Refund/' + id + '?amount=' + that.data.refundAmount + '&reason=' + encodeURIComponent(that.data.reason) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
          wx.request({
            url: refundUrl,
            method: 'GET',
            success:(res)=>{
              if (res.statusCode != 200){
                wx.showToast({
                  title: '退款失败',
                  icon: 'error'
                })
              }
              wx.showToast({
                title: '退款成功',
                icon: 'success'
              })
            },
            complete:(res)=>{
              that.setData({refunding: false})
              that.getData()
            }
          })
        }
      }
    })
  }
})
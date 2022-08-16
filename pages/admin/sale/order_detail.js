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
    showModal: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.setData({role: app.globalData.role})
      var orderId = parseInt(options.id)
      var getOrderUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/GetWholeOrderByStaff/' + orderId + '?staffSessionKey=' + encodeURIComponent(app.globalData.sessionKey)
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
          }
          that.setData({order: order, isOrderInfoReady: true})
        }
      })
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
  }
})
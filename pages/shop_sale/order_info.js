// pages/shop_sale/order_info.js
const app = getApp()
const util = require('../../utils/util')
Page({

  /**
   * Page initial data
   */
  data: {
    scene: '',
    orderId: 0,
    title: '订单信息',
    needAuth: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      var getOrderUrl = ''
      if (options.paymentId != undefined){
        that.setData({paymentId: options.paymentId})
        getOrderUrl = 'https://' + app.globalData.domainName + '/core/OrderPayment/GetWholeOrder/' + that.data.paymentId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      }
      else if (options.orderId != undefined){
        that.setData({orderId: options.orderId})
        getOrderUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/GetOrderOnline/' + that.data.orderId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      }
      
      wx.request({
        url: getOrderUrl,
        method: 'GET',
        success:(res)=>{
          console.log('get order', res)
          var scene = ''
          var order = res.data
          order.final_price_str = util.showAmount(order.final_price)
          order.order_price_str = util.showAmount(order.order_price)
          order.order_real_pay_price_str = util.showAmount(order.order_real_pay_price)
          order.other_discount_str = util.showAmount(order.other_discount)
          order.ticket_amount_str = util.showAmount(order.ticket_amount)
          var title = '订单信息'
          if (order.status == '待支付'){
            scene = 'payment'
            title = '确认支付'
            if (that.data.paymentId == undefined && order.payments.length > 0){
              that.setData({paymentId: order.payments[0].id})
            }
          }
          that.setData({order: order, scene: scene, title: title, needAuth: true})
        }
      })
      
    })
 
    
  },

  submitPayment(){
    var that = this
    var paymentUrl = 'https://' + app.globalData.domainName + '/core/OrderPayment/TenpayRequest/' + that.data.paymentId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: paymentUrl,
      method: 'GET',
      success:(res)=>{
        console.log(res)
        wx.requestPayment({
          nonceStr: res.data.nonce,
          package: 'prepay_id=' + res.data.prepay_id,
          paySign: res.data.sign,
          timeStamp: res.data.timeStamp,
          signType: 'MD5',
          success:(res)=>{
            console.log(res)
            wx.showToast({
              title: '支付完成',
              icon: 'none',
              success:(res)=>{
                that.setData({scene: '', title: '订单信息'})
              }
            })
          },
          fail:(res)=>{
            console.log(res)
          }
        })
      }
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
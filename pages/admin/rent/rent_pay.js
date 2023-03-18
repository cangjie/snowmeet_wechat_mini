// pages/admin/rent/rent_pay.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    needPay: true,
    payMethod: '',
    orderGetted: false
  },
  modPayMethod(e){
    var that = this
    var payMethod = e.detail.payMethod
    that.setData({payMethod: payMethod})
    var rentOrder = that.data.rentOrder
    var payment = rentOrder.order.payments[0]
    
    if (payment != undefined && payment.status == '待支付'){
      var modPayMethodUrl = 'https://' + app.globalData.domainName + '/core/OrderPayment/ModPayMethod/' + payment.id + '?paymethod=' + encodeURIComponent(payMethod) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: modPayMethodUrl,
        method: 'GET',
        success:(res)=>{
          wx.redirectTo({
            url: '?id=' + that.data.id,
          })
        }
      })
    }
    
    console.log('rent order', rentOrder)
  },
  checkOrderPaymentStatus(){
    var that = this
    var orderId = that.data.rentOrder.id
    var getUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentOrder/' + orderId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){
          var rentOrder = res.data
          if (rentOrder.order_id > 0 && rentOrder.order != undefined && rentOrder.order != null && rentOrder.order.pay_state == 1){
            clearInterval(that.data.interval)
            wx.showToast({
              title: '支付成功',
              icon: 'success',
              duration: 1000,
              success:()=>{
                wx.redirectTo({
                url: '../admin'
                })
              }
            })
          }
        }
      }
    })
  },
  setPaid(){
    var that = this
    var rentOrder = that.data.rentOrder
    var setUrl = 'https://' + app.globalData.domainName + '/core/Rent/SetPaid/' + rentOrder.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){
          wx.showToast({
            title: '支付成功',
            icon: 'success',
            duration: 1000,
            success:()=>{
              wx.redirectTo({
                url: '../admin',
              })
            }
          })
        }
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var id = options.id
    var that = this
    app.loginPromiseNew.then(function (resolve){
      var getDataUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentOrder/' + id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getDataUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode == 200){
            that.setData({orderGetted: true})
            var rentOrder = res.data
            var needPay = true
            var payMethod = ''
            if (rentOrder.order == null || rentOrder.order == undefined){
              needPay = false
            }
            if (rentOrder.order.payments != null && rentOrder.order.payments != undefined){
              payMethod = rentOrder.order.payments[0].pay_method
            }
            if (payMethod == '微信支付'){
              var wxaCodeUrl = 'http://weixin.snowmeet.top/show_wechat_temp_qrcode.aspx?scene=pay_payment_id_' + rentOrder.order.payments[0].id
              that.setData({needPay: true, rentOrder: rentOrder, wxaCodeUrl: wxaCodeUrl, payMethod: payMethod})
              var interval = setInterval(() => {
                that.checkOrderPaymentStatus()
              }, 1000);
              that.setData({interval: interval})
            }
            else{
              if (rentOrder.open_id == ''){
                var wxaCodeUrl = 'http://weixin.snowmeet.top/show_wechat_temp_qrcode.aspx?scene=bind_rent_' + rentOrder.id
                that.setData({needPay: true, rentOrder: rentOrder, wxaCodeUrl: wxaCodeUrl, payMethod: payMethod})
              }
              else{
                that.setData({needPay: true, rentOrder: rentOrder, payMethod: payMethod})
              }
              
            }
            //that.setData({rentOrder: rentOrder, needPay: needPay, payMethod: payMethod})

          }
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

  }
})
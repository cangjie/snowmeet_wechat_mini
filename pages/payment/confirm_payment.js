// pages/payment/confirm_payment.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    id:0,
    controller: '',
    action: '',
    doValidCell: false,
    paySuccess: false,
    doValidInfo: false,
    payMessage: ['系统正在为您生成订单。']
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    this.data.controller = options.controller
    this.data.action = options.action
    this.data.id = options.id
    app.loginPromiseNew.then(function(resolve){
      if (resolve == null || resolve.cellNumber == null || resolve.cellNumber.trim() == ''){
        that.setData({doValidCell: true})
      }
      else {
        that.placeOrder()
      }
    })
  },
  placeOrder: function(){
    var that = this
    var placeOrderUrl = 'https://' + app.globalData.domainName + '/core/' + this.data.controller + '/' + this.data.action + '/' + this.data.id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: placeOrderUrl,
      method: 'GET',
      success:(res)=>{
        var orderId = res.data.id
        var msg = that.data.payMessage
        if (orderId == undefined){
          msg.push('订单生成失败，也许是因为这个订单您已经支付过了，请联系店员核实。')
          that.setData({payMessage: msg})
          return
        }
        msg.push('您的订单号是：' + orderId + '，请耐心等待系统正在加密您的支付信息。')
        that.setData({payMessage: msg})
        console.log('Order created.', res)
        that.setData({orderId: res.data.id})
        var wepayUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/Pay/'+orderId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: wepayUrl,
          method: 'GET',
          success:(res)=>{
            console.log('prepay', res)
            msg.push('请注意：支付准备已经完成，您即将被要求在手机上输入微信支付密码，请注意保护您的隐私及资金安全。')
            that.setData({payMessage: msg})
            var wepay = res.data
            wx.requestPayment({
              nonceStr: wepay.nonce,
              package: 'prepay_id=' + wepay.prepay_id,
              paySign: wepay.sign,
              timeStamp: wepay.timestamp,
              signType: 'RSA',
              success: (res) => {
                console.log('pay success', res)  

              }
            })
          }
        })
      }
    })
  },

  cellUpdate: function() {
    this.placeOrder()
  },
  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  }
})
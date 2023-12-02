// pages/payment/pay_hub.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    needAuth: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    if (options.paymentId != undefined){
      that.setData({paymentId: options.paymentId})
    }
    if (options.orderId != undefined){
      that.setData({orderId: options.orderId})
    }
    app.loginPromiseNew.then(function(resolve){
      if (app.globalData.cellNumber != undefined && app.globalData.cellNumber != null && app.globalData.cellNumber.length == 11){
        that.setData({needAuth: false})
        that.jump()
      }
      else{
        that.setData({needAuth: true})
      }
    })
  },

  jump(){
    var that = this
    var getOrderUrl = 'https://' + app.globalData.domainName + '/core/'
    if (that.data.paymentId != undefined){
      getOrderUrl = getOrderUrl + 'OrderPayment/GetWholeOrder/' + that.data.paymentId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    }
    else{
      getOrderUrl = getOrderUrl + 'OrderOnlines/GetOrderOnline/' + that.data.orderId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    }
    wx.request({
      url: getOrderUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){

          var jumpUrl = ''
          var order = res.data

          var bindUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/BindUser/' + order.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)

          wx.request({
            url: bindUrl,
            method: 'GET',
            success:(res)=>{

            },
            complete:(res)=>{

              switch(order.type){
                case '店销现货':
                  jumpUrl = '../shop_sale/order_info'
                  break;
                case '服务':
                  jumpUrl = '../mine/maintain/order_detail'
                  break;
                case '押金':
                  jumpUrl = '../experience/pay_temp'
                default:
                  break;
              }
              if (that.data.paymentId != undefined){
                jumpUrl = jumpUrl + '?paymentId=' + that.data.paymentId + '&id=' + order.id
              }
              if (that.data.orderId != undefined){
                jumpUrl = jumpUrl + '?orderId=' + that.data.orderId
              }
              
              wx.redirectTo({
                url: jumpUrl,
                fail:(res)=>{
                  wx.navigateTo({
                    url: jumpUrl,
                  })
                }
              })
              
            }
          })


          
        }
      }
    })
  },

  getPhoneNumber: function(res) {
    var that = this
    if(res.detail.errMsg=='getPhoneNumber:ok')
    {
      var url = 'https://' + app.globalData.domainName + '/core/MiniAppUser/UpdateUserInfo?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)+'&encData='+encodeURIComponent(res.detail.encryptedData)+'&iv='+encodeURIComponent(res.detail.iv)
      wx.request({
        url: url,
        method: 'GET',
        success: res => {
          
         // this.setData({show: false})
          app.globalData.cellNumber = res.data.phoneNumber
          //console.log('Auth UpdateSuccess', res)
          console.log('auth success')
          that.setData({needAuth: false})
          that.jump()
          //this.triggerEvent("UpdateSuccess", {})
        }
      })
    }
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
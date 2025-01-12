// pages/payment/rent_pay_add.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({id: options.id})
    app.loginPromiseNew.then(function(resolve){
      that.getOrder()
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
  getOrder(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/Rent/PlaceAdditionalOrder/' + that.data.id + '?payMethod=' + encodeURIComponent('微信支付') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          wx.showToast({
            title: '网络不可用',
            icon: 'error'
          })

          return
        }
        var order = res.data
        console.log('get order', order)
        that.pay(order.payments[0].id)
      }
    }) 
  },
  pay(id){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/OrderPayment/Pay/' + id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          wx.showToast({
            title: '系统错误',
            icon: 'error'
          })
          return
        }
        console.log('pay param', res.data)
        wx.requestPayment({
          nonceStr: res.data.nonce,
          package: 'prepay_id=' + res.data.prepay_id,
          paySign: res.data.sign,
          timeStamp: res.data.timestamp,
          signType: 'MD5',
          success:(res)=>{
            wx.showToast({
              title: '支付成功。',
              icon: 'none'
            })
          }
        })
      }
    })
  }
})
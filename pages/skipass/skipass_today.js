// pages/skipass/skipass_today.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    productArr:[]
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      var getProductUrl = 'https://' + app.globalData.domainName + '/core/Product/GetNanshanTodaySkipass'
      wx.request({
        url: getProductUrl,
        success:(res)=>{
          that.setData({productArr: res.data})
        }
      })
    })
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

  },
  gotoPay: function(e){
    console.log(e)
    var now = new Date()
    var id = e.currentTarget.id.split('_')[1]
    var cart = {cart_array: [{product_id: id, count: 1}], memo: {use_date: 
      now.getFullYear().toString() + '-' + (now.getMonth()+1).toString() + '-' + now.getDate().toString()}}
    ///api/place_online_order.aspx
    var placeOrderUrl = 'https://' + app.globalData.domainName + '/api/place_online_order.aspx'
    wx.request({
      url: placeOrderUrl,
      data: {cart, token: app.globalData.sessionKey},
      method: 'GET',
      success:(res)=>{
        console.log(res)
        wx.navigateTo({
          url: '/pages/payment/order_payment?orderid=' + res.data.order_id,
        })
      }
    })

    console.log(cart)
  }

})
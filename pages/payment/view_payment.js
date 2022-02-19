// pages/payment/view_payment.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    id: 0,
    state: 0,
    item:''
  },

  submitPay: function(){
    var that = this
    var payUrl = 'https://' + app.globalData.domainName + '/core/' + that.data.item + '/Pay/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: payUrl,
      method: 'GET',
      success:(res)=>{
        wx.requestPayment({
          nonceStr: res.data.nonce,
          package: 'prepay_id=' + res.data.prepay_id,
          paySign: res.data.sign,
          timeStamp: res.data.timestamp,
          signType: 'RSA',
          success: (res) => {
            console.log('pay success', res)  
            that.setData({state: 1})

          }
        })
      }
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.setData({id: options.id, item: options.item})
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

  }
})
// pages/payment/uni_pay.js
const app = getApp()

Page({

  /**
   * Page initial data
   */
  data: {
    wellForm: false,
    amount: null,
    loaded: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {

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
    app.loginPromiseNew.then(function (resolve) {
      that.setData({ loaded: true })
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
  setAmount(e) {
    var that = this
    var value = e.detail.value
    if (value == null || value == '' || isNaN(value)) {
      that.setData({ wellForm: false })
    }
    else {
      that.setData({ wellForm: true, amount: value })
    }
  },
  pay(e) {
    var that = this
    var url = app.globalData.requestPrefix + 'Order/CreateUnipayOrder?amount=' + encodeURIComponent(that.data.amount) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: url,
      method: 'GET',
      success: (res) => {
        var payment = res.data
        wx.requestPayment({
          nonceStr: payment.nonce,
          package: 'prepay_id=' + payment.prepay_id,
          paySign: payment.sign,
          timeStamp: payment.timestamp,
          signType: 'MD5',
          success: (res) => {
            that.setData({ loaded: false, wellForm: false })
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
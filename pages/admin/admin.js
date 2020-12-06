// pages/admin/admin.js
const app = getApp()
function init(that) {
  that.setData({role: app.globalData.role})
}
Page({

  /**
   * Page initial data
   */
  data: {
    role: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    if (app.globalData.sessionKey == null || app.globalData.sessionKey == '') {
      var that = this
      app.loginPromise.then(function(resolve) {
        init(that)
      })
    }
    else {
      init(this)
    }
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
  gotoInShopOrderConfirm: function() {
    wx.navigateTo({
      url: './equip_maintain/in_shop_order_confirm/in_shop_order_confirm',
    })
  }
})
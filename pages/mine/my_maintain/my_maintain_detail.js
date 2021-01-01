// pages/mine/my_maintain/my_maintain_detail.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    id: '0',
    wxaCodeUrl: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    this.data.id = options.id
    var that = this
    app.loginPromise.then(function(resolve) {
      var wxaCodeUrl = 'https://' + app.globalData.domainName + '/get_wxacode_unlimit.aspx?page=' + encodeURIComponent('pages/admin/equip_maintain/in_shop_order_quick/in_shop_order_pick') + '&scene=' + that.data.id
      that.setData({wxaCodeUrl: wxaCodeUrl})
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
const app = getApp()
var wxloginModule = require('../../utils/wxlogin.js')
Page({

  /**
   * Page initial data
   */
  data: {

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    wxloginModule.wxlogin()
    this.setData({tabbarItemList: app.globalData.userTabBarItem, tabIndex: 2})
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
  tabSwitch: function(e) {
    wx.navigateTo({
      url: e.detail.item.pagePath
    })
  },
  gotoOrders: function(e) {
    wx.navigateTo({
      url: 'plugin-private://wx34345ae5855f892d/pages/orderList/orderList?tabId=all',
     
    });
  },
  gotoSkipass: function(e) {
    wx.navigateTo({
      url: '/pages/mine/my_ski_pass/my_ski_pass',
    })
  }
})
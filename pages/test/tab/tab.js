// pages/test/tab/tab.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    tabbarItemList: [],
    tabIndex: 1
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    this.setData({tabbarItemList: app.globalData.adminTabbarItem})
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
    console.log(e)
    var switchUrl = e.detail.item.pagePath
    wx.navigateTo({
      url: switchUrl
    })
  }
})
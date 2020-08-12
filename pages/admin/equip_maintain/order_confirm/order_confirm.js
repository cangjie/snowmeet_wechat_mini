// pages/admin/equip_maintain/order_confirm/order_confirm.js
var wxloginModule = require('../../../../utils/wxlogin.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    array:['Fischer', 'Head', 'Stockli', 'Nodica', 'Salomon', '其它'],
    index: 5
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    wxloginModule.wxlogin()
    this.setData({tabbarItemList: app.globalData.adminTabbarItem,
    tabIndex: 0})
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
  tabSwitch: function(e) {
    var switchUrl = e.detail.item.pagePath
    wx.navigateTo({
      url: switchUrl
    })
  },
  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  }
})
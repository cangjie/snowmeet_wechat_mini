// pages/skipass/skipass.js
var wxloginModule = require('../../utils/wxlogin.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    needValidCell: true
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    //wxloginModule.wxlogin()
    //if (app.globalData.sessionKey == null || app.globalData.sessionKey == '') {
    var that = this
    app.loginPromiseNew.then(function(resovle){
      that.setData({sessionKey: encodeURIComponent(app.globalData.sessionKey),  tabbarItemList: app.globalData.userTabBarItem, tabIndex: 1})
    })
    //}
    /*
    else {
      this.setData({sessionKey: encodeURIComponent(app.globalData.sessionKey),  tabbarItemList: app.globalData.userTabBarItem, tabIndex: 1})
    }
    */
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
  onUpdateSuccess: function() {
    this.setData({needValidCell: false})
  }
})
var crypto  = require('../../utils/crypt.js')
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
  getPhoneNumber: function(res) {
    if (res.detail.errMsg == 'getPhoneNumber:ok') {
      //wxloginModule.wxlogin()
      var encryptedData = res.detail.encryptedData
      var iv = res.detail.iv
      var encStr = crypto.encrypted("福田区", app.globalData.sessionKey, res.iv)
      console.log(encStr)//加密
      var decStr = crypto.decrypted(encStr, app.globalData.sessionKey, res.iv)
      console.log(decStr)//解密
      //var decryptedString = crypto.decrypted(encryptedData, app.globalData.sessionKey, iv)
    }
  }
})
// pages/admin/recept/recept_new.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    showUserInfo: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function (resolve){
      that.setData({scrollHeight: app.globalData.windowInfo.windowHeight * 2-220})
    })
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
  showUserInfo(){
    var that = this
    that.setData({showUserInfo: true})
  },
  closeUserInfo(e){
    var that = this
    that.setData({showUserInfo: false})
  }
})
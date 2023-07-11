// pages/admin/recept/float.js
const app = getApp()
const topFrameHeightMax = 360
const topFrameHeightMin = 60
const bottomFrameHeightMax = 360
const bottomFrameHeightMin = 60
Page({

  /**
   * Page initial data
   */
  data: {
    topFrameHeight: topFrameHeightMin,
    bottomFrameHeight: bottomFrameHeightMin
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function (resolve){

      var windowHeight = 0
      var windowWidth = 0
      if (app.globalData.systemInfo.safeArea != null){
        windowHeight = app.globalData.systemInfo.safeArea.height
        windowWidth = app.globalData.systemInfo.safeArea.width
      }
      else{
        windowHeight = app.globalData.systemInfo.windowHeight 
        windowWidth = app.globalData.systemInfo.windowWidth
      }
      that.setData({windowHeight: windowHeight, windowWidth: windowWidth})


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

  }
})
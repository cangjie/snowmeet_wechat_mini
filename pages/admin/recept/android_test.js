// pages/admin/recept/android_test.js
Page({

  /**
   * Page initial data
   */
  data: {
    iCan: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    //wx.getWindowInfo()
    wx.getSystemInfoAsync({
      success:(res)=>{
        console.log('sys info', res)
      }
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
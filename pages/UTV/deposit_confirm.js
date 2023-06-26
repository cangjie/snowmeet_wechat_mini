// pages/UTV/deposit_confirm.js
Page({

  /**
   * Page initial data
   */
  data: {
    scene: 0
  },
  prev(){
    var that = this
    var scene = that.data.scene
    scene--
    that.setData({scene: scene})
  },

  next(){
    var that = this
    var scene = that.data.scene
    scene++
    that.setData({scene: scene})
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {

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
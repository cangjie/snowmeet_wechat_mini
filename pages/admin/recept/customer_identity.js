// pages/admin/recept/customer_identity.js
Page({

  /**
   * Page initial data
   */
  data: {
    scene: 'rent'
  },

  start(){
    wx.redirectTo({
      url: 'common/step1',
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    if (options.sceneType != undefined){
      var scene = options.sceneType
      this.setData({scen: scene})
    }
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
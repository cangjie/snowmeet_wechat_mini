// pages/admin/recept/common/step1.js
Page({

  /**
   * Page initial data
   */
  data: {
    topFrameHeight: 60,
    bottomFrameHeight: 50
  },

  next(){
    wx.navigateTo({
      url: 'step1?step=rent_confirm_deposit',
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var winInfo = wx.getWindowInfo()
    var step = 'rent_confirm_item'
    if (options.step != undefined){
      step = options.step
    }
    this.setData({windowHeight: winInfo.windowHeight - winInfo.statusBarHeight,
      step: step})
    
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
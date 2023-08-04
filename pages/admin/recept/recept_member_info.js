// pages/admin/recept/recept_member_info.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {

  },

  userInfoUpdate(e){
    console.log('user info update', e)
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    if (options.openId != undefined){
      that.setData({openId: options.openId})
    }
    if (options.code != undefined){
      that.setData({code: options.code})
    }
    that.onShow()
  },

  onShow(){

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
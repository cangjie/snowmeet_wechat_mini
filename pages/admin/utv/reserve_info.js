// pages/admin/utv/reserve_info.js
Page({

  /**
   * Page initial data
   */
  data: {
    isEditing: 0
  },
  gotoEdit(){
    var that = this
    var isEditing = that.data.isEditing
    if (isEditing == 0){
      isEditing = 1
    }
    else{
      isEditing = 0
    }
    that.setData({isEditing: isEditing})
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
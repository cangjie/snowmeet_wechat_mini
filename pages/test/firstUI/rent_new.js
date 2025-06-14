// pages/test/firstUI/rent_new.js
Page({

  /**
   * Page initial data
   */
  data: {
    showPackage: false,
    showItem: false,
    show: false
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

  },
  showBackdrop(e){
    console.log('show back', e)
    var that = this
    var id = e.currentTarget.id
    if (id=='1'){
      that.setData({showPackage: true, showItem: false, show: true})
    }
    else{
      that.setData({showPackage: false, showItem: true, show: true})
    }
  },
  close(){
    var that = this
    that.setData({show: false})
  }
})
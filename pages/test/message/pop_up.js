// pages/test/message/pop_up.js
Page({

  /**
   * Page initial data
   */
  data: {

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    //that.requestDevice()
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
  request(){
    wx.requestSubscribeMessage({
      tmplIds:['Fp_lJYTxVZVbc5PdvA-z-8UqUrf6VNAYH4EVFuf2af8'],
      success:(res)=>{
        console.log('sub req', res)
      },
      fail:(res)=>{
        console.log('sub req fail', res)
      }
    })
  },
  requestDevice(){
    var deviceInfo = wx.getDeviceInfo()
    console.log('device info', deviceInfo)
    var sysInfo = wx.getSystemInfoAsync()
  }
})
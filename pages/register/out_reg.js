// pages/register/out_reg.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {

  },

  goBack(){
    var that = this
    wx.navigateToMiniProgram({
      appId: that.data.appId,
      path: that.data.path,
      envVersion: 'develop'
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var source = decodeURIComponent(options.source)
    var path = decodeURIComponent(options.path)
    var that = this
    that.setData({source, path})
    app.loginPromiseNew.then(function(resolve){
      switch(source){
        default:
          var msg = "您已经注册成为万龙滑雪学校会员，点击下方按钮返回。"
          that.setData({msg, appId: 'wx00d9526056641d74'})
          break
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
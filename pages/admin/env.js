
// pages/admin/env.js
const app = getApp()
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
    app.loginPromiseNew.then(function(resovle){
      var domain = app.globalData.domainName
      if (domain.indexOf('local') >= 0){
        domain = 'local'
      }
      that.setData({env: app.globalData.env, domain})
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

  },
  change(e){
    var that = this
    var domain = e.detail.value
    domain += ':44314'
    app.setDomain(domain)
    app.globalData.domainName = domain
    wx.reLaunch({
      url: '/pages/index/index',
    })
  }
})
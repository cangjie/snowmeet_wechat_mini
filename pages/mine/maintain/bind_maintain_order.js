// pages/mine/maintain/bind_maintain_order.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {

  },

  updated(){
    //console.log('binded')
    var that = this
    var bindUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/BindNewMember/' +  that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: bindUrl,
      method: 'GET',
      success:(res)=>{
        console.log('order binded', res)
        that.setData({order: res.data})
      }

    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    this.setData({id: options.id})
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
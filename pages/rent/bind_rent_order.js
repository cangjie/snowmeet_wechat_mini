// pages/rent/bind_rent_order.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    bindSuc: false
  },

  AuthFinish(e){
    var that = this
    console.log(e)
    app.loginPromiseNew.then(function(resolve){
      var bindUrl = 'https://' + app.globalData.domainName + '/core/Rent/Bind/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: bindUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode == 200){
            that.setData({bindSuc: true})
          }
        }
      })
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var id = options.id
    var that = this
    that.setData({id: id})
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
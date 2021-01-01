// pages/admin/equip_maintain/in_shop_order_quick/in_shop_order_pick.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    id: '0',
    isFinish: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    this.data.id = options.scene
    var that = this
    app.loginPromise.then(function(resolve) {
      var getInfoUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_get.aspx?id=' + that.data.id + '&sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getInfoUrl,
        success: (res) => {
          if (res.data.status == 0) {
            var isFinish = false
            if (res.data.maintain_in_shop_request.finish == '1') {
              isFinish = true
            }
            that.setData({maintain_in_shop_request: res.data.maintain_in_shop_request, isFinish: isFinish})
          }
        }
      })
    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  },
  setFinish: function() {
    var modUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_modify.aspx?id=' + this.data.id + '&sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: modUrl,
      method: 'POST',
      data: {finish: '1'},
      success: (res) => {
        if (res.data.status == 0 && res.data.result == 1) {
          this.setData({isFinish: true})
        }
      }
    })
  }
})
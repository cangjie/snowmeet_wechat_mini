// pages/mine/my_maintain/my_maintain.js
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
  onLoad: function (options) {
    var that = this
    app.loginPromise.then(function(resolve) {
      var url = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_get_mine_list.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: url,
        success: (res) => {
          if (res.data.status == 0){
            var arr = res.data.maintain_in_shop_request
            for(var i = 0; i < arr.length; i++) {
              var pick = new Date(arr[i].confirmed_pick_date)
              arr[i].confirmed_pick_date = pick.getFullYear().toString() + '-' + (1 + pick.getMonth()).toString() + '-' + pick.getDate().toString()

            }
            that.setData({count: res.data.count, rows: res.data.maintain_in_shop_request})
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

  }
})
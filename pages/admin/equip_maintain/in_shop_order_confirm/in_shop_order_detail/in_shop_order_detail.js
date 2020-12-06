// pages/admin/equip_maintain/in_shop_order_confirm/in_shop_order_detail/in_shop_order_detail.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    edgeDegree: '89',
    //maintain_in_shop_request:{equip_type: '双板'}
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var id = options.scene
    var that = this
    app.loginPromise.then(function(resolve){
      if (app.globalData.sessionKey != '') {
        var getUserFilledInfoPromise = new Promise(function(resolve) {
            var url = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_get.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&id=' + id
            wx.request({
              url: url,
              success: (res) => {
                if (res.data.status == 0) {
                  resolve(res.data.maintain_in_shop_request)
                  that.setData({maintain_in_shop_request: resolve})
                } 
              }
            })
        })
        getUserFilledInfoPromise.then(function(resolve){
          var pickDate = new Date(resolve.pick_date)
          resolve.pick_date = pickDate.getFullYear().toString() + '-' + (1 + pickDate.getMonth()).toString() + '-' + pickDate.getDate().toString()
          that.setData({maintain_in_shop_request: resolve})
          var getUserInfoPromise = new Promise(function(resolve){
            var url = 'https://' + app.globalData.domainName + '/api/mini_user_get.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&openid=' + encodeURIComponent(that.data.maintain_in_shop_request.open_id)
            wx.request({
              url: url,
              success: (res) => {
                if (res.data.status == 0 && res.data.count > 0){
                  resolve(res.data.mini_users[0])
                }
              }
            })
          })
          getUserInfoPromise.then(function(resolve) {
            that.setData({userInfo: resolve})//, equipInfo:{}, edge: res.data.maintain_in_shop_request.edge, degree: '89', candle: res.data.maintain_in_shop_request.candle, othersItem: '', memo: '', additonalFee: 0, pickDate: that.data.maintain_in_shop_request.pick_date})
          })
        })
        
      }
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
  call: function() {
    wx.makePhoneCall({
      phoneNumber: this.data.userInfo.cell_number,
    })
  }
})
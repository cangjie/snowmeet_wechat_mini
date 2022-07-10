// pages/summer_maintain/my_summer_maintain.js
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
    app.loginPromiseNew.then(function(resolve) {
      var getListUrl = 'https://' + app.globalData.domainName + '/core/SummerMaintain/GetMySummerMaintain?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getListUrl,
        method:'GET',
        success:(res)=>{
          var list = res.data
          for(var i = 0; i < list.length; i++){
            list[i].qrcodeUrl = 'https://' + app.globalData.domainName + '/core/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=use_service_card_' + list[i].code)
          }
          that.setData({list: res.data})
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
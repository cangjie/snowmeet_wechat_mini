// pages/blt/open_lock.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    deviceId:0,
    haveRight: false,
    userPointsSummary: 0
  },


  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    if (options.id != undefined && options.id != null){
      that.data.deviceId = options.id
      app.loginPromiseNew.then(function(resolve) {
        console.log(app.globalData)
        var getDeviceInfoUrl = 'https://' + app.globalData.domainName + '/core/BltDevice/GetBltDevice/' + that.data.deviceId
        wx.request({
          url: getDeviceInfoUrl,
          success:(res)=>{
            that.setData({deviceInfo: res.data})
            console.log(res.data)
            if (res.data.admin_only == 1 && app.globalData.role != 'staff'){
              that.setData({haveRight: false})
            }
            else {
              that.setData({haveRight: true})
            }
            if (that.data.haveRight){
              var getPointsSumUrl = 'https://' + app.globalData.domainName + '/core/Point/GetMyPointsSummary?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
              wx.request({
                url: getPointsSumUrl,
                success:(res)=>{
                  that.setData({userPointsSummary: parseInt(res.data)})

                }
              })
            }
          }
        })
      })
    }
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
// pages/admin/warmer_demand/warmer_demand.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    customerSessionKey: '',
    isStaff: false,
    nick: '',
    cell: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    if (options.scene == undefined) {
      this.data.customerSessionKey = options.customer
    }
    else {
      this.data.customerSessionKey = options.scene
    }
    var that = this
    var loginPromise = new Promise(function(resolve){
      if (app.globalData.sessionKey==undefined || app.globalData.sessionKey == ''){
        app.loginPromiseNew.then(function(resolveData) {
          var needVerifyCell = false
          if (resolve.cellNumber == undefined || resolve.cellNumber == '') {
            needVerifyCell = true
          }
          that.setData({isLogin: true, needVerifyCell: needVerifyCell})
          resolve(resolveData)
        })
      }
      else {
        that.setData({isLogin: true})
        resolve(app.globalData)
      }
    })
    loginPromise.then(function(resolve){
      if (resolve.role == 'staff') {
        
        var urlGetUserInfo = 'https://' + resolve.domainName + '/api/mini_user_get.aspx?sessionkey=' + encodeURIComponent(that.data.customerSessionKey)
        wx.request({
          url: urlGetUserInfo,
          success: (res) => {
            if (res.data.status == 0 && res.data.count > 0) {
              that.setData({nick: res.data.mini_users[0].nick, cell: res.data.mini_users[0].cell_number})
            }
          }
        })
        that.setData({isStaff: true})
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

  }
})
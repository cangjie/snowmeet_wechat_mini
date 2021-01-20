// pages/mine/my_warmer/my_warmer.js
const app = getApp()
var log = require('../../../utils/log')
Page({

  /**
   * Page initial data
   */
  data: {
    needVerifyCell: true,
    isLogin: false,
    canDemand: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    log.info('Open page')
    var that = this
    var loginPromise = new Promise(function(resolve){
      if (app.globalData.sessionKey==undefined || app.globalData.sessionKey == ''){
        app.loginPromiseNew.then(function(resolveData) {
          log.info('Log in real time')
          var needVerifyCell = false
          if (resolve.cellNumber == undefined || resolve.cellNumber == '') {
            needVerifyCell = true
          }
          that.setData({isLogin: true, needVerifyCell: needVerifyCell})
          resolve(resolveData)
        })
      }
      else {
        log.info('Logged in')
        that.setData({isLogin: true})
        resolve(app.globalData)
      }
    })
    loginPromise.then(function(resolve){
      var canDemandUrl = 'https://' + resolve.domainName + '/api/warmer.aspx?customer=' + resolve.sessionKey
        wx.request({
          url: canDemandUrl,
          success: (res) => {
            if (res.data.status == 0) {
              if (res.data.have_demand == 0) {
                var wxaCodeUrl = 'https://' + app.globalData.domainName + '/get_wxacode_unlimit.aspx?page=' + encodeURIComponent('pages/admin/warmer_demand/warmer_demand') + '&scene=' + app.globalData.sessionKey
                that.setData({canDemand: true, wxaCodeUrl: wxaCodeUrl})
              }
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
  onUpdateCellSuccess: function() {
    this.setData({needVerifyCell: false})
  }
})
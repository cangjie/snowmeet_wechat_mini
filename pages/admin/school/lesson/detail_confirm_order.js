// pages/admin/school/lesson/detail_confirm_order.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    role: '',
    training_fee: 0,
    ticket_fee: 0,
    rent_fee: 0,
    others_fee: 0
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var id = options.id
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.setData({role: app.globalData.role})
      wx.request({
        url: 'https://' + app.globalData.domainName + '/core/schoollesson/' + id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey),
        method: 'GET',
        success: (res) => {
          that.setData({school_lesson: res.data})
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
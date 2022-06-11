// pages/admin/equip_maintain/summer/summer_list.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    list:[]
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      var getAllUrl = 'https://' + app.globalData.domainName + '/core/SummerMaintain/GetAll?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getAllUrl,
        success:(res)=>{
          var list = res.data
          for(var i = 0; i < list.length; i++){
            var dateStr = list[i].create_date.toString()
            var date = new Date(dateStr)
            list[i].dateStr = date.getFullYear().toString() + '-' + (date.getMonth() + 1).toString() + '-' + date.getDate()
          }
          that.setData({list: res.data, role: app.globalData.role})
        }
      })
    })
  },

  tap: function(e){
    var id = parseInt(e.currentTarget.id)
    wx.navigateTo({
      url: '/pages/admin/equip_maintain/summer/summer_recept?id=' + id.toString(),
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
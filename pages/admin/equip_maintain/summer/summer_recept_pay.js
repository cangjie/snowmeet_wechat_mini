// pages/admin/equip_maintain/summer/summer_recept_pay.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    role: '',
    state: 0,
    id: 0,
    wxaCodeUrl:''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    that.setData({id: options.id, wxaCodeUrl: 'https://weixin.snowmeet.top/show_wechat_temp_qrcode.aspx?scene=pay_summermaintain_' + that.data.id})
    app.loginPromiseNew.then(function(reolve){
      var intervalId = setInterval(that.refreshStatus, 1000)
      that.setData({intervalId: intervalId, role: app.globalData.role })
    })
  },

  refreshStatus: function(){
    var that = this
    var getSummerMaintainUrl = 'https://' + app.globalData.domainName + '/core/SummerMaintain/GetSummerMaintain/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getSummerMaintainUrl,
      method:'GET',
      success:(res)=>{
        if (res.data.code != '' && res.data.order_id != 0){
          that.setData({state: 1})
          clearInterval(that.data.intervalId)
        }
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
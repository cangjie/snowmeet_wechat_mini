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
    wxaCodeUrl:'',
    owner_cell: '',
    owner_name: '',
    open_id: ''
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
          that.setData({state: 1, open_id: res.data.open_id, owner_name: res.data.contact_name, owner_cell: res.data.cell})
          clearInterval(that.data.intervalId)
          if (that.data.owner_cell.trim() == ''){
            var getUserInfoUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/GetMiniAppUser?openId=' + encodeURIComponent(that.data.open_id) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
            wx.request({
              url: getUserInfoUrl,
              method:'GET',
              success:(res)=>{
                that.setData({owner_cell: res.data.cell_number})
              }
            })
          }
        }
      }
    })
  },

  infoChange: function(e){
    var that = this
    var value = e.detail.value
    switch(e.currentTarget.id){
      case 'name':
        that.setData({owner_name: value})
        break
      case 'cell':
        that.setData({owner_cell: value})
        break
      default:
        break
    }
  },

  submitInfo: function(){
    var that = this
    var submitUrl = 'https://' + app.globalData.domainName + '/core/SummerMaintain/UpdateOwnerInfo/' + that.data.id + '?name=' + encodeURIComponent(that.data.owner_name) + '&cell=' + encodeURIComponent(that.data.owner_cell) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: submitUrl,
      method: 'GET',
      success:(res)=>{
        that.setData({state: 2})
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
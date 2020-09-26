// pages/admin/equip_maintain/order_list/order_detail_assign/order_detail_assign.js
var wxloginModule = require('../../../../../utils/wxlogin.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    showOneButtonDialog: false,
    oneButton: [{text: '返回'}]
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    wxloginModule.wxlogin()
    this.setData({tabbarItemList: app.globalData.adminTabbarItem,
      tabIndex: 0})
      
      var url = 'https://' + app.globalData.domainName + '/api/get_a_new_maintain_order.aspx?sessionkey=' + app.globalData.sessionKey
      wx.request({
        url: url,
        success: res => {
          if (res.data.count > 0) {
           
          }
          else {
            this.setData({showOneButtonDialog: true})
          }
        },
        fail: res => {
          this.setData({showOneButtonDialog: true})
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
  tapDialogButton: function() {
    this.setData({showOneButtonDialog: false})
    wx.navigateBack({
      delta: 0
    })
  }


})

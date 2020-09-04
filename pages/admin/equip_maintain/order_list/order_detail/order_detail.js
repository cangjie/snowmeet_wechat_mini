// pages/admin/equip_maintain/order_list/order_detail/order_detail.js
var wxloginModule = require('../../../../../utils/wxlogin.js')
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
    wxloginModule.wxlogin()
    this.setData({tabbarItemList: app.globalData.adminTabbarItem,
      tabIndex: 0})
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
  goToDetail: function(res) {
    var targetUrl = ''
    switch(res.currentTarget.id) {
      case "detail_0":
        targetUrl = '/pages/admin/equip_maintain/order_list/task/task_finish/task_finish'
        break
      case 'detail_1':
        targetUrl = '/pages/admin/equip_maintain/order_list/task/task_stop/task_stop'
        break
      case 'detail_2':
        targetUrl = '/pages/admin/equip_maintain/order_list/task/task_executing/task_executing'
        break
      case 'detail_3':
        targetUrl = '/pages/admin/equip_maintain/order_list/task/task_pending/task_pending'
        break
      default:
        break
    }

    wx.navigateTo({
      url: targetUrl,
    })
  }
})
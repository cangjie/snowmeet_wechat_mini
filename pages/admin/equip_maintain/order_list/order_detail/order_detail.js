// pages/admin/equip_maintain/order_list/order_detail/order_detail.js
var wxloginModule = require('../../../../../utils/wxlogin.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    orderId: 0,
    maintainTask:{},
    userFilledInfo:{},
    userInfo:{},
    
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    wxloginModule.wxlogin()
    this.setData({tabbarItemList: app.globalData.adminTabbarItem,
      tabIndex: 0})
    this.setData({orderId: options.id, taskid: options.id})

    var urlSelectTable = 'https://' + app.globalData.domainName + '/api/select_table.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&sql=' + encodeURIComponent('select * from maintain_task_detail where task_id = ' + this.data.taskid + ' order by sort, [id] ')
    wx.request({
      url: urlSelectTable,
      success: (res) => {
        if (res.data.count > 0) {
          var maintain_task_detail_arr = res.data.rows
          this.setData({maintain_task_detail: res.data.rows})
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

  },
  goToDetail: function(res) {
    var targetUrl = '/pages/admin/equip_maintain/order_list/task/task?detailid=' + res.currentTarget.id.trim().split('_')[1] + '&taskid=' + this.data.taskid
    wx.navigateTo({
      url: targetUrl,
    })
  }
})
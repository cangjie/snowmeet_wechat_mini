// pages/admin/equip_maintain/order_list/order_detail_assign/order_detail_assign.js
var wxloginModule = require('../../../../../utils/wxlogin.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    showOneButtonDialog: false,
    oneButton: [{text: '返回'}],
    task_info:{},
    user_filled_info:{},
    user_head_image:'',
    user_nick:'',
    order_date:'',
    order_time:''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    wxloginModule.wxlogin()
    this.setData({tabbarItemList: app.globalData.adminTabbarItem,
      tabIndex: 0})
      
      var url = 'https://' + app.globalData.domainName + '/api/get_a_new_maintain_order.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: url,
        success: res => {
          if (res.data.count > 0) {
            var maintain_task =  res.data.maintain_task_arr[0].maintain_task
            var str_task_id = maintain_task.id.toString()
            str_task_id = new Array(9 - str_task_id.length).join('0')+str_task_id
            maintain_task.id = str_task_id
            var str_card_no = maintain_task.card_no
            str_card_no = str_card_no.substring(0, 3) + '-' + str_card_no.substring(3, 6) + '-' + str_card_no.substring(6, 9)
            maintain_task.card_no = str_card_no
            this.setData({task_info: maintain_task, order_date: maintain_task.create_date.toString().split(' ')[0], order_time: maintain_task.create_date.toString().split(' ')[1]})
            this.setData({user_filled_info: res.data.maintain_task_arr[0].user_filled_info})
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

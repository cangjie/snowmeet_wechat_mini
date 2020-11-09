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

    var urlSelectTable = 'https://' + app.globalData.domainName + '/api/select_table.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&sql=' + encodeURIComponent('select * from maintain_task_detail left join mini_users on oper_open_id = open_id  where task_id = ' + this.data.taskid + ' order by sort, [id] ')
    wx.request({
      url: urlSelectTable,
      success: (res) => {
        if (res.data.count > 0) {
          var maintain_task_detail_arr = res.data.rows
          //this.setData({maintain_task_detail: res.data.rows})
          for(var i = 0; i < maintain_task_detail_arr.length; i++) {
            maintain_task_detail_arr[i].color = 'gray'
            if (maintain_task_detail_arr[i].start_date_time != ''){
              var startDateTime = new Date(maintain_task_detail_arr[i].start_date_time)
              maintain_task_detail_arr[i].start_date_time = startDateTime.getFullYear().toString() + '-' + (startDateTime.getMonth() + 1).toString() + '-' + startDateTime.getDate().toString() + ' ' + startDateTime.getHours().toString() + ':' + startDateTime.getMinutes().toString()
            }
            else {
              maintain_task_detail_arr[i].start_date_time = ''
            }
            if (maintain_task_detail_arr[i].real_name == ''){
              maintain_task_detail_arr[i].real_name = '--'
            }
            switch(maintain_task_detail_arr[i].status) {
              case '已开始':
                maintain_task_detail_arr[i].color = 'red'
                break
              case '已完成':
                maintain_task_detail_arr[i].color = 'green'
                break
              case '强行中止':
                maintain_task_detail_arr[i].color = 'orange'
                break
              default:
                break
            } 
          }
          this.setData({maintain_task_detail: maintain_task_detail_arr})
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
// pages/admin/equip_maintain/order_list/task/task.js
//var wxloginModule = require('../   ../../../../../../utils/wxlogin.js')
var wxloginnModule = require('../../../../../utils/wxlogin.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    taskId: '0'
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    this.setData({taskid: options.taskid})
    var detailId = options.detailid
    var urlSelectTable = 'https://' + app.globalData.domainName + '/api/select_table.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&sql=' + encodeURIComponent('select * from maintain_task_detail where [id] = ' + detailId )
    wx.request({
      url: urlSelectTable,
      success: (res) => {
        if (res.data.count>0){
          var color = 'gray'
          switch(res.data.rows[0].status) {
            case '已开始':
              color = 'red'
              break
            case '暂停':
              color = 'yellow'
              break
            case '强行中止':
              color = 'orange'
              break
            case '已完成':
              color = 'green'
              break
            default:
              break
          }
          this.setData({maintainTaskDetail: res.data.rows[0], color: color})
          /*
          var taskUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_get_by_id.aspx?taskid=' + maintainTaskDetail.task_id + '&sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: taskUrl,
            success: (res) => {
              if (res.data.status == 0) {
                this.setData({maintainTask: res.data.maintain_task})
              }
            }
          })*/
          var miniUserGetUrl = 'https://' + app.globalData.domainName + '/api/mini_user_get.aspx?openid=' + this.data.maintainTaskDetail.oper_open_id + '&sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: miniUserGetUrl,
            success: (res) => {
              if (res.data.count > 0){
                var operRealName = res.data.mini_users[0].real_name
                if (operRealName == '') {
                  operRealName = '--'
                }
                this.setData({operRealName: operRealName})
              }
            }
          })
        }
      }
    })

    urlSelectTable = 'https://' + app.globalData.domainName + '/api/select_table.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&sql=' + encodeURIComponent('select * from maintain_task_detail_sub where detail_id = ' + detailId + '  order by sort,id ')
    wx.request({
      url: urlSelectTable,
      success: (res) => {
        var maintainTaskDetailSub = res.data.rows
        for(var i = 0; i < maintainTaskDetailSub.length; i++) {
          maintainTaskDetailSub[i].no = (i+1).toString()
        }
        this.setData({maintainTaskDetailSub: maintainTaskDetailSub})
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
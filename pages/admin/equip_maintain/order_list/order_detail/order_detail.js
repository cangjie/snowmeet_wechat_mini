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
    this.setData({orderId: options.id})
    var url = 'https://' + app.globalData.domainName + '/api/maintain_task_get_by_id.aspx?taskid=' + this.data.orderId+'&sessionkey='+encodeURIComponent(app.globalData.sessionKey.trim())
    wx.request({
      url: url,
      success: (res) => {
        if (res.data.status == 0) {
          var maintainTask = res.data.maintain_task
          var realCardNo = maintainTask.card_no
          maintainTask.card_no = maintainTask.card_no.substring(0, 3) + '-' + maintainTask.card_no.substring(3, 6) + '-' + maintainTask.card_no.substring(6, 9)
          var strCreateDate = maintainTask.create_date
          var createDate = new Date(strCreateDate)
          var orderDate = createDate.getFullYear().toString() + '-' + (createDate.getMonth()+1).toString() + '-' + createDate.getDate().toString()
          var orderTime = createDate.getHours().toString()+':'+createDate.getMinutes().toString()
          this.setData({maintainTask: maintainTask, userFilledInfo: res.data.user_filled_info, orderDate: orderDate, orderTime: orderTime})
          var urlUserInfo = 'https://' + app.globalData.domainName + '/api/get_official_account_user_info.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&openid=' + encodeURIComponent(this.data.maintainTask.open_id)
          wx.request({
            url: urlUserInfo,
            success: (res) => {
              this.setData({userInfo: res.data})
            }
          })
          var urlSelectTable = 'https://' + app.globalData.domainName + '/api/select_table.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&sql=' + encodeURIComponent('select * from maintain_task left join card on  card.card_no = maintain_task.card_no left join product on card.product_id = product.[id] where maintain_task.[id] = ' + maintainTask.id)
          wx.request({
            url: urlSelectTable,
            success: (res) => {
              var price = 0
              if (res.data.count > 0) {
                price = res.data.rows[0].sale_price
              }
              this.setData({price: price})
            }
          })
          urlSelectTable = 'https://' + app.globalData.domainName + '/api/select_table.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&sql=' + encodeURIComponent('select * from maintain_task_detail where task_id = ' + maintainTask.id + ' order by sort, [id] ')
          wx.request({
            url: urlSelectTable,
            success: (res) => {
              if (res.data.count > 0) {
                var maintain_task_detail_arr = res.data.rows
                
                this.setData({maintain_task_detail: res.data.rows})
              }
            }
          })
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
    var targetUrl = '/pages/admin/equip_maintain/order_list/task/task?taskid=' + res.currentTarget.id.trim().split('_')[1]
    wx.navigateTo({
      url: targetUrl,
    })
  }
})
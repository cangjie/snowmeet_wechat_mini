// pages/admin/maintain/order_detail.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    qrCodeUrl: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var orderId = options.orderId
    app.loginPromiseNew.then(function(resolve){
      var getOrderInfoUrl = 'https://' + app.globalData.domainName + '/core/maintainlive/GetMaintainOrder/' + orderId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getOrderInfoUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode == 200){
            var order = res.data
            var orderDate = new Date(order.order.create_date)
            order.date = util.formatDate(orderDate)
            order.time = util.formatTimeStr(orderDate)
            var qrCodeUrl = 'https://' + app.globalData.domainName + '/core/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=confirm_maintain_' + orderId)
            that.setData({order: order, tasks: order.items, qrCodeUrl: qrCodeUrl})
          }
        },
        fail:(res)=>{
          console.log(res)
        },
        complete:(res)=>{
          console.log(res)
        }
      })

    })
  },

  confirmPaid(){
    var that = this
    var confirmUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/MaitainOrderPaySuccessManual/' + that.data.order.order.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: confirmUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){
          console.log('order info update', res)
          var order = that.data.order
          order.order.status = res.data.order.status
          
          wx.showToast({
            title: '收款成功',
            icon: 'none',
            complete:(res)=>{
              that.setData({order: order})
              wx.navigateTo({
                url: 'task_list',
              })
            }
          })
        }
      }
    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  }
})
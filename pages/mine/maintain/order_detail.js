// pages/mine/maintain/order_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var orderId = options.id
    var that = this
    app.loginPromiseNew.then(function (resolve){
      var getOrderUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetMaintainOrder/' + orderId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getOrderUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode == 200){
            var order = res.data
            order.dateStr = util.formatDate(new Date(order.orderDate))
            order.timeStr = util.formatTimeStr(new Date(order.orderDate))
            for(var i = 0; i < order.items.length; i++){
              var currentItem = order.items[i]
              var edgeStatus = '未开始'
              var waxStatus = '未开始'
              var unWaxStatus = '未开始'
              var moreStatus = '未开始'
              var finalStatus = ''
              for(var j = 0; j < currentItem.taskLog.length; j++){
                var log = currentItem.taskLog[j]
                switch(log.status){
                  case '修刃':
                    edgeStatus = log.status
                    break
                  case '打蜡':
                    waxStatus = log.status
                    break
                  case '刮蜡':
                    unWaxStatus = log.status
                    break
                  case '维修':
                    moreStatus = log.status
                    break
                  case '发板':
                    finalStatus = '已取回'
                    break
                  case '强行索回':
                    finalStatus = '强行索回'
                    break
                  default:
                    break
                }
              }
              currentItem.edgeStatus = edgeStatus
              currentItem.waxStatus = waxStatus
              currentItem.unWaxStatus = unWaxStatus
              currentItem.moreStatus = moreStatus
              currentItem.finalStatus = finalStatus
              
              currentItem.qrcodeUrl = 'https://' + app.globalData.domainName + '/core/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_qrcode.aspx?qrcodetext=') + encodeURIComponent('https://mini.snowmeet.top/mapp/admin/maintain/task/' + currentItem.id)

            }
            that.setData({order: order})
          }
        }
      })

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
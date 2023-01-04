// pages/mine/ticket/ticket_share.js
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
    var code = options.code
    var that = this
    app.loginPromiseNew.then(function(resolve){
      var getTicketUrl = 'https://' + app.globalData.domainName + '/core/Ticket/GetTicket/' + code
      wx.request({
        url: getTicketUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode == 200){
            var ticket = res.data
            ticket.usage = ticket.memo.split(';')
            var titleColor = 'yellowgreen'
            if (ticket.used == 1){
              titleColor = 'gray'
            }
            var qrCodeUrl = 'https://' + app.globalData.domainName + '/core/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=accept_ticket_code_' + code)
            that.setData({ticket: ticket, titleColor: titleColor, qrCodeUrl: qrCodeUrl})
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
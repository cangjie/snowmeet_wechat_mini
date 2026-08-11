// pages/mine/ticket/ticket_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
// 硬编码：允许转赠的优惠券模板（12=免费打蜡券，16=老顾客优惠券），需与后端 TicketController.TransferableTemplateIds 保持一致
const TRANSFERABLE_TEMPLATE_IDS = [12, 16]
Page({

  /**
   * Page initial data
   */
  data: {
    needAuth: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var code = options.code
    var that = this
    that.setData({ code: code })
    app.loginPromiseNew.then(function (resolve) {
      data.getTicket(code).then(function (ticket) {
        var memo = ticket.memo
        if (memo.indexOf('>') >= 0 && memo.indexOf('<') >= 0){
          ticket.rich = true
        }
        else{
          ticket.rich = false
          ticket.usage = memo.split(';')
        }
        ticket.canTransfer = TRANSFERABLE_TEMPLATE_IDS.indexOf(ticket.template_id) >= 0 && ticket.used != 1
        if (ticket.used == 1){
          ticket.statusText = '已使用'
          ticket.statusClass = 'status-used'
        }
        else if (ticket.shared == 1){
          ticket.statusText = '分享中'
          ticket.statusClass = 'status-shared'
        }
        else{
          ticket.statusText = '待使用'
          ticket.statusClass = 'status-pending'
        }
        if (!ticket.canTransfer){
          wx.hideShareMenu()
        }
        var qrCodeUrl = 'https://' + app.globalData.domainName + '/api/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=oper_ticket_code_' + code)
        that.setData({ ticket: ticket, qrCodeUrl: qrCodeUrl })
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
   * Called when user click on the top right corner to share, or the "转赠好友" button
   */
  onShareAppMessage() {
    var that = this
    var ticket = that.data.ticket
    if (!ticket || !ticket.canTransfer){
      return {}
    }
    return data.setTicketToSharePromise(ticket.code, app.globalData.sessionKey).then(function (){
      return {
        title: '赠送优惠券：' + ticket.name,
        path: '/pages/mine/ticket/ticket_share?code=' + ticket.code
      }
    }).catch(function (){
      return {}
    })
  }
})
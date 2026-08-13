// pages/mine/ticket/ticket_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
const ticketHelper = require('./ticket_helper.js')
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
    // 从"已分享"列表点进来的会带上 tab=shared，用来判断这张券是不是已经被对方接受、
    // 不再是我的了（见 ticket_helper.annotateTicket）；直接深链进来（不经过列表页）没有
    // 这个参数，按原来的逻辑处理，当作自己名下的券
    var tab = options.tab
    var that = this
    that.setData({ code: code })
    app.loginPromiseNew.then(function (resolve) {
      data.getTicket(code).then(function (ticket) {
        ticket = ticketHelper.annotateTicket(ticket, tab)
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
      ticket.shared = 1
      ticket.statusText = '分享中'
      ticket.statusClass = 'status-shared'
      that.setData({ ticket: ticket })
      return {
        title: '赠送优惠券：' + ticket.name,
        path: '/pages/mine/ticket/ticket_share?code=' + ticket.code,
        imageUrl: 'https://' + app.globalData.domainName + '/images/snowmeet_logo.png'
      }
    }).catch(function (){
      return {}
    })
  },
  onCancelShare(){
    var that = this
    var ticket = that.data.ticket
    if (!ticket || ticket.shared != 1){
      return
    }
    wx.showModal({
      title: '撤回分享',
      content: '撤回后，对方将无法再通过分享链接接受这张优惠券。',
      confirmText: '撤回',
      confirmColor: '#EF4444',
      success: function (res){
        if (!res.confirm){
          return
        }
        data.cancelShareTicketPromise(ticket.code, app.globalData.sessionKey).then(function (){
          ticket.shared = 0
          ticket.statusText = '待使用'
          ticket.statusClass = 'status-pending'
          that.setData({ ticket: ticket })
          wx.showToast({ title: '已撤回分享', icon: 'success' })
        }).catch(function (){})
      }
    })
  }
})

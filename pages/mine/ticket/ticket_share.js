// pages/mine/ticket/ticket_share.js
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
var FOLLOW_POLL_INTERVAL_MS = 2500
Page({

  /**
   * Page initial data
   */
  data: {
    followed: false,
    qrCodeUrl: ''
  },
  accept(){
    var that = this
    if (!that.data.followed){
      wx.showToast({ title: '请先关注公众号', icon: 'none' })
      return
    }
    data.acceptTicketPromise(that.data.ticket.code, '分享获得', app.globalData.sessionKey).then(function (){
      that._stopFollowPoll()
      wx.showToast({
        title: '优惠券已经入账',
        icon:'success',
        success:()=>{
          setTimeout(function (){
            wx.redirectTo({
              url: './ticket_list',
            })
          }, 1000)
        }
      })
    }).catch(function (){
      // 失败已由 performWebRequest 统一 toast（如「不能转赠给自己」「链接可能已失效」）
    })
  },
  _startFollowPoll(code){
    var that = this
    that._stopFollowPoll()
    that._checkFollowOnce(code)
    that._followTimer = setInterval(function (){
      that._checkFollowOnce(code)
    }, FOLLOW_POLL_INTERVAL_MS)
  },
  _checkFollowOnce(code){
    var that = this
    if (that.data.followed){
      return
    }
    data.checkTransferFollowPromise(code).then(function (followed){
      if (followed){
        that.setData({ followed: true })
        that._stopFollowPoll()
      }
    }).catch(function (){
      // 轮询失败静默重试，不打断用户
    })
  },
  _stopFollowPoll(){
    if (this._followTimer){
      clearInterval(this._followTimer)
      this._followTimer = null
    }
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var code = options.code
    var that = this
    that.setData({ code: code })
    app.loginPromiseNew.then(function(resolve){
      data.getTicket(code).then(function (ticket){
        ticket.usage = ticket.memo.split(';')
        var titleColor = 'yellowgreen'
        if (ticket.used == 1){
          titleColor = 'gray'
        }
        // 二维码场景值必须用后端算好的 ticket.transfer_scene（绑定在这一次分享上），
        // 不能自己拼 code——否则同一张券换收件人转赠时会复用到别人的历史扫码/关注记录
        var qrCodeUrl = ''
        if (ticket.transfer_scene){
          qrCodeUrl = 'https://' + app.globalData.domainName + '/api/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=' + ticket.transfer_scene)
        }
        that.setData({ticket: ticket, titleColor: titleColor, qrCodeUrl: qrCodeUrl})
      })
      that._startFollowPoll(code)
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
    if (this.data.code && !this.data.followed && !this._followTimer){
      this._startFollowPoll(this.data.code)
    }
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {
    this._stopFollowPoll()
  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {
    this._stopFollowPoll()
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

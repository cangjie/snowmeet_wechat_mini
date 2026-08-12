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
    checking: true,   // 首次查询关注状态中，避免二维码/按钮先闪一下再切换
    followed: false,
    accepting: false,
    qrCodeUrl: ''
  },

  // 手动点击"接受"按钮（仅在页面加载时就已关注的情况下展示此按钮）
  accept(){
    this._doAccept('优惠券已经入账')
  },

  // 未关注状态下，轮询检测到扫码关注成功后自动接受，无需用户再点按钮
  _autoAccept(){
    this._doAccept('已关注，优惠券自动入账')
  },

  _doAccept(toastTitle){
    var that = this
    if (that.data.accepting || !that.data.ticket){
      return
    }
    that.setData({ accepting: true })
    data.acceptTicketPromise(that.data.ticket.code, '分享获得', app.globalData.sessionKey).then(function (){
      that._stopFollowPoll()
      wx.showToast({
        title: toastTitle,
        icon: 'success',
        success: () => {
          setTimeout(function (){
            wx.redirectTo({
              url: './ticket_list',
            })
          }, 1000)
        }
      })
    }).catch(function (){
      // 失败已由 performWebRequest 统一 toast（如「不能转赠给自己」「链接可能已失效」）
      that.setData({ accepting: false })
    })
  },

  // 页面首次加载时查一次当前关注状态：已关注 -> 只显示接受按钮；未关注 -> 只显示二维码并开始轮询
  _checkInitialFollow(code){
    var that = this
    data.checkTransferFollowPromise(code).then(function (followed){
      that.setData({ followed: followed, checking: false })
      if (!followed){
        that._startFollowPoll(code)
      }
    }).catch(function (){
      // 查询失败时兜底当作未关注处理，展示二维码并继续轮询重试，而不是卡死在加载态
      that.setData({ checking: false, followed: false })
      that._startFollowPoll(code)
    })
  },

  _startFollowPoll(code){
    var that = this
    that._stopFollowPoll()
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
        that._stopFollowPoll()
        that.setData({ followed: true })
        that._autoAccept()
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
        // 二维码场景值必须用后端算好的 ticket.transfer_scene（绑定在这一次分享上），
        // 不能自己拼 code——否则同一张券换收件人转赠时会复用到别人的历史扫码/关注记录
        var qrCodeUrl = ''
        if (ticket.transfer_scene){
          qrCodeUrl = 'https://' + app.globalData.domainName + '/api/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=' + ticket.transfer_scene)
        }
        that.setData({ ticket: ticket, qrCodeUrl: qrCodeUrl })
      })
      that._checkInitialFollow(code)
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
    if (this.data.code && !this.data.checking && !this.data.followed && !this._followTimer){
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

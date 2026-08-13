// pages/mine/ticket/ticket_share.js
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
var STATUS_POLL_INTERVAL_MS = 2500
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

  // 手动点击"接受"按钮（仅在已经关注公众号的情况下展示此按钮）。
  // 未关注状态下扫码关注后的自动接受，是公众号服务器收到关注事件时直接调用
  // SnowmeetApi 的 AcceptTicketByOaFollow 完成的（见 SnowmeetOfficialAccount 的
  // AcceptGiftedTicket），不在小程序端触发——这里只负责轮询状态、更新界面。
  accept(){
    var that = this
    if (that.data.accepting || !that.data.ticket){
      return
    }
    that.setData({ accepting: true })
    data.acceptTicketPromise(that.data.ticket.code, '分享获得', app.globalData.sessionKey).then(function (){
      that._stopStatusPoll()
      that._goAcceptedSuccess('优惠券已经入账')
    }).catch(function (){
      // 失败已由 performWebRequest 统一 toast（如「不能转赠给自己」「链接可能已失效」）
      that.setData({ accepting: false })
    })
  },

  _goAcceptedSuccess(toastTitle){
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
  },

  // 页面首次加载时查一次当前关注状态：已关注 -> 显示接受按钮；未关注 -> 显示二维码，
  // 之后统一交给 _startStatusPoll 轮询后续变化
  _checkInitialFollow(code){
    var that = this
    data.checkTransferFollowPromise(code, app.globalData.sessionKey).then(function (followed){
      that.setData({ followed: followed, checking: false })
      that._startStatusPoll(code)
    }).catch(function (){
      // 查询失败时兜底当作未关注处理，展示二维码并继续轮询重试，而不是卡死在加载态
      that.setData({ checking: false, followed: false })
      that._startStatusPoll(code)
    })
  },

  _startStatusPoll(code){
    var that = this
    that._stopStatusPoll()
    that._statusTimer = setInterval(function (){
      that._checkStatusOnce(code)
    }, STATUS_POLL_INTERVAL_MS)
  },

  // 轮询这张券的状态：
  // 1. 如果已经不在"分享中"了，要么是公众号那边自动接受成功了，要么是对方撤回了分享——
  //    用 member_id 有没有变化来区分这两种情况（接受会把 member_id 改成我；撤回只会把
  //    shared 清零，member_id 还是原来发起分享的人），分别给出对应的提示，不能笼统当作
  //    "已接受"，否则撤回的情况会误导用户。
  // 2. 如果还在分享中，只更新"是否关注"这个展示状态（未关注显示二维码，已关注显示按钮）。
  _checkStatusOnce(code){
    var that = this
    data.getTicket(code).then(function (ticket){
      if (ticket.shared == 0){
        that._stopStatusPoll()
        if (ticket.member_id != that._originalMemberId){
          that._goAcceptedSuccess('已关注，优惠券自动入账')
        } else {
          wx.showModal({
            title: '提示',
            content: '对方已撤回这张优惠券的分享。',
            showCancel: false,
            success: function (){
              wx.redirectTo({ url: './ticket_list' })
            }
          })
        }
        return
      }
      if (!that.data.followed){
        data.checkTransferFollowPromise(code, app.globalData.sessionKey).then(function (followed){
          if (followed){
            that.setData({ followed: true })
          }
        }).catch(function (){})
      }
    }).catch(function (){
      // 轮询失败静默重试，不打断用户
    })
  },

  _stopStatusPoll(){
    if (this._statusTimer){
      clearInterval(this._statusTimer)
      this._statusTimer = null
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
        that._originalMemberId = ticket.member_id   // 用于轮询时区分"被接受"还是"被撤回"
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
    if (this.data.code && !this.data.checking && !this._statusTimer){
      this._startStatusPoll(this.data.code)
    }
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {
    this._stopStatusPoll()
  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {
    this._stopStatusPoll()
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

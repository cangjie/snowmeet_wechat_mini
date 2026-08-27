// pages/mine/ticket/ticket_claim/ticket_claim.js
// 店员分享发券的领取页（员工发券三条途径之二）。
//
// 与顾客转赠的领取页（ticket_share）分工：那边是「接受一张已存在的券」，
// 这边是「按模板领一张新券」，两条链路各自独立。
//
// 未关注公众号的处理与转赠一致：显示本批次专属带参二维码，扫码关注后
// 公众号把事件落进 oa_receive，这边轮询服务端直到判定已关注，再放出领取按钮。
var app = getApp()
var data = require('../../../../utils/data.js')

var POLL_INTERVAL_MS = 2500

Page({
  data: {
    batchId: 0,
    loading: true,
    errMsg: '',
    info: null,
    qrCodeUrl: '',
    claiming: false,
    doneCode: ''
  },

  onLoad(options) {
    var that = this
    var batchId = parseInt((options && options.batch) || '0', 10) || 0
    that.setData({ batchId: batchId })
    if (!batchId) {
      that.setData({ loading: false, errMsg: '分享链接不完整' })
      return
    }
    app.loginPromiseNew.then(function () { that.load() })
  },

  onUnload() { this._stopPoll() },
  onHide() { this._stopPoll() },

  load() {
    var that = this
    data.getShareBatchPromise(that.data.batchId, app.globalData.sessionKey).then(function (info) {
      // 二维码场景值用服务端算好的（绑定这一次分享），不要自己拼
      var qrCodeUrl = ''
      if (!info.followed && info.scene) {
        qrCodeUrl = 'https://' + app.globalData.domainName
          + '/api/MediaHelper/ShowImageFromOfficialAccount?img='
          + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=' + info.scene)
      }
      that.setData({
        info: info,
        qrCodeUrl: qrCodeUrl,
        doneCode: info.claimed ? info.claimedCode : '',
        loading: false
      })
      if (info.followed && !info.claimed && !info.soldOut) {
        that.onClaim()
        return
      }
      // 还没关注的话开始轮询，扫码关注后自动领取
      if (!info.followed && !info.claimed && !info.soldOut) {
        that._startPoll()
      }
    }).catch(function (msg) {
      that.setData({ loading: false, errMsg: typeof msg === 'string' ? msg : '分享链接已失效' })
    })
  },

  _startPoll() {
    var that = this
    this._stopPoll()
    this._timer = setInterval(function () {
      data.getShareBatchPromise(that.data.batchId, app.globalData.sessionKey).then(function (info) {
        if (info.followed) {
          that._stopPoll()
          that.setData({
            info: info,
            qrCodeUrl: '',
            doneCode: info.claimed ? info.claimedCode : ''
          })
          if (!info.claimed && !info.soldOut) {
            that.onClaim()
          }
        }
      }).catch(function () { that._stopPoll() })
    }, POLL_INTERVAL_MS)
  },

  _stopPoll() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  },

  onClaim() {
    var that = this
    if (that.data.claiming) { return }
    that.setData({ claiming: true })
    data.claimSharedTicketPromise(that.data.batchId, app.globalData.sessionKey).then(function (res) {
      that._stopPoll()
      that.setData({ claiming: false, doneCode: res.code })
      wx.showToast({ title: '领取成功', icon: 'success' })
    }).catch(function () {
      // 失败原因由 performWebRequest 统一 toast（已领过 / 已领完 / 名下同款券太多 / 未关注）
      that.setData({ claiming: false })
      that.load()
    })
  },

  onGoMyTickets() {
    wx.redirectTo({ url: '/pages/mine/ticket/ticket_list' })
  }
})

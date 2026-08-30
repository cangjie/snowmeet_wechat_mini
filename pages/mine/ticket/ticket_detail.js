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
    // 未验证手机号的顾客一进来就被整页遮罩挡住，只能授权或返回。
    // 微信的 getPhoneNumber 只能由 button 直接触发、JS 调不起来，所以"强制"
    // 只能做成一颗盖在页面上的授权按钮，没法自动弹窗。
    needAuth: false,
    authBusy: false,
    transferShow: false,      // 转赠确认弹层
    subscribeBlocked: false   // 订阅被用户永久拒绝，需要引导去设置页
  },

  onNoop(){},

  // 转赠第一步：请求订阅授权。必须在 tap 回调里同步发起（微信硬约束），
  // 所以这里不能先 await 任何东西。授权同意与否都继续开弹层——拒绝只是收不到
  // 领取通知，不该挡住转赠本身。
  onTransferTap(){
    var that = this
    ticketHelper.requestTransferSubscribe(function (blocked){
      that.setData({ transferShow: true, subscribeBlocked: blocked })
    })
  },

  // 用户之前勾了「总是保持以上选择」并拒绝，微信从此不再弹订阅窗，
  // 只能送他去小程序设置页自己打开
  onOpenSubscribeSetting(){
    var that = this
    ticketHelper.openSubscribeSetting(function (stillBlocked){
      that.setData({ subscribeBlocked: stillBlocked })
      if (!stillBlocked){
        wx.showToast({ title: '已开启领取通知', icon: 'success' })
      }
    })
  },

  // 弹层里的「选择好友」被点：微信会同时拉起转发面板（open-type=share），
  // 这里只负责把弹层收起来，免得转发完回来还盖在页面上
  onTransferPanelShareTap(){
    this.setData({ transferShow: false })
  },

  onTransferPanelClose(){
    this.setData({ transferShow: false })
  },

  // 2026-05-29 起 MemberLogin 不再自动建 stub 会员：没验证过手机号的顾客
  // globalData.member 直接是 null；老会员则可能有 member 但 cell 为空
  _checkCell() {
    var m = app.globalData.member
    var cell = m && m.cell ? String(m.cell).trim() : ''
    this.setData({ needAuth: !cell })
  },

  // 授权手机号 → 落库（走次卡购买页同一条链路：UpdateWechatMemberCell，
  // 内部 ResolveOrCreateMemberByCell：按 cell 查到会员就归并并链上当前 openid/unionid，
  // 查不到才建新会员，并回填 mini_session.member_id）
  onGetCell(e) {
    var that = this
    var d = e && e.detail
    if (!d || d.errMsg !== 'getPhoneNumber:ok' || !d.encryptedData || !d.iv) {
      wx.showToast({ title: '需要验证手机号才能查看优惠券', icon: 'none' })
      return
    }
    if (that.data.authBusy) { return }
    that.setData({ authBusy: true })
    data.bindWechatCellPromise(d.encryptedData, d.iv, app.globalData.sessionKey)
      .then(function (member) {
        app.globalData.member = member
        that.setData({ authBusy: false })
        // 后端偶发返回不带 cell 的 member（会话归属没回填上），此时别放行，
        // 否则遮罩没了、人却还是没手机号
        that._checkCell()
      }).catch(function () {
        that.setData({ authBusy: false })
        wx.showToast({ title: '手机号验证失败，请重试', icon: 'none' })
      })
  },

  // 深链直接进来的没有上一页，navigateBack 会失败，兜底回「我的优惠券」
  onAuthBack() {
    wx.navigateBack({
      fail: function () {
        wx.redirectTo({ url: '/pages/mine/ticket/ticket_list' })
      }
    })
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
    // GetTicket 不带会话、判断不了这张券现在归谁，所以"已经转赠出去"这个结论由列表页
    // 从后端拿到后经 URL 带过来（见 ticket_list.showDetail）
    var transferredOut = options.transferred == '1'
    var that = this
    that.setData({ code: code })
    app.loginPromiseNew.then(function (resolve) {
      that._checkCell()
      data.getTicket(code).then(function (ticket) {
        ticket.transferredOut = transferredOut
        ticket = ticketHelper.annotateTicket(ticket, tab)
        if (!ticket.canTransfer){
          wx.hideShareMenu()
        }
        // 2026-08-30：从公众号带参二维码（scene=oper_ticket_code_xxx）换成"内容即券码"的普通二维码。
        // 公众号码里编码的是 weixin.qq.com 短链，券码不在二维码内容里，店员在小程序开单页
        // 用 wx.scanCode 扫它只能拿到那串短链、还原不出券码。
        // 代价（用户已确认接受）：公众号 ScanTicket 那条路——店员用微信扫一扫、公众号回一条
        // 带 miniapp_recept_path 链接的消息——随之失效。
        var qrCodeUrl = 'https://' + app.globalData.domainName + '/api/MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent(code)
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

// pages/mine/ticket/ticket_list.js
const app = getApp()
const data = require('../../../utils/data.js')
// 硬编码：允许转赠的优惠券模板（12=免费打蜡券，16=老顾客优惠券），需与后端 TicketController.TransferableTemplateIds 保持一致
const TRANSFERABLE_TEMPLATE_IDS = [12, 16]

// 优惠券编码 3 位一节、用横线连接，纯展示用（不影响传给后端的原始 code）
function formatTicketCode(code){
  var s = (code || '').toString()
  var parts = []
  for (var i = 0; i < s.length; i += 3){
    parts.push(s.substr(i, 3))
  }
  return parts.join('-')
}

// 给单张券补齐展示用字段。tab=='shared' 时，shared==0 表示"对方已经接受"（不是"待使用"，
// 券已经不是我的了），要单独给一个状态、并且不能再显示"转赠好友"按钮。
function annotateTicket(ticket, tab){
  var memo = ticket.memo
  if (memo.indexOf('>') >= 0 && memo.indexOf('<') >= 0){
    ticket.rich = true
  }
  else{
    ticket.rich = false
    ticket.usage = memo.split(';')
  }
  ticket.codeDisplay = formatTicketCode(ticket.code)
  ticket.canTransfer = TRANSFERABLE_TEMPLATE_IDS.indexOf(ticket.template_id) >= 0 && ticket.used != 1
  if (ticket.used == 1){
    ticket.statusText = '已使用'
    ticket.statusClass = 'status-used'
  }
  else if (ticket.shared == 1){
    ticket.statusText = '分享中'
    ticket.statusClass = 'status-shared'
  }
  else if (tab == 'shared'){
    ticket.statusText = '对方已接受'
    ticket.statusClass = 'status-accepted'
    ticket.canTransfer = false   // 已经不是我的了，不能再转赠
  }
  else{
    ticket.statusText = '待使用'
    ticket.statusClass = 'status-pending'
  }
  return ticket
}

Page({

  /**
   * Page initial data
   */
  data: {
    activeTab: 'pending',   // pending: 未使用 | shared: 已分享 | used: 已使用
    ticketArr:[],
    needAuth: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    var tab = options.tab || 'pending'
    this.setData({ activeTab: tab })
    app.loginPromiseNew.then(function(resolve){
      if (tab == 'shared'){
        data.getMySharedTicketsPromise(app.globalData.sessionKey).then(function (tickets){
          tickets = (tickets || []).map(function (t){ return annotateTicket(t, tab) })
          that.setData({ ticketArr: tickets })
        }).catch(function (exp){})
        return
      }
      var used = (tab == 'used') ? 1 : 0
      data.getMyTickets(used, app.globalData.sessionKey).then(function (tickets){
        tickets = (tickets || []).map(function (t){ return annotateTicket(t, tab) })
        // used=0 拉回来的既有待使用也有分享中的："未使用" tab 只留没在分享中的，
        // 分享中的挪到"已分享" tab 去看（那边走的是 GetMySharedTickets）
        if (tab == 'pending'){
          tickets = tickets.filter(function (t){ return t.shared != 1 })
        }
        that.setData({ ticketArr: tickets })
      }).catch(function (exp){})
    })
  },
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {
    // 转赠成功后不能在 onShareAppMessage 里直接跳转（分享面板此时可能还没弹出/还没关闭），
    // 等分享面板关闭、页面重新可见时再跳到"已分享" tab
    if (this._justShared && this.data.activeTab != 'shared'){
      this._justShared = false
      wx.redirectTo({ url: 'ticket_list?tab=shared' })
    }
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share, or a "转赠" button (open-type="share")
   */
  onShareAppMessage: function (res) {
    var that = this
    var code = res && res.target && res.target.dataset ? res.target.dataset.code : undefined
    if (!code){
      return {}
    }
    var ticket = (that.data.ticketArr || []).filter(function (t){ return t.code === code })[0]
    var title = ticket ? ('赠送优惠券：' + ticket.name) : '赠送优惠券'
    return data.setTicketToSharePromise(code, app.globalData.sessionKey).then(function (){
      // 分享成功后这张券归到"已分享"标签，不再属于当前"未使用"列表，直接移出；
      // 真正的页面跳转放到 onShow 里做（见上面的注释）
      that._removeTicketFromList(code)
      that._justShared = true
      return {
        title: title,
        path: '/pages/mine/ticket/ticket_share?code=' + code,
        imageUrl: 'https://' + app.globalData.domainName + '/images/snowmeet_logo.png'
      }
    }).catch(function (){
      return {}
    })
  },
  /**
   * 从当前列表中移除某张券（转赠/撤回分享成功后用，这张券已经不属于当前 tab 了）
   */
  _removeTicketFromList: function (code){
    var arr = this.data.ticketArr.filter(function (t){ return t.code !== code })
    this.setData({ ticketArr: arr })
  },
  onCancelShare: function (e){
    var that = this
    var code = e.currentTarget.dataset.code
    wx.showModal({
      title: '撤回分享',
      content: '撤回后，对方将无法再通过分享链接接受这张优惠券。',
      confirmText: '撤回',
      confirmColor: '#EF4444',
      success: function (res){
        if (!res.confirm){
          return
        }
        data.cancelShareTicketPromise(code, app.globalData.sessionKey).then(function (){
          // 撤回后这张券回到"未使用"标签，不再属于当前"已分享"列表，直接移出
          that._removeTicketFromList(code)
          wx.showToast({ title: '已撤回分享，可在"未使用"中查看', icon: 'none' })
        }).catch(function (){})
      }
    })
  },
  showDetail: function(source){
    if (this.data.activeTab == 'used'){
      return
    }
    var code = source.currentTarget.id
    wx.navigateTo({
      url: 'ticket_detail?code=' + code,
    })
  }
})

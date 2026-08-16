// pages/mine/ticket/ticket_list.js
const app = getApp()
const data = require('../../../utils/data.js')
const ticketHelper = require('./ticket_helper.js')

// 把后端下发的 expireText（yyyy.M.d，不补零）转成可字典序比较的键；
// 「长期有效」用 '9999' 排到最后
function _expireKey(t){
  var s = t.expireText || ''
  var m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(s)
  if (!m){ return '9999' }
  return m[1] + ('0' + m[2]).slice(-2) + ('0' + m[3]).slice(-2)
}

Page({

  /**
   * Page initial data
   */
  data: {
    activeTab: 'pending',   // pending: 未使用 | shared: 已分享 | used: 已使用
    ticketArr:[],
    summaryText: '',        // 「3 张可用 · 1 张 30 天内到期」，仅未使用 tab
    pendingCount: 0,        // 未使用 tab 上的角标数量
    sortBy: 'expire',       // expire 按有效期 | time 按获得时间
    sortLabel: '按有效期排序',
    expandedCode: '',       // 当前展开「使用说明」的券码，一次只展开一张
    needAuth: false,
    transferShow: false,      // 转赠确认弹层
    transferCode: '',
    subscribeBlocked: false   // 订阅被用户永久拒绝，需要引导去设置页
  },

  onNoop: function (){},

  // 转赠第一步：请求订阅授权。必须在 tap 回调里同步发起（微信硬约束），
  // 所以这里不能先 await 任何东西。授权同意与否都继续开弹层——拒绝只是收不到
  // 领取通知，不该挡住转赠本身。
  onTransferTap: function (e){
    var that = this
    var code = e.currentTarget.dataset.code
    ticketHelper.requestTransferSubscribe(function (blocked){
      that.setData({ transferShow: true, transferCode: code, subscribeBlocked: blocked })
    })
  },

  // 用户之前勾了「总是保持以上选择」并拒绝，微信从此不再弹订阅窗，
  // 只能送他去小程序设置页自己打开
  onOpenSubscribeSetting: function (){
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
  onTransferPanelShareTap: function (){
    this.setData({ transferShow: false })
  },

  onTransferPanelClose: function (){
    this.setData({ transferShow: false })
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
          tickets = that._dedupeByCode(tickets || [])
          tickets = tickets.map(function (t){ return ticketHelper.annotateTicket(t, tab) })
          that._render(tickets)
        }).catch(function (exp){})
        return
      }
      var used = (tab == 'used') ? 1 : 0
      data.getMyTickets(used, app.globalData.sessionKey).then(function (tickets){
        tickets = (tickets || []).map(function (t){ return ticketHelper.annotateTicket(t, tab) })
        // used=0 拉回来的既有待使用也有分享中的："未使用" tab 只留没在分享中的，
        // 分享中的挪到"已分享" tab 去看（那边走的是 GetMySharedTickets）
        if (tab == 'pending'){
          tickets = tickets.filter(function (t){ return t.shared != 1 })
        }
        that._render(tickets)
      }).catch(function (exp){})
    })
  },

  // 排序 + 汇总行 + 角标数量，统一在这里派生（WXML 表达式不支持方法调用）
  _render: function (tickets){
    tickets = this._sort(tickets || [])
    var urgent = tickets.filter(function (t){ return t.expireUrgent }).length
    var summary = ''
    if (this.data.activeTab == 'pending' && tickets.length > 0){
      summary = tickets.length + ' 张可用'
      if (urgent > 0){ summary += ' · ' + urgent + ' 张 30 天内到期' }
    }
    this.setData({
      ticketArr: tickets,
      summaryText: summary,
      // 角标只在未使用 tab 显示：三个 tab 是 redirect 各自重新加载页面，
      // 站在别的 tab 上拿不到未使用的张数，为一个角标再多打一次接口不值当
      pendingCount: this.data.activeTab == 'pending' ? tickets.length : 0
    })
  },

  _sort: function (tickets){
    var byExpire = this.data.sortBy == 'expire'
    return tickets.slice().sort(function (a, b){
      if (byExpire){
        // 后端不下发可比较的到期时间戳，用 expireText（yyyy.M.d）补零后按字典序排；
        // 「长期有效」排最后
        var ka = _expireKey(a), kb = _expireKey(b)
        if (ka !== kb){ return ka < kb ? -1 : 1 }
      }
      // 同到期日、或按获得时间排：新的在前
      var ta = a.displayTimeText || '', tb = b.displayTimeText || ''
      if (ta !== tb){ return ta > tb ? -1 : 1 }
      return 0
    })
  },

  onToggleSort: function (){
    var next = this.data.sortBy == 'expire' ? 'time' : 'expire'
    this.setData({
      sortBy: next,
      sortLabel: next == 'expire' ? '按有效期排序' : '按获得时间排序'
    })
    this._render(this.data.ticketArr)
  },

  // 「使用说明」折叠：一次只展开一张，再点一次收起
  onToggleUsage: function (e){
    var code = e.currentTarget.dataset.code
    this.setData({ expandedCode: this.data.expandedCode == code ? '' : code })
  },
  /**
   * 按 code 去重，防止同一张券因为历史多次转赠记录被后端重复返回（前端兜底，后端也会去重）
   */
  _dedupeByCode: function (tickets){
    var seen = {}
    var out = []
    for (var i = 0; i < tickets.length; i++){
      if (!seen[tickets[i].code]){
        seen[tickets[i].code] = true
        out.push(tickets[i])
      }
    }
    return out
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
    // 走 _render 而不是直接 setData：汇总行的可用张数和 tab 角标要跟着变
    this._render(arr)
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
    // 详情页拉券走的是 GetTicket（不带会话、判断不了归属），所以把列表这边由后端
    // 下发的"已转赠出去"结论一并带过去，保证两页的状态和操作权限一致
    var current = (this.data.ticketArr || []).filter(function (t){ return t.code == code })[0]
    var transferred = (current && current.transferredOut) ? 1 : 0
    wx.navigateTo({
      url: 'ticket_detail?code=' + code + '&tab=' + this.data.activeTab + '&transferred=' + transferred,
    })
  }
})

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
    var used = (tab == 'used') ? 1 : 0
    app.loginPromiseNew.then(function(resolve){
      data.getMyTickets(used, app.globalData.sessionKey).then(function (tickets){
        for(var i = 0; i < tickets.length; i++){

          var memo = tickets[i].memo
          if (memo.indexOf('>') >= 0 && memo.indexOf('<') >= 0){
            tickets[i].rich = true
          }
          else{
            tickets[i].rich = false
            tickets[i].usage = memo.split(';')
          }
          tickets[i].codeDisplay = formatTicketCode(tickets[i].code)
          tickets[i].canTransfer = TRANSFERABLE_TEMPLATE_IDS.indexOf(tickets[i].template_id) >= 0 && tickets[i].used != 1
          if (tickets[i].used == 1){
            tickets[i].statusText = '已使用'
            tickets[i].statusClass = 'status-used'
          }
          else if (tickets[i].shared == 1){
            tickets[i].statusText = '分享中'
            tickets[i].statusClass = 'status-shared'
          }
          else{
            tickets[i].statusText = '待使用'
            tickets[i].statusClass = 'status-pending'
          }
        }
        // used=0 拉回来的既有待使用也有分享中的，按当前 tab 再筛一遍；
        // used=1（已使用）不会有分享中的（分享/转赠前置条件就排除了已使用的券），不用筛
        if (tab == 'shared'){
          tickets = tickets.filter(function (t){ return t.shared == 1 })
        }
        else if (tab == 'pending'){
          tickets = tickets.filter(function (t){ return t.shared != 1 })
        }
        that.setData({ticketArr: tickets})
      }).catch(function (exp){

      })
    })
  },
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

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
      // 分享成功后这张券归到"已分享"标签，不再属于当前"未使用"列表，直接移出
      that._removeTicketFromList(code)
      wx.showToast({ title: '已转赠，可在"已分享"中查看', icon: 'none' })
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

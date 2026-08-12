// pages/mine/ticket/ticket_list.js
const app = getApp()
const data = require('../../../utils/data.js')
// 硬编码：允许转赠的优惠券模板（12=免费打蜡券，16=老顾客优惠券），需与后端 TicketController.TransferableTemplateIds 保持一致
const TRANSFERABLE_TEMPLATE_IDS = [12, 16]
Page({

  /**
   * Page initial data
   */
  data: {
    showUsed: false,
    ticketArr:[],
    needAuth: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    if (options.used != undefined && options.used != 0){
      this.setData({showUsed: true})
    }
    app.loginPromiseNew.then(function(resolve){
      data.getMyTickets((!that.data.showUsed?0:1), app.globalData.sessionKey).then(function (tickets){
        for(var i = 0; i < tickets.length; i++){

          var memo = tickets[i].memo
          if (memo.indexOf('>') >= 0 && memo.indexOf('<') >= 0){
            tickets[i].rich = true
          }
          else{
            tickets[i].rich = false
            tickets[i].usage = memo.split(';')
          }
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
      that._patchTicketStatus(code, { shared: 1, statusText: '分享中', statusClass: 'status-shared' })
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
   * 就地更新某张券在 ticketArr 里的字段（分享/撤回分享成功后用），避免整页重新拉取
   */
  _patchTicketStatus: function (code, patch){
    var arr = this.data.ticketArr
    for (var i = 0; i < arr.length; i++){
      if (arr[i].code === code){
        Object.assign(arr[i], patch)
        break
      }
    }
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
          that._patchTicketStatus(code, { shared: 0, statusText: '待使用', statusClass: 'status-pending' })
          wx.showToast({ title: '已撤回分享', icon: 'success' })
        }).catch(function (){})
      }
    })
  },
  showDetail: function(source){
    if (this.options.used == 1){
      return
    }
    var code = source.currentTarget.id
    wx.navigateTo({
      url: 'ticket_detail?code=' + code,
    })
  }
})
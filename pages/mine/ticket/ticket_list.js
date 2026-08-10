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
    usedColor: 'gray',
    unUsedColor: 'red',
    showUsed: false,
    ticketTitleColor: 'greenyellow',
    showCover: 'none',
    ticketArr:[],
    currentQrUrl :'',
    currentY: 0,
    opacity: 0,
    needAuth: false
  },
  
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    if (options.used != undefined && options.used != 0){
      this.setData({showUsed: true, usedColor: 'red', unUsedColor: 'gray', ticketTitleColor:'gray'})
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
          //tickets[i].usage = tickets[i].memo.split(';')
          tickets[i].canTransfer = TRANSFERABLE_TEMPLATE_IDS.indexOf(tickets[i].template_id) >= 0 && tickets[i].used != 1
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
      return {
        title: title,
        path: '/pages/mine/ticket/ticket_share?code=' + code
      }
    }).catch(function (){
      return {}
    })
  },
  showDetail: function(source){
    console.log(source)
    if (this.options.used == 1){
      return
    }
    var code = source.currentTarget.id

    wx.navigateTo({
      url: 'ticket_detail?code=' + code,
    })


    //var qrCodeUrl = 'http://weixin.snowmeet.top/show_wechat_temp_qrcode.aspx?scene=oper_ticket_code_' + code

    /*

    var qrCodeUrl = 'https://' + app.globalData.domainName + '/core/MediaHelper/ShowImageFromOfficialAccount?img=' 
    //+ encodeURIComponent('show_qrcode.aspx?qrcodetext=' + code)
    + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=oper_ticket_code_' + code)


    this.setData({currentQrUrl: qrCodeUrl, currentX: 200,currentY:source.detail.y, showCover: 'block', opacity: 0.8 })
   
    */
  },
  hideDetail: function(){
    this.setData({showCover: 'none', opacity: 0})
  }
})
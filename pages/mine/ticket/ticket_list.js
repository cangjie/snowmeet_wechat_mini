// pages/mine/ticket/ticket_list.js
const app = getApp()
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
  AuthFinish(){
    var that = this
    that.GetRealName()
  },

  GetRealName(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/GetMiniUserOld?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res) => {
        if (res.data.mini_users.length > 0){
          that.setData({name: res.data.mini_users[0].real_name, cell: res.data.mini_users[0].cell_number})
          app.globalData.cellNumber = that.data.cell
        }
        
      }
    })
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
      /*
      if (app.globalData.cellNumber==undefined || app.globalData.cellNumber==null || app.globalData.cellNumber==''){
        that.setData({needAuth: true})
      }
      */
      var getTicketsUrl = 'https://' + app.globalData.domainName + '/core/Ticket/GetMyTickets/' + (!that.data.showUsed? '0' :'1') + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getTicketsUrl,
        success: (res)=>{
          var tickets = res.data
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
          }
          that.setData({ticketArr: tickets})
        }
      })
    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
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
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

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
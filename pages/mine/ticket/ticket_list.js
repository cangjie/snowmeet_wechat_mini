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
    currentY: 0
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
      var getTicketsUrl = 'https://' + app.globalData.domainName + '/core/Ticket/GetMyTickets/' + (!that.data.showUsed? '0' :'1') + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getTicketsUrl,
        success: (res)=>{
          var tickets = res.data
          for(var i = 0; i < tickets.length; i++){
            tickets[i]. usage = tickets[i].memo.split(';')
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
    var code = source.currentTarget.id
    var qrCodeUrl = 'http://weixin.snowmeet.top/show_wechat_temp_qrcode.aspx?scene=oper_ticket_id_' + code
    wx.getImageInfo({
      src: qrCodeUrl,
      success:(res)=>{
        var context = wx.createCanvasContext('img', this)
        context.drawImage(res.path, 0, 0, 150, 150)
        context.draw()
        this.setData({currentQrUrl: qrCodeUrl, currentY:source.detail.y, showCover: 'block'})
        
      }
    })
    
  },
  hideDetail: function(){
    this.setData({showCover: 'none'})
  }
})
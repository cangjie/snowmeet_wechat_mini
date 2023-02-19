// pages/admin/ticket/ticket_template_list.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    ticketTemplateArr:[],
    channelArr:[],
    channelIndex:0,
    channelName:''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    
    var that = this
    var channel = ((options.channel == undefined)? '' : options.channel.trim())
    app.loginPromiseNew.then(function(resolve){
      var getTemplateUrl = 'https://'  + app.globalData.domainName + '/core/Ticket/GetTemplateList'
      wx.request({
        url: getTemplateUrl,
        method: 'GET',
        success:(res)=>{
          var ticketTemplateArr = res.data
          for(var i = 0; i < ticketTemplateArr.length; i++){
            ticketTemplateArr[i].usage = ticketTemplateArr[i].memo.trim().split(';')
            ticketTemplateArr[i].printNum = 1
          }
          var channelArr = []

          var getChannelUrl = 'https://' + app.globalData.domainName + '/core/Ticket/GetMyTickets/0?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: getChannelUrl,
            success:(res)=>{
              var myTickets = res.data
              for(var i = 0; i < ticketTemplateArr.length; i++){
                ticketTemplateArr[i].enable = true
                for(var j = 0; j < myTickets.length; j++){
                  if (myTickets[j].template_id == ticketTemplateArr[i].id){
                    ticketTemplateArr[i].enable = true
                    break
                  }
                }
              }
              that.setData({ticketTemplateArr: ticketTemplateArr, channel: channel})
              
            }
          })
          
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
  
  
 
  get(e){
    console.log('get ticket', e.currentTarget.id)
    
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/Ticket/GenerateTicketsByUser/' + e.currentTarget.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&channel=' + encodeURIComponent(that.data.channel)
    wx.request({
      url: getUrl,
      method: 'GET',
      complete:(res)=>{
        wx.showToast({
          title: '优惠券领取成功',
          icon: 'success',
          complete:()=>{
            wx.redirectTo({
              url: '../mine/ticket/ticket_list',
            })
          }
        })
      }
    })

  }
})
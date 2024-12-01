// pages/tickets/get_ticket_from_channel.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    isMember: false,
    haveJoin: false
  },

  getTicketTemplate(){
    var that = this
    var templateId = that.data.templateId
    var getUrl = 'https://' + app.globalData.domainName + '/core/Ticket/GetTicketTemplateById/' + templateId.toString()
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var template = res.data
        template.usage = template.memo.split(';')
        console.log('get template', template)
        that.setData({template})
      }
    })

  },

  getMyTicket(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/Ticket/GetMyTickets/0?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    var tickets = []
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          that.setData({tickets})
          return
        }
        var unUsedTickets = res.data
        for(var i = 0; i < unUsedTickets.length; i++){
          tickets.push(unUsedTickets[i])
        }
        url = 'https://' + app.globalData.domainName + '/core/Ticket/GetMyTickets/1?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: url,
          method: 'GET',
          success:(res)=>{
            if (res.statusCode != 200){
              return
            }
            var usedTickets = res.data
            for(var i = 0; i < usedTickets.length; i++){
              tickets.push(usedTickets[i])
            }
            that.setData({tickets})
            console.log('tickets', tickets)
            for(var i = 0; i < tickets.length; i++){
              if (tickets[i].template_id == that.data.templateId){
                that.setData({haveJoin: true})
                console.log('joined', that.data.haveJoin)
              }
            }
          }
        })
      }
    })
  },

  getCell(e){
    var that = this
    var enc = e.detail.encryptedData
    var iv = e.detail.iv
    var updateUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/UpdateWechatMemberCell?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&encData=' + encodeURIComponent(enc) + '&iv=' + encodeURIComponent(iv)
    wx.request({
      url: updateUrl,
      method:'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        that.pickTicket()
      }
    })
  },

  pickTicket(e){
    var that = this
    var source = that.data.source == 'common' ? '' : that.data.source
    var url = 'https://' + app.globalData.domainName + '/core/Ticket/GenerateTicketsByUser/' + that.data.templateId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&channel=' + encodeURIComponent(source)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        console.log('pick ticket success', res.data)
        wx.showToast({
          title: '领取成功。',
          icon: 'success'
        })
        wx.navigateTo({
          url: '/pages/mine/ticket/ticket_list',
        })
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var templateId = options.id
    var source = options.source
    var that = this
    that.setData({templateId, source})
    that.getTicketTemplate()
    app.loginPromiseNew.then(function(resovle){
      console.log('app data', app.globalData)
      var title = '注册会员，领取养护代金券。'
      if (app.globalData.memberInfo && app.globalData.memberInfo.cell){
        that.setData({isMember: true})
        title = '会员福利-养护代金券'
        that.getMyTicket()
      }
      wx.setNavigationBarTitle({
        title: title
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
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  }
})
// pages/mine/ticket/ticket_bind.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    needToGetCell: false,
    needToGetInfo: false,
    
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    app.loginPromiseNew.then(function (resolve){
      if (app.globalData.cellNumber == undefined || app.globalData.cellNumber == null || app.globalData.cellNumber == ''){
        that.setData({neettoGetCell: true})
      }
      else{
        if (app.globalData.userInfo == undefined || app.globalData.userInfo == null) {
          that.setData({needToGetInfo: true})
        }
      }
    })
    var getTicketUrl = 'https://' + app.globalData.domainName + '/core/ticket/getticket/' + options.ticketCode
    wx.request({
      url: getTicketUrl,
      success:(res)=>{
        var ticket = res.data
        if (ticket!=null){
          ticket.usage = ticket.memo.split(';')
        }
        that.setData({ticket: ticket})
      }
    })
  },
  onUpdateCellSuccess: function() {
    if (app.globalData.userInfo == undefined || app.globalData.userInfo == null) {
      that.setData({needToGetInfo: true, needToGetCell: false})
    }
    else {
      that.setData({needToGetCell: false})
    }
  },

  gotoBind: function(){
    var ticket = this.data.ticket
    var bindUrl = 'https://' + app.globalData.domainName + '/core/ticket/bind/' + ticket.code + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: bindUrl,
      success: (res)=>{
        var content = '绑定失败'
        if (res.data){
          content = '绑定成功'
        }
        wx.showToast({
          title: content,
          duration: 3000,
          success:(res)=>{
            setTimeout(() => {
              wx.navigateTo({
                url: './ticket_list',
              })
            }, 3000);
            /*
            wx.navigateTo({
              url: './ticket_list',
            })
            */
          }
        })
      }
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

  }
})
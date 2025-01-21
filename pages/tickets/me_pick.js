// pages/tickets/me_pick.js
const app = getApp()
const util = require('../../utils/util')
Page({

  /**
   * Page initial data
   */
  data: {

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({templateId: options.templateId, channel: options.channel})
    app.loginPromiseNew.then(function(resolve){
      that.getTickets()
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

  },
  getTickets(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/Ticket/MeGetTickListByMember/' + that.data.templateId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var tickets = res.data
        if (tickets.length == 0){
          that.pickTicket()
        }
        that.setData({tickets})
      }
    })
  },
  pickTicket(){
    var that = this
    var pickUrl = 'https://' + app.globalData.domainName + '/core/Ticket/MePickTicket/' + that.data.templateId + '?channel=' + encodeURIComponent(that.data.channel) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: pickUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        wx.showToast({
          title: '领取成功',
          icon: 'success'
        })
        that.getTickets()
      }
    })
  }
})
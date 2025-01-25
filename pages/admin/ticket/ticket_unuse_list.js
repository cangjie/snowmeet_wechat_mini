// pages/admin/ticket/ticket_unuse_list.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {

  },
  showError(msg){
    wx.showToast({
      title: msg,
      icon: 'error',

    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({openId: options.openid})
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
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.getData()
    })
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
  getData(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/Ticket/GetTicketsByUser/0?openId=' + encodeURIComponent(that.data.openId) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var tickets = res.data
        for (var i = 0; i < tickets.length; i++){
          var memo = tickets[i].memo
          if (memo.indexOf('>') >= 0 && memo.indexOf('<') >= 0){
            tickets[i].rich = true
          }
          else{
            tickets[i].rich = false
            tickets[i].usage = memo.split(';')
          }
        }
        console.log(tickets)
        that.setData({tickets})
      }
    })
    
  },
  use(e){
    var that = this
    var code = e.currentTarget.id
    var useUrl = 'https://' + app.globalData.domainName + '/core/Ticket/Use/' + code + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: useUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          that.showError('核销失败')
        }
        wx.showModal({
          title: '核销成功',
          content: '是否留在该页，还是现实二维码核销下一位客人？',
          cancelText: '留在该页',
          confirmText: '下一位',
          complete: (res) => {
            if (res.cancel) {
              that.getData()
            }
        
            if (res.confirm) {
              wx.navigateBack()
            }
          }
        })
      }
    })

  }
})
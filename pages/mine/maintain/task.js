// pages/mine/maintain/task.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {

  },
  getData(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetTask/' + that.data.taskId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var item = res.data
        var qrcodeUrl = 'https://' + app.globalData.domainName + '/core/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_qrcode.aspx?qrcodetext=') + encodeURIComponent('https://mini.snowmeet.top/mapp/admin/maintain/task/' + that.data.taskId)
        that.setData({item: item, order: item.order, qrcodeUrl: qrcodeUrl})
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({taskId: options.id})
    app.loginPromiseNew.then(function (resolve){
      that.getData()
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
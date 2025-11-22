// pages/admin/ski_pass/reserve_qrcode.js
const app = getApp()
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
    app.loginPromiseNew.then(function(resolve){
      //that.getMemberId()
      that.getQrCode()
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
  getMemberId(){
    var that = this
    var getMemberUrl = 'https://' + app.globalData.domainName + '/core/Member/GetMemberByCell/' + app.globalData.memberInfo.cell + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getMemberUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var memberId = res.data.id
        that.setData({memberId})
        that.getQrCode()
      }
    
    })
  },
  getQrCode(){
    var that = this
    var memberId = that.data.memberId
    var scene = 'reserveskipassbystaff_' + app.globalData.staff.id.toString()
    var getUrl = 'https://wxoa.snowmeet.top/api/OfficialAccountApi/GetOALimitQrCodeBySessionKey?content=' + encodeURIComponent(scene) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var qrUrl = res.data
        that.setData({qrUrl})
      }
    })
  }

})
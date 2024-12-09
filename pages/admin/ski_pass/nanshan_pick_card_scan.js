// pages/admin/ski_pass/nanshan_pick_card_scan.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    qrCodeRetryTimes: 0
  },

  getQrCode(){
    var that = this
    var getQrUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetInterviewIdByScene?scene=nanshanskipass&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    that.data.qrCodeRetryTimes = that.data.qrCodeRetryTimes + 1
    wx.request({
      url: getQrUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          if (that.data.qrCodeRetryTimes < 3){
            setTimeout(() => {
              that.getQrCode()
            }, 1000);
          }
          return
        }
        var id = parseInt(res.data)
        that.setData({id})
        var scene = 'nanshanskipass_interact_id_' + id.toString()
        var getQRUrl = 'https://wxoa.snowmeet.top/api/OfficialAccountApi/GetOAQRCodeUrl?content=' + scene
        wx.request({
          url: getQRUrl,
          method: 'GET',
          success:(res)=>{
            console.log('get qrcode', res)
            var interVal = setInterval(that.checkScan, 1000)
            that.setData({qrcodeUrl: res.data,interVal})
          }
        })
      }
    })
  },
  checkScan(){
    var that = this
    var checkScanUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetScanInfo/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: checkScanUrl,
      success:(res)=>{
        console.log('check scan', res)
        if (res.statusCode != 200 && res.statusCode != 404){
          clearInterval(that.data.interVal)
        }
        else if (res.statusCode == 200){
          clearInterval(that.data.interVal)
          var scan = res.data
          var jumpUrl = ''
          if (scan && scan.member){
            jumpUrl = 'nanshan_verify?memberId=' + scan.member.id.toString()
            if (scan.member.wechatMiniOpenId){
              jumpUrl += '&openId=' + encodeURIComponent(scan.member.wechatMiniOpenId)
            }
          }
          wx.redirectTo({
            url: jumpUrl,
          })
          

        }
      },
      fail:(res)=>{
        clearInterval(that.data.interVal)
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
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
    var that = this
    clearInterval(that.data.interVal)
  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {
    var that = this
    clearInterval(that.data.interVal)
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
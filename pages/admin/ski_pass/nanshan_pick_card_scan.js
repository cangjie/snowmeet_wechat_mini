// pages/admin/ski_pass/nanshan_pick_card_scan.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {

  },

  getQrCode(){
    var that = this
    var getQrUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetInterviewIdByScene?scene=nanshanskipass&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getQrUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
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
          //clearInterval(that.data.interVal)
          var scan = res.data
          var needJump = false
          if (scan.scan ==1){
            var word = '顾客已扫码。'
            if (scan.member == null || scan.member.cell == null || scan.member.cell == '' ){
              word = '顾客不是会员，必须填写手机号。'
            }
            else {
              word = ''
              clearInterval(that.data.interVal)
              needJump = true
            }
            if (word != ''){
              wx.showToast({
                title: word,
                duration: 2000
              })
            }
            if (needJump){
              clearInterval(that.data.interVal)
              var jumpUrl = 'recept_member_info?openId=' + res.data.member.wechatMiniOpenId
              wx.redirectTo({
                url: jumpUrl,
              })
            }
          }
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
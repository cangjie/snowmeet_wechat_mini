const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    interValRetryTimes: 0
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    
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
      that.getQrCode()
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

  },
  getQrCode(){
    var that = this
    if (that.data.interVal != undefined){
      return
    }
    var getScanIdUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetInterviewIdByScene?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&scene=' + encodeURIComponent('觅计划旗舰引流')
    wx.request({
      url: getScanIdUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          that.showError('系统故障')
        }
        var id = res.data
        that.setData({actId: id})
        var scene = 'recept_interact_id_' + id
          var getQRUrl = 'https://wxoa.snowmeet.top/api/OfficialAccountApi/GetOAQRCodeUrl?content=' + scene
          wx.request({
            url: getQRUrl,
            method: 'GET',
            success:(res)=>{
              console.log('get qrcode', res)
              that.setData({qrcodeUrl: res.data})
              var interVal = setInterval(that.scan, 1000)
              that.setData({interVal})
            }
          })
      }
    })
  },
  showError(msg){
    wx.showToast({
      title: msg,
      icon: 'error',

    })
  },
  scan(){
    var that = this
    if (that.data.actId == undefined){
      clearInterval(that.data.interVal)
    }
    var scanUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetScanInfo/' + that.data.actId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: scanUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200 && res.statusCode != 404){
          that.data.interValRetryTimes++
          if (that.data.interValRetryTimes > 10){
            clearInterval(that.data.interVal)
            that.data.interVal = undefined
            that.showError('网络不通')
          }
          return
        }
        var scan = res.data
        that.data.interValRetryTimes = 0
        console.log('scan', scan)
        if (scan.scan == 1){
          clearInterval(that.data.interVal)
          that.data.interVal = undefined
          that.data.actId = undefined
          
          wx.navigateTo({
            url: 'ticket_unuse_list?openid=' + scan.miniAppUser.open_id
          })
          
        }
      }
    })
  }
})
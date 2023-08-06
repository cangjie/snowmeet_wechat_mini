// pages/admin/recept/recept_entry.js
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
      that.setData({role: app.globalData.role})
      if (that.data.role != 'staff'){
        return
      }
      var getScanIdUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetInterviewId?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getScanIdUrl,
        method: 'GET',
        success:(res)=>{
          console.log('get interview id', res)
          if (res.statusCode != 200){
            return
          }
          var id = res.data
          if (id <= 0){
            return
          }
          var interVal = setInterval(that.checkScan, 1000)
          var qrcodeUrl = 'https://' + app.globalData.domainName + '/core/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=recept_interact_id_' + id)
          that.setData({qrcodeUrl: qrcodeUrl, interVal: interVal, actId: id})
        }
      })
    })
  },
  checkScan(){
    var that = this
    var checkScanUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetScanInfo/' + that.data.actId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
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
          var needJump = false
          if (scan.scan ==1){
            var word = '顾客已扫码。'
            if (scan.miniAppUser == null || scan.miniAppUser.cell_number == ''){
              word = '顾客不是会员。'
            }
            else {
              word = '顾客是会员。'
              clearInterval(that.data.interVal)
              needJump = true
            }
            wx.showToast({
              title: word,
              duration: 2000
            })
            if (needJump){
              clearInterval(that.data.interVal)
              var jumpUrl = 'recept_member_info?openId=' + res.data.miniAppUser.open_id
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
// pages/admin/recept/recept_summary.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {

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
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var id = options.id
    var that = this
    that.setData({id: id})
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
    app.loginPromiseNew.then(function (resolve){
        var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + that.data.id 
            + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: getUrl,
          method: 'GET',
          success:(res)=>{
            if (res.statusCode != 200){
                return
            }
            var recept = res.data
            console.log('recept', recept)
            var needPay = true
            var zeroPay = false
            switch(recept.recept_type){
              case '租赁下单':
                if (recept.rentOrder.pay_option == '招待'){
                  needPay = false
                }
                else if (recept.rentOrder.order_id == 0){
                  zeroPay = false 
                }
                break
              default:
                break
            }
            var qrcodeUrl = 'https://' + app.globalData.domainName + '/core/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=recept_interact_id_' + that.data.id)
            if (recept.open_id == ''){
              var interVal = setInterval(that.checkScan, 1000)
            }
            that.setData({recept: recept, needPay: needPay, zeroPay: zeroPay, qrcodeUrl: qrcodeUrl})
          }
        })
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

  }
})
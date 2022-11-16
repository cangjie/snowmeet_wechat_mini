// pages/admin/sale/shop_sale_entry.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    role: '',
    cell: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onShow(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      if (app.globalData.role == 'staff') {


        

        that.setData({role: app.globalData.role, sessionKey: encodeURIComponent(app.globalData.sessionKey)})
        var getScanIdUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetInterviewId?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: getScanIdUrl,
          method: 'GET',
          success:(res)=>{
            var id = res.data
            if (id > 0){
              var interVal = setInterval(that.checkScan, 1000)
              var qrcodeUrl = 'https://' + app.globalData.domainName + '/core/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=shop_sale_interact_id_' + id)
              that.setData({qrcodeUrl: qrcodeUrl, interVal: interVal, actId: id})
            }
          }
        })
      }
    })
  },
  onUnload: function(){
    clearInterval(this.data.interVal)
  },
  onHide:function(){
    clearInterval(this.data.interVal)
  },
  checkScan: function(){
    var that = this
    var checkScanUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetScanInfo/' + that.data.actId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: checkScanUrl,
      success:(res)=>{
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
              var jumpUrl = 'shop_sale?openid=' + res.data.miniAppUser.open_id + (that.data.mi7OrderStr!=''? '&mi7OrderStr=' + that.data.mi7OrderStr: '')
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
  cellChanged(e){
    this.setData({cell: e.detail.value})
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

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
  gotoShopSale() {
    var that = this
    clearInterval(that.data.interVal)
    wx.navigateTo({
      url: 'shop_sale?cell=' + that.data.cell + (that.data.mi7OrderStr!=''? ('&mi7OrderStr=' + that.data.mi7OrderStr): ''),
    })
  },
  scan(){
    wx.scanCode({
      onlyFromCamera: false,
      success: (res)=>{
        console.log('scan code', res)
        wx.navigateTo({
          url: res.result,
        })
      }
    })
  },
  getMi7Order(e){
    console.log('mi7 order str', e)
    var that = this
    that.data.mi7OrderStr = e.detail.mi7OrderStr
  },
  gotoShopSaleDirectly(){
    var that = this
    clearInterval(that.data.interVal)
    wx.navigateTo({
      url: 'shop_sale' + (that.data.mi7OrderStr!=''? '?mi7OrderStr=' + that.data.mi7OrderStr: '')
    })
  }
})
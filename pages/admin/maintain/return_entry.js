// pages/admin/maintain/return_entry.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {

  },
  checkScan(){
    var that = this
    var checkScanUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetScanInfo/' + that.data.interviewId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    var scanTimes = that.data.scanTimes
    if (scanTimes == undefined){
      that.setData({scanTimes: 1})
    }
    else{
      that.setData({scanTimes: scanTimes++})
    }
    if (scanTimes > 900){
      clearInterval(that.data.intervalId)
    }
    wx.request({
      url: checkScanUrl,
      success:(res)=>{
        console.log('check scan', res)
        if (res.statusCode != 200 && res.statusCode != 404){
          clearInterval(that.data.intervalId)
        }
        else if (res.statusCode == 200){
          
          //clearInterval(that.data.interVal)
          var scan = res.data
          var needJump = false
          if (scan.scan ==1){
            var word = '顾客已扫码。'
            if (scan.miniAppUser == null || scan.miniAppUser.cell_number == ''){
              word = '顾客不是会员。'
            }
            else {
              word = '顾客是会员。'
              clearInterval(that.data.intervalId)
              needJump = true
            }
            wx.showToast({
              title: word,
              duration: 2000
            })
            if (needJump){
              //clearInterval(that.data.intervalId)
              var jumpUrl = 'user_task_list?openId=' + res.data.miniAppUser.open_id
              wx.redirectTo({
                url: jumpUrl,
              })
            }
          }
        }
      },
      fail:(res)=>{
        clearInterval(that.data.intervalId)
      }
    })
  },
  getInterviewId(){
    var that = this
    var getScanIdUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetInterviewId?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getScanIdUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var interviewId = res.data
        if (interviewId == 0){
          return
        }
        that.setData({interviewId: interviewId})
        var scene = 'recept_maintain_id_' + interviewId
        var getQRUrl = 'https://wxoa.snowmeet.top/api/OfficialAccountApi/GetOAQRCodeUrl?content=' + scene
        wx.request({
          url: getQRUrl,
          method: 'GET',
          success:(res)=>{
            console.log('get qrcode', res)
            that.setData({qrcodeUrl: res.data})
            var intervalId = setInterval(that.checkScan, 1000)
            that.setData({intervalId: intervalId})
          }
        })
        
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.getInterviewId()
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
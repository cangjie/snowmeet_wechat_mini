// pages/admin/recept/recept_entry.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    retryTimes: 0
  },

  searchUser() {
    var that = this
    var cell = that.data.cell
    var getUserUrl = 'https://' + app.globalData.domainName + '/core/Member/GetMemberByCell/' + cell + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUserUrl,
      method: 'GET',
      success: (res) => {
        console.log('get user', res)
        if (res.statusCode != 200) {
          wx.showToast({
            title: '不是会员请扫码注册。',
            icon: 'error'
          })
          return
        }
        var member = res.data

        var openId = util.getMemberInfo(member, 'wechat_mini_openid')
        if (app.globalData.userInfo.is_admin == 1 || app.globalData.userInfo.is_manager == 1) {
          var interval = that.data.interVal
          clearInterval(interval)
          wx.navigateTo({
            url: 'recept_member_info?openId=' + openId,
          })
        }
        else{
          wx.showToast({
            title: '请等待店长授权',
            icon: 'loading',
            duration: 600000
          })
          var setUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/SetOpenIdByCell/' + that.data.actId + '?cell=' + that.data.cell + '&openId=' + openId + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
          wx.request({
            url: setUrl,
            method: 'GET'
          })
        }
        /*
        
        */
      }
    })
  },

  cellChanged(e) {
    console.log('cell changed', e)
    var that = this
    var cell = e.detail.value
    that.setData({ cell: cell })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function (resolve) {
      that.setData({ role: app.globalData.role })
      if (that.data.role != 'staff') {
        //return
      }
      var getQrUrl = app.globalData.requestPrefix + 'QrCode/CreateNewScanQrCodeByStaff?code=' + encodeURIComponent('recept_interact_id') + '&scene=' + encodeURIComponent('店铺接待') + '&purpose=' + encodeURIComponent('用户身份验证') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
      util.performWebRequest(getQrUrl, null).then(function (resolve){
        console.log('resolve', resolve)
        var getQRUrl = 'https://wxoa.snowmeet.top/api/OfficialAccountApi/GetOAQRCodeUrl?content=' + resolve.code
        wx.request({
          url: getQRUrl,
          method: 'GET',
          success:(res)=>{
            that.setData({ qrcodeUrl: res.data })
            wx.connectSocket({
              url: 'wss://' + app.globalData.domainName + '/ws',
              header:{
                'content-type': 'application/json'
              }
            })
            wx.onSocketOpen((result) => {
              console.log('socket open')
              wx.sendSocketMessage({
                data: 'test',
              })
              wx.onSocketMessage((result) => {
                console.log('socket message', result)
              })
              wx.onSocketClose((result) => {
                console.log('socket closed')
              })
            })
          }
        })
      }).then(function(reject){

      })
     
    })
  },
  /*
  checkScan() {
    var that = this
    var checkScanUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetScanInfo/' + that.data.actId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: checkScanUrl,
      success: (res) => {
        console.log('check scan', res)
        if (res.statusCode != 200 && res.statusCode != 404) {
          if (that.data.retryTimes >= 10) {
            clearInterval(that.data.interVal)
            wx.showToast({
              title: '网络不通',
              icon: 'error'
            })
          }
          else {
            that.data.retryTimes++
          }
        }
        else if (res.statusCode == 200) {
          that.data.retryTimes = 0
          var scan = res.data
          var needJump = false
          if (scan.scan == 1) {
            var word = '顾客已扫码。'
            if (scan.member == null || scan.member.cell == null || scan.member.cell == '') {
              word = '顾客不是会员，必须填写手机号。'
            }
            else {
              word = ''
              clearInterval(that.data.interVal)
              needJump = true
            }
            if (word != '') {
              wx.showToast({
                title: word,
                duration: 2000
              })
            }
            if (needJump) {
              clearInterval(that.data.interVal)
              var jumpUrl = 'recept_member_info?openId=' + res.data.member.wechatMiniOpenId
              wx.redirectTo({
                url: jumpUrl,
              })
            }
          }
        }
        else {
          that.data.retryTimes = 0
        }
      },
      fail: (res) => {
        clearInterval(that.data.interVal)
        wx.showToast({
          title: '手机硬件故障',
          icon: 'error'
        })
      }
    })
  },
  */
  goDirectly() {
    var that = this
    var interval = that.data.interVal
    clearInterval(interval)
    wx.navigateTo({
      url: 'select_shop_business',
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
    console.log('hide')
    wx.closeSocket()
  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {
    console.log('unload')
    wx.closeSocket()
    /*
    var that = this
    if (that.data.interVal != undefined && that.data.interVal > 0) {
      clearInterval(that.data.interVal)
    }
    */
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
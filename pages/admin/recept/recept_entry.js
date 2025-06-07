// pages/admin/recept/recept_entry.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    retryTimes: 0,
    
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
      //that.setData({ role: app.globalData.role })
      that.refreshQrCode()
    })
  },
  refreshQrCode(){
    var that = this
    var getQrUrl = app.globalData.requestPrefix + 'QrCode/CreateNewScanQrCodeByStaff?code=' + encodeURIComponent('recept_interact_id') + '&scene=' + encodeURIComponent('店铺接待') + '&purpose=' + encodeURIComponent('用户身份验证') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    util.performWebRequest(getQrUrl, null).then(function (resolve){
      var scanQrCode = resolve
      console.log('scan code', scanQrCode)
      that.setData({scanQrCode})
      var getQRUrl = 'https://wxoa.snowmeet.top/api/OfficialAccountApi/GetOAQRCodeUrl?content=' + scanQrCode.code
      wx.request({
        url: getQRUrl,
        method: 'GET',
        success:(res)=>{
          that.setData({ qrcodeUrl: res.data })
          var socketTask = that.data.socketTask
          if (socketTask == undefined){
            that.startWebSocketQuery()
          }
          else{

          }
          /*
          if (app.globalData.isWebsocketOpen){
            wx.closeSocket()
          }
          setTimeout(that.startWebSocketQuery, 100)
          */
        }
      })
    }).catch(function (reject){

    })
  },
  startWebSocketQuery(){
    var that = this
    if (app.globalData.isWebsocketOpen){
      wx.closeSocket()
    }
    var socketTask = that.data.socketTask
    if (socketTask == undefined){
      socketTask = wx.connectSocket({
        url: 'wss://' + app.globalData.domainName + '/ws',
        header:{'content-type': 'application/json'}
      })
      that.setData({socketTask})
    }
    else{
      console.log('new socket', socketTask)
      socketTask = wx.connectSocket({
        url: 'wss://' + app.globalData.domainName + '/ws',
        header:{'content-type': 'application/json'}
      })
      that.setData({socketTask})
    }
    //that.setData({socketTask})
    socketTask.onError((res)=>{
      that.socketError()
    })
    socketTask.onMessage((res)=>{
      that.socketMessage(res)
    })
    socketTask.onOpen((res)=>{
      that.socketOpen(res)
    })
    socketTask.onClose((res)=>{
      that.socketClose()
    })
    /*
    wx.onSocketError((result) => {
      that.socketError()
    })
    wx.onSocketOpen((result) => {
      that.socketOpen(result)
    }),
    wx.onSocketMessage((result) => {
      that.socketMessage(result)
    }),
    wx.onSocketClose(()=>{
      that.socketClose()
    })
    */
  },
  socketError(res){

  },
  socketOpen(res){
    var that = this
    app.globalData.isWebsocketOpen = true
    var socketTask = that.data.socketTask
    var socketCmd = {
      command: 'queryqrscan',
      id: that.data.scanQrCode.id
    }
    var cmdStr = JSON.stringify(socketCmd)
    socketTask.send({
      data: cmdStr,
      success:(res)=>{
        console.log('send command', cmdStr)
      }
    })
  },
  socketMessage(res){
    console.log('socket message', res)
    var that = this
    var msg = JSON.parse(res.data)
    var scanQrCode = msg.data
    wx.closeSocket()
    if (msg.code == 1 || scanQrCode.scaned == 0){
      if (msg.code == 1){
        wx.showModal({
          title: '二维码超过获取次数限制',
          content: '点击确认，刷新二维码，让顾客重新扫码；点击取消返回上一页',
          complete: (res) => {
            wx.closeSocket()
            if (res.cancel) {
              wx.navigateBack()
            }
            if (res.confirm) {
              wx.reLaunch({
                url: 'recept_entry',
              })
            }
          }
        })
      }
      else {
        wx.showModal({
          title: '二维码等待超时',
          content: '点击确认，刷新二维码，让顾客重新扫码；点击取消返回上一页',
          complete: (res) => {
            if (res.cancel) {
              wx.navigateBack()
            }
            if (res.confirm) {
              that.refreshQrCode()
            }
          }
        })
      }
    }
    else{
    }
  },
  socketClose(){
    console.log('socket is closed')
    /*
    var that = this
    app.globalData.isWebsocketOpen = false
    setTimeout(() => {
      wx.showToast({
        title: '网络连接中断',
        icon: 'none'
      })
      wx.navigateBack()
    }, 1000);
    */
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
    var that = this
    var socketTask = that.data.socketTask
    if (socketTask){
      socketTask.close({
        success:()=>{
          console.log('socket ready to close')
        }
      })
    }
    /*
    if (app.globalData.isWebsocketOpen){
      wx.closeSocket({
        success:()=>{
          console.log('socket closed')
        }
      })
    }
    */
  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {
    console.log('unload')
    var that = this
    var socketTask = that.data.socketTask
    if (socketTask){
      socketTask.close({
        success:()=>{
          console.log('socket ready to close')
        }
      })
    }
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
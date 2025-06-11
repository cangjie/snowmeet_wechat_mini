// pages/admin/recept/recept_entry.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({
  data: {
    retryTimes: 0,
    overTime: false
  },
  searchUser(){
    var that = this
    var cell = that.data.cell
    var scanQrCode = that.data.scanQrCode
    var authUrl = app.globalData.requestPrefix + 'QrCode/QueryCell/' + scanQrCode.id.toString() + '?cell=' + cell + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(authUrl, null).then(function(resolve){
      console.log('auth cell', resolve)
      var scanQrCode = resolve
      if (scanQrCode.authed == 0){
        wx.showToast({
          title: '需要店长授权',
          icon: 'error'
        })
      }
      that.setData({scanQrcode: resolve})
    }).catch(function(reject){

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
    
  },
  refreshQrCode(){
    var that = this
    var getQrUrl = app.globalData.requestPrefix + 'QrCode/CreateNewScanQrCodeByStaff?code=' + encodeURIComponent('recept_interact_id') + '&scene=' + encodeURIComponent('店铺接待') + '&purpose=' + encodeURIComponent('用户身份验证') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    util.performWebRequest(getQrUrl, null).then(function (resolve){
      var scanQrCode = resolve
      console.log('scan code', scanQrCode)
      that.setData({scanQrCode, cell: ''})
      var getQRUrl = 'https://wxoa.snowmeet.top/api/OfficialAccountApi/GetOAQRCodeUrl?content=' + scanQrCode.code
      wx.request({
        url: getQRUrl,
        method: 'GET',
        success:(res)=>{
          that.setData({ qrcodeUrl: res.data, cell: '' })
          that.startWebSocketQuery()
        }
      })
    }).catch(function (reject){

    })
  },
  startWebSocketQuery(){
    var that = this
    var socketTask = that.data.socketTask
    socketTask = wx.connectSocket({
      url: 'wss://' + app.globalData.domainName + '/ws',
      header:{'content-type': 'application/json'}
    })
    socketTask.isReplied = false
    that.setData({socketTask})
    socketTask.onError((res)=>{
      that.socketError()
    })
    socketTask.onMessage((res)=>{
      that.socketMessage(res)
    })
    socketTask.onOpen((res)=>{
      console.log('socket open')
      that.socketOpen(res)
    })
    socketTask.onClose((res)=>{
      that.socketClosed()
    })
  },
  socketError(res){
    console.log('socket error')
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
    var socketTask = that.data.socketTask
    socketTask.isReplied = true
    that.setData({scanQrCode, socketTask})
    socketTask.close({
      success:()=>{
        console.log('socket will be closed')
      }
    })
  },
  socketClosed(){
    console.log('socket is closed')
    var that = this
    var socketTask = that.data.socketTask
    var scanQrCode = that.data.scanQrCode
    var title = undefined
    var content = undefined
    if (scanQrCode.scaner_member_id){
      wx.navigateTo({
        url: 'recept_member_info?memberId=' + scanQrCode.scaner_member_id.toString()
      })
    }
    if (socketTask && !socketTask.isReplied){
      title = '网络中断'
      content = '点击确认重新连接，点击取消回到上一页。'
    }
    else if (scanQrCode && scanQrCode.scaned == 0 && scanQrCode.stoped == 0 && scanQrCode.authed == 0){
      title = '二维码超时'
      content = '点击确认刷新二维码，点击取消回到上一页。'
    }
    if (title && content){
      wx.showModal({
        title: title,
        content: content,
        complete: (res) => {
          if (res.cancel) {
            wx.navigateBack()
          }
          if (res.confirm) {
            switch(title){
              case '网络中断':
                that.startWebSocketQuery()
                break
              case '二维码超时':
                that.refreshQrCode()
                break
              default:
                break
            }
          }
        }
      })
      return
    }





  },
  closeSocket(){
    var that = this
    var scanQrCode = that.data.scanQrCode
    var closeUrl = app.globalData.requestPrefix + 'QrCode/StopQeryScan/' + scanQrCode.id.toString() + '?sessionKey=' + app.globalData.sessionKey + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    util.performWebRequest(closeUrl, undefined).then(function(resolve){
      console.log('socket will be closed', resolve)
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
    var that = this
    that.setData({cell: ''})
    app.loginPromiseNew.then(function (resolve) {
      that.refreshQrCode()
      
    })
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {
    console.log('hide')
    var that = this
    that.closeSocket()
  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {
    console.log('unload')
    var that = this
    that.closeSocket()
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
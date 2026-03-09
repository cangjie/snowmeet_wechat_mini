const util = require("../../../utils/util")

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
    var getQrUrl = app.globalData.requestPrefix + 'QrCode/CreateNewScanQrCodeByStaff?code=' + encodeURIComponent('nanshanskipass') + '&scene=' + encodeURIComponent('南山验票') + '&purpose=' + encodeURIComponent('用户身份验证') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    util.performWebRequest(getQrUrl, null).then(function (qr){
      console.log('qr', qr)
      that.data.scanQrCode = qr
      var getQRUrl = 'https://wxoa.snowmeet.top/api/OfficialAccountApi/GetOAQRCodeUrl?content=' + qr.code
      wx.request({
        url: getQRUrl,
        method: 'GET',
        success:(res)=>{
          that.setData({ qrcodeUrl: res.data})
          that.startWebSocketQuery()
        }
      })
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
    console.log('scan code', scanQrCode)
    var jumpUrl = ''
    if (scanQrCode && scanQrCode.scaner_member_id){
      jumpUrl = 'nanshan_verify?memberId=' + scanQrCode.scaner_member_id.toString()
      
    }
    wx.redirectTo({
      url: jumpUrl,
    })
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
    if (scanQrCode.no_scan == 1){
      wx.navigateTo({
        url: 'recept_member_info'
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
  getQrCode1(){
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
  */

  /*
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
*/
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
    var that = this
    that.closeSocket()
    //clearInterval(that.data.interVal)
  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {
    var that = this
    var that = this
    that.closeSocket()
    //clearInterval(that.data.interVal)
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
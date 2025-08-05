// pages/admin/fd/fd_order_confirm.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    discountChanged: false,
    filledDiscount: 0
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({ orderId: options.orderId })
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
    app.loginPromiseNew.then(function (resovle) {
      that.setData({ staff: app.globalData.staff })
      that.getData()
    })
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {
    var that = this
    that.closeSocket()
  },
  closeSocket(){
    var that = this
    var socket = that.data.socket
    try{
      socket.close({
        success:()=>{
          console.log('socket will be closed')
        }
      })
    }
    catch{

    }
  },
  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {
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

  },
  getData() {
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Order/GetOrderByStaff/' + that.data.orderId + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, null).then(function (resolve) {
      console.log('order', resolve)
      var order = resolve
      order.total_amountStr = util.showAmount(order.total_amount)
      order.totalChargeStr = util.showAmount(order.totalCharge)
      that.setData({ order })
      if (that.data.socket == undefined){
        that.initWebSocket()
      }
    })
  },
  fillDiscount(e) {
    var that = this
    var value = e.detail.value
    if (!isNaN(value)){
      var filledDiscount = value
      that.setData({ filledDiscount})
      that.setDiscount(e)
    }
  },
  setDiscount(e) {
    var that = this
    var filledDiscount = that.data.filledDiscount
    if (isNaN(filledDiscount)) {
      wx.showToast({
        title: '减免必须是数字',
        icon: 'error'
      })
      return
    }
    var setUrl = app.globalData.requestPrefix + 'Order/SetDiscount/' + that.data.order.id + '?discountAmount=' + that.data.filledDiscount + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(setUrl, null).then(function (resolve) {
      var discounts = resolve
      if (discounts == null) {
        wx.showToast({
          title: '减免设置失败',
          icon: 'error'
        })
        return
      }
      that.getData()
    })
  },
  setMemo(e) {
    var that = this
    var memo = e.detail.value
    var order = that.data.order
    order.memo = memo
    var updateUrl = app.globalData.requestPrefix + 'Order/UpdateOrderByStaff?scene=' + encodeURIComponent('修改订单备注') + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(updateUrl, order).then(function (resolve) {
      var order = resolve
      console.log('order memo', order.memo)
    })
  },
  setPayMethod(e) {
    var that = this
    var payMethod = e.detail.value
    var order = that.data.order
    var getUrl = app.globalData.requestPrefix + 'Order/'
    that.setData({qrCodeUrl: null})
    switch (payMethod) {
      case '支付宝':
        getUrl += 'GetAlipayPaymentQrCode/' + order.id.toString() + '?sessionKey=' + app.globalData.sessionKey
        that.setData({subPayMethod: null})
        break
      case '微信支付':
        getUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent('https://mini.snowmeet.top/mapp/order/order_entry/' + order.id.toString())
        that.setData({ qrCodeUrl: getUrl, payMethod, subPayMethod: null })
        break
      default:
        that.setData({payMethod})
        break
    }
    if (payMethod == '支付宝') {
      util.performWebRequest(getUrl, null).then(function (resolve) {
        console.log('get ali qr', resolve)
        var qrTxt = resolve
        var qrCodeUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent(qrTxt)
        that.setData({qrCodeUrl, payMethod})
      })
    }
  },
  setPayLater(e) {
    var that = this
    console.log('pay later', e)
    var order = that.data.order
    order.payLater = e.detail.value
    that.setData({ order, payMethod: null })
  },
  initWebSocket(){
    var that = this
    var socket = wx.connectSocket({
      url: 'wss://' + app.globalData.domainName + '/ws',
      header:{'content-type': 'application/json'}
    })
    socket.isReplied = false
    socket.onError((res)=>{
      that.socketError()
    })
    socket.onMessage((res)=>{
      that.socketMessage(res)
    })
    socket.onOpen((res)=>{
      console.log('socket open')
      that.socketOpen(res)
    })
    socket.onClose((res)=>{
      that.socketClosed()
    })
    that.setData({socket})
  },
  socketOpen(res){
    var that = this
    app.globalData.isWebsocketOpen = true
    var socket = that.data.socket
    var socketCmd = {
      command: 'orderpaid',
      id: that.data.order.id
    }
    var cmdStr = JSON.stringify(socketCmd)
    socket.send({
      data: cmdStr,
      success:(res)=>{
        console.log('send command', cmdStr)
      }
    })
  },
  socketError(res){
    console.log('socket error')
  },
  socketClosed(){
    console.log('socket is closed')
  },
  socketMessage(res){
    console.log('socket message', res)
  },
  payLater(e){
    var that = this
    wx.showModal({
      title: '确认挂账',
      content: '用户稍后支付，点击确认下单，点击取消提示用户立即支付订单。',
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          var order = that.data.order
          order.payLater = true
          that.setData({order})
          that.placeUnneedPayOrder(e)
        }
      }
    })
  },
  placeUnneedPayOrder(e){
    var that = this
    var order = that.data.order
    var payMethod = that.data.payMethod
    if (payMethod == '微信支付' || payMethod == '支付宝' ){
      wx.showToast({
        title: payMethod + '必须顾客支付',
        icon: 'error'
      })
      return
    }
    var subPayMethod = that.data.subPayMethod
    if (!subPayMethod && order.payLater == false)
    {
      wx.showToast({
        title: '必须选择支付方式',
        icon: 'error'
      })
      return
    }
    var effectUrl = app.globalData.requestPrefix + 'Order/EffectUnpaidOrder/' + order.id.toString() + '?sessionKey=' + app.globalData.sessionKey
    if (order.payLater == true){
      effectUrl = effectUrl + '&payLater=true'
    }
    else{
      effectUrl = effectUrl + '&payMethod=' + subPayMethod + '&payLater=false'
    }
    util.performWebRequest(effectUrl, null).then(function (resolve){
      console.log('paid order', resolve)
    })
  },
  placeUnneedPayOrderConfirm(e){
    var that = this
    wx.showModal({
      title: '确认收款',
      content: '确认顾客已经成功支付，避免逃单。',
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          that.placeUnneedPayOrder(e)
        }
      }
    })
  },
  setSubPayMethod(e){
    var that = this
    that.setData({subPayMethod: e.detail.value})
  }
})
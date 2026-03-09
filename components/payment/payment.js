// components/payment/payment.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
Component({

  /**
   * Component properties
   */
  properties: {
    orderId: Number
  },

  /**
   * Component initial data
   */
  data: {
    payMethod: null,
    othersPayMethods: ['京东收银', 'POS机刷卡', '现金', '手工填写']
  },
  lifetimes: {
    ready() {
      var that = this
      that.setData({ orderId: that.properties.orderId })
      app.loginPromiseNew.then(function (resovle) {
        that.getData()
        var getPayMethodUrl = app.globalData.requestPrefix + 'Order/GetUnCommonPayMethod'
        util.performWebRequest(getPayMethodUrl, null).then(function (resolve) {
          var inputedPayMethodList = resolve
          var othersPayMethods = ['京东收银', 'POS机刷卡', '现金']
          for (var i = 0; i < inputedPayMethodList.length; i++) {
            othersPayMethods.push(inputedPayMethodList[i])
          }
          othersPayMethods.push('手工填写')
          that.setData({ othersPayMethods })
        })
      })
    },
    detached(){
      console.log('payment detached')
      var that = this
      data.getOrderByStaffPromise(that.data.orderId, app.globalData.sessionKey).then(function (order) {
        if (order.orderStatus != '支付成功'){
          data.cancelPayingPromise(order.id, app.globalData.sessionKey)
        }
      })
    }
  },
  methods: {
    setSubPayMethod(e) {
      var that = this
      var disable = e.detail.value == that.data.othersPayMethods.length - 1
      if (disable) {
        if (that.data.inputedPayMethod) {
          disable = false
        }
      }
      that.setData({
        subPayMethodIndex: e.detail.value,
        subPayMethod: that.data.othersPayMethods[e.detail.value],
        disabledConfirmPaidButton: disable
      })
    },
    getData() {
      var that = this
      if (that.data.orderId == 0){
        return
      }
      data.getOrderByStaffPromise(that.data.orderId, app.globalData.sessionKey).then(function (order) {
        console.log('order', order)
        var totalCharge = order.paying_amount
        var payMethod = order.payMethod == null ? that.data.payMethod : order.payMethod
        that.setData({ order, totalCharge, totalChargeStr: util.showAmount(totalCharge), payMethod })
        switch(payMethod){
          case '微信支付':
            var paymentId = null
            for(var i = 0; i < order.payments.length; i++){
              var payment = order.payments[i]
              if (payment.pay_method == '微信支付' && payment.valid == 1 && payment.status == '待支付'){
                paymentId = payment.id
                break
              }
            }
            if (paymentId){
              var qrCodeUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent('https://mini.snowmeet.top/mapp/order/order_entry/' + paymentId.toString())
              that.setData({ qrCodeUrl, subPayMethod: null, payMethod, paying: true, paymentId })
            }
            break
          case '支付宝':
            var currentPayment = null
            for(var i = 0; i < order.payments.length; i++){
              var payment = order.payments[i]
              if (payment.pay_method == '支付宝' && payment.valid == 1 && payment.status == '待支付'){
                currentPayment = payment
                break
              }
            }
            if (paymentId){
              var qrCodeUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' 
                + encodeURIComponent(currentPayment.ali_qr_code)
              that.setData({ qrCodeUrl, subPayMethod: null, payMethod, paying: true, paymentId })
            }
            break
          default:
            break
        }
      })
    },
    setPayMethod(e) {
      var that = this
      console.log('set pay method', e.detail.value)
      var payMethod = e.detail.value
      switch (payMethod) {
        case '微信支付':
        case '支付宝':
          wx.showModal({
            title: '选择支付方式',
            content: '当前支付方式为：' + payMethod + '，需要支付：' + that.data.totalChargeStr + '。点击确定显示支付二维码，点击取消重新选择。',
            complete: (res) => {
              if (res.cancel) {
                that.setData({ payMethod: null })
              }
              if (res.confirm) {
                that.setData({ payMethod })
                that.showQrCode()
              }
            }
          })
          break
        default:
          that.setData({ payMethod })
          break
      }
    },
    cancelPayMethodInput(e) {
      var that = this
      that.setData({ subPayMethodIndex: null, disabledConfirmPaidButton: true })
    },
    showQrCode() {
      var that = this
      var payMethod = that.data.payMethod
      if (payMethod == '微信支付') {
        that.showWepayQrCode()
      }
      if (payMethod == '支付宝') {
        that.showAlipayQrCode()
      }
      //that.triggerEvent('Order')
    },
    showWepayQrCode() {
      var that = this
      that.setData({ paying: true })
      var order = that.data.order
      order.valid = 1
      order.recepting = 0
      data.updateOrderPromise(order, '确认支付方式', app.globalData.sessionKey).then(function (updatedOrder) {
        var payUrl = app.globalData.requestPrefix + 'Order/GetWepayPayment/' + order.id.toString() + '?sessionKey=' + app.globalData.sessionKey
        util.performWebRequest(payUrl, null).then(function (payment) {
          that.setData({paymentId: payment.id})
          var qrCodeUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent('https://mini.snowmeet.top/mapp/order/payment_entry?paymentId=' + payment.id.toString())
          that.setData({ qrCodeUrl, subPayMethod: null })
          var setStatusUrl = app.globalData.requestPrefix + 'Order/LogShowWechatQrCode/' + payment.order_id.toString() + '?sessionKey=' + app.globalData.sessionKey
          util.performWebRequest(setStatusUrl, null)
          that.triggerEvent('OrderStatusChanged', updatedOrder)
          that.initWebSocket()

        })

      })
    },
    showAlipayQrCode() {
      var that = this
      that.setData({ paying: true })
      var order = that.data.order
      order.valid = 1
      order.recepting = 0
      data.updateOrderPromise(order, '确认支付方式', app.globalData.sessionKey).then(function (resolve) {
        var getUrl = app.globalData.requestPrefix + 'Order/GetAlipayPaymentQrCode/' + order.id.toString() + '?sessionKey=' + app.globalData.sessionKey
        util.performWebRequest(getUrl, null).then(function (payment) {
          console.log('get ali qr', payment)
          var qrTxt = payment.ali_qr_code
          var qrCodeUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent(qrTxt)
          that.setData({ qrCodeUrl, subPayMethod: null, paymentId: payment.id })
          that.triggerEvent('OrderStatusChanged', resolve)
          that.initWebSocket()
        })
      })
    },
    reselectPaymethod(e){
      var that = this
      wx.showToast({
        title: '请稍候…',
        icon: 'loading'
      })
      data.cancelPayingPromise(that.data.order.id, app.globalData.sessionKey).then(function (order){
        console.log('order canceled', order)
        that.setData({paying: false, editingPayMethod: true, payMethod: null, subPayMethod: null, inputPayMethod: null, qrCodeUrl: null})
      }).catch(function (exp){})
    },
    placeUnneedPayOrderConfirm(e){
      var that = this
      wx.showModal({
        title: '确认收款',
        content: '确认顾客已经成功支付。',
        complete: (res) => {
          if (res.cancel) {
  
          }
          if (res.confirm) {
            that.placeUnneedPayOrder(e)
          }
        }
      })
    },
    placeUnneedPayOrder(e) {
      var that = this
      var order = that.data.order
      var payMethod = that.getPayMethod()
      console.log('pay method', payMethod)
      
      if (!payMethod) {
        wx.showToast({
          title: '必须选择支付方式',
          icon: 'error'
        })
        return
      }
      wx.showToast({
        title: '请稍候',
        icon:'loading'
      })
      that.setData({disabledConfirmPaidButton: true})
      var effectUrl = app.globalData.requestPrefix + 'Order/EffectUnpaidOrder/' + order.id.toString() + '?sessionKey=' + app.globalData.sessionKey
      effectUrl = effectUrl + '&payMethod=' + payMethod + '&payLater=false'
      util.performWebRequest(effectUrl, null).then(function (resolve) {
        console.log('paid order', resolve)
        that.setData({ paying: false })
        that.triggerEvent('OrderPaidResult', resolve)
      })
    },
    getPayMethod(e){
      var that = this
      var payMethod = that.data.payMethod
      if (payMethod == '其它'){
        var subPayMethod = that.data.subPayMethod
        var subPayMethodIndex = that.data.subPayMethodIndex
        if (subPayMethodIndex == that.data.othersPayMethods.length - 1){
          return that.data.inputedPayMethod
        }
        else{
          return subPayMethod
        }
      }
      else {
        return payMethod
      }
    },
    initWebSocket() {
      var that = this
      var socket = wx.connectSocket({
        url: 'wss://' + app.globalData.domainName + '/ws',
        header: { 'content-type': 'application/json' }
      })
      socket.isReplied = false
      socket.onError((res) => {
        that.socketError()
      })
      socket.onMessage((res) => {
        that.socketMessage(res)
      })
      socket.onOpen((res) => {
        console.log('socket open')
        that.socketOpen(res)
      })
      socket.onClose((res) => {
        that.socketClosed()
      })
      that.setData({ socket })
    },
    socketOpen(res) {
      var that = this
      app.globalData.isWebsocketOpen = true
      var socket = that.data.socket
      var socketCmd = {
        command: 'paymentpaid',
        id: that.data.paymentId
      }
      var cmdStr = JSON.stringify(socketCmd)
      socket.send({
        data: cmdStr,
        success: (res) => {
          console.log('send command', cmdStr)
        }
      })
    },
    socketError(res) {
      console.log('socket error')
    },
    socketClosed() {
      console.log('socket is closed')
    },
    socketMessage(res) {
      console.log('message', res)
      var that = this
      var ret = JSON.parse(res.data)
      if (ret.code == 0) {
        var order = ret.data
        console.log('paid order', order)
        that.triggerEvent('OrderPaidResult', order)
        that.closeSocket()
      }
    },
    closeSocket() {
      var that = this
      var socket = that.data.socket
      try {
        socket.close({
          success: () => {
            console.log('socket will be closed')
          }
        })
      }
      catch {
  
      }
    },
    inputPayMethod(e) {
      var that = this
      that.setData({ inputedPayMethod: e.detail.value, disabledConfirmPaidButton: e.detail.value == '' })
    },
  },
  
})
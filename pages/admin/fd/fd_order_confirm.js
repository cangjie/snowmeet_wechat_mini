// pages/admin/fd/fd_order_confirm.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    discountChanged: false,
    filledDiscount: 0,
    paying: false,
    editingDiscount: false,
    editedDiscount: 0,
    editingMemo: false,
    editedMemo: ''
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
      if (order.dealed == 1) {
        wx.showModal({
          title: '无效订单',
          content: '该订单已经支付过',
          cancelText: '重新开单',
          confirmText: '查看列表',
          complete: (res) => {
            if (res.cancel) {
              wx.redirectTo({
                url: 'fd_category_prod_list',
              })
            }

            if (res.confirm) {
              wx.redirectTo({
                url: 'fd_order_list',
              })
            }
          }
        })
      }
      var totalAmount = 0
      var productDiscountAmount = 0
      var orderDiscountAmount = 0
      var totalCharge = 0
      var editedMemo = order.memo

      for (var i = 0; i < order.fdOrders.length; i++) {
        var fdOrder = order.fdOrders[i]
        totalAmount += fdOrder.order_type == '招待' ? 0 : (fdOrder.unit_price * fdOrder.count)
        for (var j = 0; j < fdOrder.discounts.length; j++) {
          var discount = fdOrder.discounts[j]
          if (discount.valid == 1) {
            productDiscountAmount += discount.amount
          }
        }
      }
      for (var i = 0; i < order.discounts.length; i++) {
        var discount = order.discounts[i]
        if (discount.valid == 1 && discount.biz_id == null) {
          orderDiscountAmount += discount.amount
        }
      }

      totalCharge = totalAmount - orderDiscountAmount - productDiscountAmount
      that.setData({
        order, productDiscountAmountStr: util.showAmount(productDiscountAmount),
        orderDiscountAmount, orderDiscountAmountStr: util.showAmount(orderDiscountAmount), filledDiscount: orderDiscountAmount,
        totalAmount, totalAmountStr: util.showAmount(totalAmount), totalChargeStr: util.showAmount(totalCharge),
        totalCharge
      })
      if (that.data.socket == undefined) {
        that.initWebSocket()
      }
    })
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
  modInput(e) {
    var that = this
    var id = e.currentTarget.id
    var value = e.detail.value
    switch (id) {
      case 'memo':
        //editedMemo = value
        that.setData({ editedMemo: value })
        break
      case 'discount':
        //editedDiscount = value
        that.setData({ editedDiscount: value })
        break
      default:
        break
    }
    //that.setData({editedMemo, editedDiscount})
  },
  confirmMod(e) {
    var that = this
    var id = e.currentTarget.id
    var order = that.data.order
    var message = ''
    switch (id) {
      case 'discount':
        if (isNaN(that.data.editedDiscount)) {
          message = '必须是数字'
        }
        else if (order.total_amount - order.discountAmount + that.data.orderDiscountAmount < that.data.editedDiscount) {
          message = '减免后金额不能为负'
        }
        else {
          //that.setData({filledDiscount: parseFloat(that.data.editedDiscount)})
          that.data.filledDiscount = parseFloat(that.data.editedDiscount)
          that.renderOrder(order)
          that.setDiscount()
          //that.setData({editing: false})
        }
        break
      case 'memo':
        order.memo = that.data.editedMemo
        that.setData({ order })
        //that.setData({editing: false})
        break
      default:
        break
    }
    if (message != '') {
      wx.showToast({
        title: message,
        icon: 'error'
      })
    }
    else {
      that.setData({ editing: false })
      that.setEditStatus(e, false)
    }
  },
  displayQrCode(e) {
    var that = this
    var order = that.data.order
    var getUrl = app.globalData.requestPrefix + 'Order/'
    var payMethod = that.data.payMethod
    that.setData({ qrCodeUrl: null })

    switch (payMethod) {
      case '支付宝':
        getUrl += 'GetAlipayPaymentQrCode/' + order.id.toString() + '?sessionKey=' + app.globalData.sessionKey
        that.setData({ subPayMethod: null })
        break
      case '微信支付':
        getUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent('https://mini.snowmeet.top/mapp/order/order_entry/' + order.id.toString())
        that.setData({ qrCodeUrl: getUrl, subPayMethod: null })
        break
      default:
        that.setData({ payMethod })
        break
    }
    if (payMethod == '支付宝') {
      util.performWebRequest(getUrl, null).then(function (resolve) {
        console.log('get ali qr', resolve)
        var qrTxt = resolve
        var qrCodeUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent(qrTxt)
        that.setData({ qrCodeUrl, payMethod })
      })
    }
  },
  setPayMethod(e) {
    var that = this
    var payMethod = e.detail.value
    if (payMethod != '其他') {
      var order = that.data.order
      order.current_pay_method = payMethod
      var updateUrl = app.globalData.requestPrefix + 'Order/UpdateOrderByStaff?scene=' + encodeURIComponent('修改支付方式') + '&sessionKey=' + app.globalData.sessionKey
      util.performWebRequest(updateUrl, order).then(function (resovle) {
        console.log('pay method changed', resovle)
      })
    }

    that.setData({ payMethod })
    if (that.data.paying) {
      that.displayQrCode()
    }
  },
  setPayLater(e) {
    var that = this
    console.log('pay later', e)
    var order = that.data.order
    order.payLater = e.detail.value
    that.setData({ order, payMethod: null })
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
      command: 'orderpaid',
      id: that.data.order.id
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
    var ret = JSON.parse(res.data)
    if (ret.code == 0) {
      var order = ret.data
      console.log('paid order', order)
      var title = order.paidAmount == 0 ? '下单成功' : '支付成功'
      if (order.dealed == 1) {
        wx.showModal({
          title: title,
          content: '',
          confirmText: '查看详情',
          cancelText: '下一订单',
          complete: (res) => {
            if (res.cancel) {
              wx.redirectTo({
                url: 'fd_category_prod_list',
              })
            }

            if (res.confirm) {
              wx.redirectTo({
                url: 'fd_order_detail?orderId=' + that.data.orderId,
              })
            }
          }
        })
      }
    }
  },
  payLater(e) {
    var that = this
    that.setData({ paying: true })
    that.setDiscount()
    var title = '确认挂账'
    var content = '用户稍后支付，点击确认下单，点击取消提示用户立即支付订单。'
    if (that.data.totalCharge <= 0) {
      content = '订单金额已经全部减免！'
      title = '0元订单'
    }
    wx.showModal({
      title: title,
      content: content,
      complete: (res) => {
        if (res.cancel) {
          that.setData({ paying: false })
        }

        if (res.confirm) {
          var order = that.data.order
          order.payLater = true
          order.valid = 1
          that.setData({ order })
          that.placeUnneedPayOrder(e)
        }
      }
    })
  },
  placeUnneedPayOrder(e) {
    var that = this
    var order = that.data.order
    var payMethod = that.data.payMethod
    var subPayMethod = that.data.subPayMethod
    if (!subPayMethod && order.payLater == false) {
      wx.showToast({
        title: '必须选择支付方式',
        icon: 'error'
      })
      return
    }
    var effectUrl = app.globalData.requestPrefix + 'Order/EffectUnpaidOrder/' + order.id.toString() + '?sessionKey=' + app.globalData.sessionKey
    if (order.payLater == true) {
      effectUrl = effectUrl + '&payLater=true'
    }
    else {
      effectUrl = effectUrl + '&payMethod=' + subPayMethod + '&payLater=false'
    }
    util.performWebRequest(effectUrl, null).then(function (resolve) {
      console.log('paid order', resolve)
      that.setData({ paying: false })
    })
  },
  placeUnneedPayOrderConfirm(e) {
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
  setSubPayMethod(e) {
    var that = this
    var order = that.data.order
    order.current_pay_method = e.detail.value
    var updateUrl = app.globalData.requestPrefix + 'Order/UpdateOrderByStaff?scene=' + encodeURIComponent('修改支付方式') + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(updateUrl, order).then(function (resovle) {
      console.log('pay method changed', resovle)
    })
    that.setData({ subPayMethod: e.detail.value })
  },
  showQrCode(e) {
    var that = this
    that.setDiscount()
    var payMethod = that.data.payMethod
    var subPayMethod = that.data.subPayMethod
    var valid = true
    if (!payMethod) {
      valid = false
    }
    else if (payMethod != '微信支付' && payMethod != '支付宝' && !subPayMethod) {
      valid = false
    }
    else {
      valid = true
    }
    if (!valid) {
      wx.showToast({
        title: '必须选择支付方式',
        icon: 'error'
      })
    }
    else {
      that.setData({ paying: true })
      var order = that.data.order
      order.valid = 1
      order.pay_flow_status = '已生成'
      //order.waiting_for_pay = 1
      var updateUrl = app.globalData.requestPrefix + 'Order/UpdateOrderByStaff?scene=' + encodeURIComponent('生成支付二维码') + '&sessionKey=' + app.globalData.sessionKey
      util.performWebRequest(updateUrl, order).then(function (resolve) {
        that.setData({ paying: true })
        that.displayQrCode()
      })

    }
  },
  setEditStatus(e, status) {
    var id = e.currentTarget.id
    var that = this
    switch (id) {
      case 'memo':
        that.setData({ editingMemo: status, editing: status })
        break
      case 'discount':
        that.setData({ editingDiscount: status, editing: status })
        break
      default:
        break
    }
  },
  edit(e) {
    var that = this
    that.setEditStatus(e, true)
  },
  cancel(e) {
    var that = this
    that.setEditStatus(e, false)
    that.setData({ editing: false })
  },
  renderOrder(order) {
    var that = this
    var order = that.data.order
    var orderDiscount = parseFloat(that.data.editedDiscount)
    var realCharge = order.total_amount - orderDiscount - order.discountAmount + that.data.orderDiscountAmount
    that.setData({ totalCharge: realCharge, totalChargeStr: util.showAmount(realCharge) })
  }
})
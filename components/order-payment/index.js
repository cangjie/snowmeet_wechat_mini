// components/order-payment/index.js
// 按 _5 模板样式呈现的支付组件。仅根据 orderId 工作。
// 支持：微信支付（二维码 + WebSocket）、支付宝（暂时复用微信二维码 mock）、其他（现金/POS/京东 → 弹 modal 确认）。
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')

Component({
  properties: {
    orderId: Number
  },
  data: {
    payMethod: '',                 // 'wechat' | 'alipay' | 'other'
    order: null,
    payingAmountStr: '',
    qrCodeUrl: '',
    paymentId: null,
    paymentStatus: 'pending',      // 'pending' | 'paid'
    othersPayMethods: ['京东收银', 'POS机刷卡', '现金'],
    subPayMethodIndex: null,
    subPayMethod: '',
    inputedPayMethod: '',
    loadingQr: false
  },
  lifetimes: {
    attached() {
      var that = this
      app.loginPromiseNew.then(function () {
        that.loadOrder()
        data.GetUnCommonPayMethodPromise && data.GetUnCommonPayMethodPromise().then(function (methods) {
          if (methods && methods.length) {
            that.setData({ othersPayMethods: methods })
          }
        }).catch(function () {})
      })
    },
    detached() {
      var that = this
      that.closeSocket()
      if (that.data.order && that.data.paymentId && that.data.paymentStatus !== 'paid') {
        data.cancelPayingPromise(that.data.order.id, app.globalData.sessionKey).catch(function () {})
      }
    }
  },
  methods: {
    loadOrder() {
      var that = this
      var orderId = that.properties.orderId
      if (!orderId) return
      data.getOrderByStaffPromise(orderId, app.globalData.sessionKey).then(function (order) {
        that.setData({
          order: order,
          payingAmountStr: util.showAmount(order.paying_amount)
        })
      })
    },

    onMethodTap(e) {
      var that = this
      var method = e.currentTarget.dataset.method
      if (method === that.data.payMethod) return
      // 切换方式时清掉旧二维码
      that.setData({
        payMethod: method,
        qrCodeUrl: '',
        paymentId: null,
        subPayMethodIndex: null,
        subPayMethod: '',
        inputedPayMethod: ''
      })
      that.closeSocket()
      if (method === 'wechat') {
        that.showWepayQrCode()
      } else if (method === 'alipay') {
        // 2026-05-30 落地：调 Order/GetAlipayMiniPayment 建一笔 alipay OrderPayment 拿 paymentId，
        // 编进支付宝小程序唤起 URL 做成二维码。顾客用支付宝扫该 QR → 自动跳进 alipay_snowmeet/pages/payment_entry?paymentId=...
        that.showAlipayMiniQrCode()
      }
    },

    // 支付宝小程序方案：QR 内容是 alipays://platformapi/startapp 唤起 URL，
    // appId=2021006157624571 是 alipay_snowmeet 工程的小程序 appId（独立于商户 appId 2021004143665722）
    showAlipayMiniQrCode() {
      var that = this
      var order = that.data.order
      if (!order) return
      that.setData({ loadingQr: true })
      var payUrl = app.globalData.requestPrefix + 'Order/GetAlipayMiniPayment/' + order.id.toString()
        + '?sessionKey=' + app.globalData.sessionKey
      util.performWebRequest(payUrl, null).then(function (payment) {
        // 支付宝小程序唤起 URL（标准 scheme）：appId + page + query
        // 注意 page 和 query 都要 encodeURIComponent 一次（再被 GetQRCode 整体 encode 一次）
        var schemePage = encodeURIComponent('pages/payment_entry/index?paymentId=' + payment.id.toString())
        var schemeUrl = 'alipays://platformapi/startapp?appId=2021006157624571&page=' + schemePage
        var qrCodeUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent(schemeUrl)
        console.log('[order-payment] alipay scheme URL:', schemeUrl)
        that.setData({ paymentId: payment.id, qrCodeUrl: qrCodeUrl, loadingQr: false })
        // 复用现有 LogShowWechatQrCode 记录展示事件（场景文案在后端，跨支付通道复用）
        var logUrl = app.globalData.requestPrefix + 'Order/LogShowWechatQrCode/' + payment.order_id.toString() + '?sessionKey=' + app.globalData.sessionKey
        util.performWebRequest(logUrl, null)
        // 同样开 WebSocket 监听 paymentpaid 事件，让 wechat 侧收到支付成功通知
        that.initWebSocket()
      }).catch(function (err) {
        console.warn('[order-payment] GetAlipayMiniPayment 失败', err)
        that.setData({ loadingQr: false })
      })
    },

    showWepayQrCode() {
      var that = this
      var order = that.data.order
      if (!order) return
      that.setData({ loadingQr: true })
      var payUrl = app.globalData.requestPrefix + 'Order/GetWepayPayment/' + order.id.toString() + '?sessionKey=' + app.globalData.sessionKey
      util.performWebRequest(payUrl, null).then(function (payment) {
        var qrText = 'https://mini.snowmeet.top/mapp/order/payment_entry?paymentId=' + payment.id.toString()
        var qrCodeUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent(qrText)
        that.setData({ paymentId: payment.id, qrCodeUrl: qrCodeUrl, loadingQr: false })
        var logUrl = app.globalData.requestPrefix + 'Order/LogShowWechatQrCode/' + payment.order_id.toString() + '?sessionKey=' + app.globalData.sessionKey
        util.performWebRequest(logUrl, null)
        that.initWebSocket()
      }).catch(function () {
        that.setData({ loadingQr: false })
      })
    },

    onSubMethodChange(e) {
      var that = this
      var idx = parseInt(e.detail.value, 10)
      var list = that.data.othersPayMethods
      that.setData({
        subPayMethodIndex: idx,
        subPayMethod: list[idx]
      })
    },
    onInputMethod(e) {
      this.setData({ inputedPayMethod: e.detail.value })
    },

    onConfirmOtherPaid() {
      var that = this
      var payMethod = that.data.subPayMethod
      if (that.data.subPayMethodIndex === that.data.othersPayMethods.length - 1) {
        payMethod = that.data.inputedPayMethod
      }
      if (!payMethod) {
        wx.showToast({ title: '请选择支付方式', icon: 'none' })
        return
      }
      wx.showModal({
        title: '确认收款',
        content: '请确认已收到款项（' + payMethod + '）。确认后将标记订单为已支付。',
        success: function (res) {
          if (res.confirm) {
            that.effectUnpaidOrder(payMethod)
          }
        }
      })
    },

    effectUnpaidOrder(payMethod) {
      var that = this
      var order = that.data.order
      var url = app.globalData.requestPrefix + 'Order/EffectUnpaidOrder/' + order.id.toString()
        + '?sessionKey=' + app.globalData.sessionKey
        + '&payMethod=' + encodeURIComponent(payMethod)
        + '&payLater=false'
      wx.showLoading({ title: '处理中…' })
      util.performWebRequest(url, null).then(function (paidOrder) {
        wx.hideLoading()
        that.setData({ paymentStatus: 'paid' })
        that.triggerEvent('paid', { orderId: order.id, payMethod: payMethod, order: paidOrder })
      }).catch(function () {
        wx.hideLoading()
        wx.showToast({ title: '处理失败', icon: 'none' })
      })
    },

    onShareQrCode() {
      var that = this
      var qrCodeUrl = that.data.qrCodeUrl
      if (!qrCodeUrl) {
        wx.showToast({ title: '二维码尚未生成', icon: 'none' })
        return
      }
      wx.showLoading({ title: '准备分享…' })
      wx.downloadFile({
        url: qrCodeUrl,
        success: function (res) {
          wx.hideLoading()
          if (res.statusCode !== 200 || !res.tempFilePath) {
            wx.showToast({ title: '下载二维码失败', icon: 'none' })
            return
          }
          if (typeof wx.showShareImageMenu === 'function') {
            wx.showShareImageMenu({
              path: res.tempFilePath,
              fail: function () {
                wx.previewImage({ urls: [res.tempFilePath] })
              }
            })
          } else {
            // 旧基础库回退：长按图片可保存/转发
            wx.previewImage({ urls: [res.tempFilePath] })
          }
        },
        fail: function () {
          wx.hideLoading()
          wx.showToast({ title: '下载二维码失败', icon: 'none' })
        }
      })
    },

    // WebSocket：等待扫码支付完成
    initWebSocket() {
      var that = this
      var socket = wx.connectSocket({
        url: 'wss://' + app.globalData.domainName + '/ws',
        header: { 'content-type': 'application/json' }
      })
      socket.onOpen(function () {
        var cmd = JSON.stringify({ command: 'paymentpaid', id: that.data.paymentId })
        socket.send({ data: cmd })
      })
      socket.onMessage(function (res) {
        try {
          var ret = JSON.parse(res.data)
          if (ret.code === 0) {
            var order = ret.data
            that.setData({ paymentStatus: 'paid' })
            that.triggerEvent('paid', {
              orderId: that.data.order.id,
              payMethod: that.data.payMethod === 'alipay' ? '支付宝' : '微信支付',
              order: order
            })
            that.closeSocket()
          }
        } catch (e) {}
      })
      socket.onError(function () {})
      socket.onClose(function () {})
      that.setData({ socket: socket })
    },
    closeSocket() {
      var socket = this.data.socket
      if (!socket) return
      try { socket.close({}) } catch (e) {}
      this.setData({ socket: null })
    }
  }
})

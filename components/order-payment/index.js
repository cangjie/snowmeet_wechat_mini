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
    payStage: 'waiting',           // 'waiting' | 'scanned' | 'paying' | 'paid' | 'cancelled'
    payStageLabel: '等待扫码…',
    othersPayMethods: ['京东收银', 'POS机刷卡', '现金'],
    subPayMethodIndex: null,
    subPayMethod: '',
    inputedPayMethod: '',
    loadingQr: false,
    isZeroAmount: false,
    isCare: false,            // 养护订单
    careWriteoff: false,      // 养护核销单（储值/卡券，无需外部支付）→ 微信核验会员本人 + 核销
    _verifyShow: false,       // 微信身份核验二维码弹层
    _verifyQrUrl: '',
    _verifyTip: ''
  },
  lifetimes: {
    attached() {
      var that = this
      that._statusTimer = null    // 状态轮询定时器
      that._paidHandled = false   // 支付成功是否已收尾（WS / 轮询去重）
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
      that.stopStatusPolling()
      that._stopVerifyPolling()
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
        var isCare = order.type === '养护'
        // 养护核销单：用了储值/卡券的未生效单（dealed!=1）无需外部支付，走「微信核验会员本人 + 核销」。
        // 质保/招待 0 元单在 PlaceCareOrder 里 dealed==1 已立即生效，不进此分支，走 isZeroAmount 免费确认。
        var careWriteoff = isCare && order.dealed != 1 && (order.paying_amount == 0 || order.pay_with_deposit)
        var patch = {
          order: order,
          isCare: isCare,
          careWriteoff: careWriteoff,
          payingAmountStr: util.showAmount(order.paying_amount)
        }
        if (order.paying_amount == 0 && !careWriteoff) { patch.isZeroAmount = true }
        that.setData(patch)
      })
    },

    onConfirmFreeOrder() {
      this.effectUnpaidOrder('免费')
    },

    noop() {},

    // ── 养护核销：微信核验会员本人 → WriteoffCareOrder（储值实扣 / 券卡核销 → 生效）──
    onCareWriteoffVerify() {
      var that = this
      var order = that.data.order
      if (!order) return
      if (order.wechat_unverified) { that._doWriteoff(); return }
      that._openWechatVerify('writeoff')
    },
    _doWriteoff() {
      var that = this
      var order = that.data.order
      wx.showLoading({ title: '核销中…', mask: true })
      data.writeoffCareOrderPromise(order.id, app.globalData.sessionKey).then(function (updated) {
        wx.hideLoading()
        if (!updated) { wx.showToast({ title: '核销失败', icon: 'none' }); return }
        that._paidHandled = true
        that.stopStatusPolling()
        that.setData({ paymentStatus: 'paid', payStage: 'paid', payStageLabel: '已核销' })
        that.triggerEvent('paid', {
          orderId: order.id,
          payMethod: order.pay_with_deposit ? '储值支付' : '核销',
          order: updated
        })
      }).catch(function (err) {
        wx.hideLoading()
        var msg = (err && err._toastMsg) || '核销失败'
        wx.showToast({ title: msg, icon: 'none' })
      })
    },

    // ── 微信身份核验二维码 + 轮询（照搬 rent_order_detail 机制，共用 order.wechat_unverified）──
    // purpose: 'writeoff'（0元/储值核销）| 'alipay'（支付宝支付前核验）
    _openWechatVerify(purpose) {
      var that = this
      var order = that.data.order
      if (!order) return
      that._verifyPurpose = purpose || 'writeoff'
      // 专用扫码落地路径 order_verify（公众平台已登记 → pages/order/identity_verify）
      var verifyUrl = 'https://mini.snowmeet.top/mapp/order_verify?verifyOrderId=' + order.id
      var qrCodeUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent(verifyUrl)
      that.setData({ _verifyShow: true, _verifyQrUrl: qrCodeUrl, _verifyTip: '请订单会员本人的微信扫码核验身份' })
      that._startVerifyPolling()
    },
    _startVerifyPolling() {
      var that = this
      that._stopVerifyPolling()
      that._verifyTimer = setInterval(function () {
        var order = that.data.order
        if (!order) return
        data.getWechatVerifyStatusPromise(order.id, app.globalData.sessionKey).then(function (res) {
          if (res && res.verified) {
            that._stopVerifyPolling()
            order.wechat_unverified = true
            that.setData({ _verifyShow: false, order: order })
            wx.showToast({ title: '核验成功', icon: 'success' })
            if (that._verifyPurpose === 'alipay') {
              that.showAlipayMiniQrCode()
            } else {
              that._doWriteoff()
            }
          }
        }).catch(function () { /* 轮询失败忽略，下个周期再试 */ })
      }, 2000)
    },
    _stopVerifyPolling() {
      if (this._verifyTimer) { clearInterval(this._verifyTimer); this._verifyTimer = null }
    },
    onWechatVerifyCancel() {
      this._stopVerifyPolling()
      this.setData({ _verifyShow: false })
    },

    onMethodTap(e) {
      var that = this
      var method = e.currentTarget.dataset.method
      if (method === that.data.payMethod) return
      // 切换方式时清掉旧二维码 + 复位状态
      that.setData({
        payMethod: method,
        qrCodeUrl: '',
        paymentId: null,
        subPayMethodIndex: null,
        subPayMethod: '',
        inputedPayMethod: '',
        payStage: 'waiting',
        payStageLabel: '等待扫码…'
      })
      that._paidHandled = false
      that.stopStatusPolling()
      that.closeSocket()
      if (method === 'wechat') {
        that.showWepayQrCode()
      } else if (method === 'alipay') {
        // 养护支付宝支付：先微信核验会员本人（wechat_unverified=1），核验通过后再出支付宝支付码
        if (that.data.isCare && !(that.data.order && that.data.order.wechat_unverified)) {
          that._openWechatVerify('alipay')
          return
        }
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
        that.startStatusPolling()
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
        var qrText = 'https://mini.snowmeet.top/mapp/order_payment?paymentId=' + payment.id.toString()
        var qrCodeUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent(qrText)
        that.setData({ paymentId: payment.id, qrCodeUrl: qrCodeUrl, loadingQr: false })
        var logUrl = app.globalData.requestPrefix + 'Order/LogShowWechatQrCode/' + payment.order_id.toString() + '?sessionKey=' + app.globalData.sessionKey
        util.performWebRequest(logUrl, null)
        that.initWebSocket()
        that.startStatusPolling()
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
        that._paidHandled = true
        that.stopStatusPolling()
        that.setData({ paymentStatus: 'paid', payStage: 'paid', payStageLabel: '已收款' })
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
              fail: function (err) {
                console.warn('[order-payment] showShareImageMenu fail', err)
                var msg = (err && err.errMsg) || ''
                // 用户主动取消分享，不当作错误
                if (msg.indexOf('cancel') >= 0) return
                // 开发者工具模拟器不支持该能力，退回图片预览（真机可长按转发）
                wx.showToast({ title: '当前环境不支持直接分享，已打开预览，可长按图片转发', icon: 'none', duration: 2500 })
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
            that.markPaid(ret.data)
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
    },

    // ---------- 支付状态实时轮询：等待扫码 → 顾客已扫码 → 顾客支付中 → 已支付 ----------
    startStatusPolling() {
      var that = this
      that.stopStatusPolling()
      if (!that.data.paymentId) return
      // 立刻拉一次，之后每 2s 轮询，直到支付成功 / 组件销毁 / 切换支付方式
      that.pollLiveStatus()
      that._statusTimer = setInterval(function () {
        that.pollLiveStatus()
      }, 2000)
    },
    stopStatusPolling() {
      if (this._statusTimer) {
        clearInterval(this._statusTimer)
        this._statusTimer = null
      }
    },
    pollLiveStatus() {
      var that = this
      var paymentId = that.data.paymentId
      if (!paymentId || that._paidHandled) {
        that.stopStatusPolling()
        return
      }
      data.getPaymentLiveStatusPromise(paymentId).then(function (st) {
        // 轮询期间可能已切换支付方式 / 已收尾，丢弃过期结果
        if (!st || that._paidHandled || paymentId !== that.data.paymentId) return
        var labelMap = {
          waiting: '等待扫码…',
          scanned: '顾客已扫码',
          paying: '顾客支付中…',
          paid: '已收款',
          cancelled: '支付已取消'
        }
        var stage = st.stage || 'waiting'
        that.setData({
          payStage: stage,
          payStageLabel: labelMap[stage] || '等待扫码…'
        })
        if (stage === 'paid') {
          // 兜底：万一 WebSocket 漏收，轮询也能收尾。拉一次最新订单再 markPaid。
          data.getOrderByStaffPromise(that.data.order.id, app.globalData.sessionKey).then(function (order) {
            that.markPaid(order)
          }).catch(function () {
            that.markPaid(that.data.order)
          })
        }
      })
    },
    // 支付成功统一收尾（WebSocket 与轮询共用，_paidHandled 去重，避免重复 triggerEvent）
    markPaid(order) {
      if (this._paidHandled) return
      this._paidHandled = true
      this.stopStatusPolling()
      this.closeSocket()
      this.setData({ paymentStatus: 'paid', payStage: 'paid', payStageLabel: '已收款' })
      this.triggerEvent('paid', {
        orderId: this.data.order.id,
        payMethod: this.data.payMethod === 'alipay' ? '支付宝' : '微信支付',
        order: order
      })
    }
  }
})

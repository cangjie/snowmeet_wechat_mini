// pages/order/recept_checkin.js
// 店铺接待扫码落地页（顾客侧）：顾客用微信扫店员手机上的接待码，直接进入本页（不经公众号）。
//   报到 → 没有手机号的先一键授权验证 → 「请耐心等待店员开单」
//   → 店员开单后在结算页选微信支付：轮询到待支付的微信支付单，redirectTo 付款页并自动调起支付；
//     选支付宝：提示顾客用支付宝扫店员手机上的码（支付宝付款流程不变）。
// 扫码打开依赖小程序后台「扫普通链接二维码打开小程序」规则：
//   https://mini.snowmeet.top/mapp/recept_checkin → pages/order/recept_checkin
// 后端：QrCode/ScanReceptCheckin、VerifyReceptCheckinPhone、GetReceptCheckinByCustomer
const app = getApp()
const data = require('../../utils/data.js')

const POLL_INTERVAL = 2000

Page({
  data: {
    code: '',
    state: 'loading',   // loading | need_phone | waiting | alipay | expired | error
    message: '',
    maskedCell: '',
    busy: false
  },

  onLoad(options) {
    var code = options.code || ''
    // 普通链接二维码直达：q 里是 https://mini.snowmeet.top/mapp/recept_checkin?code=...，与 payment_entry 同口径
    if (!code && options.q != undefined) {
      var url = decodeURIComponent(options.q)
      var urlArr = url.split('?')
      var queryStr = urlArr[urlArr.length - 1]
      code = queryStr.replace('code=', '')
    }
    this._pollTimer = null
    this._leaving = false
    this.setData({ code: code })
  },

  // 每次回到前台都重新报到：对本人是幂等的，顺便拿到最新阶段
  onShow() {
    if (this._leaving) return
    this.checkin()
  },

  onHide() {
    this._stopPolling()
  },

  onUnload() {
    this._stopPolling()
  },

  checkin() {
    var that = this
    if (!that.data.code) {
      that.setData({ state: 'error', message: '二维码参数缺失，请重新扫描店员手机上的二维码' })
      return
    }
    that._stopPolling()
    app.loginPromiseNew.then(function () {
      return data.scanReceptCheckinPromise(that.data.code, app.globalData.sessionKey)
    }).then(function (view) {
      that.applyView(view)
    }).catch(function (msg) {
      var errMsg = (typeof msg === 'string' && msg) ? msg : '报到失败，请重新扫码'
      that.setData({ state: 'error', message: errMsg })
    })
  },

  applyView(view) {
    if (!view || this._leaving) return
    var patch = { maskedCell: view.maskedCell || '', message: '' }
    if (view.stage === 'wepay') {
      this.gotoPay(view.paymentId)
      return
    }
    if (view.stage === 'waiting' || view.stage === 'alipay') {
      // 选了支付宝也继续查：店员可能又改回微信支付
      this._startPolling()
    } else {
      this._stopPolling()
    }
    if (view.stage === 'need_phone' || view.stage === 'waiting' || view.stage === 'alipay' || view.stage === 'expired') {
      patch.state = view.stage
    } else {
      patch.state = 'error'
      patch.message = '状态异常，请联系店员'
    }
    this.setData(patch)
  },

  gotoPay(paymentId) {
    var that = this
    if (that._leaving || !paymentId) return
    that._leaving = true
    that._stopPolling()
    wx.redirectTo({
      url: '/pages/order/payment_entry?paymentId=' + paymentId + '&autoPay=1',
      fail: function () {
        that._leaving = false
        that._startPolling()
      }
    })
  },

  _startPolling() {
    if (this._pollTimer) return
    this._pollTimer = setInterval(() => this.poll(), POLL_INTERVAL)
  },

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  },

  poll() {
    var that = this
    data.getReceptCheckinByCustomerPromise(that.data.code, app.globalData.sessionKey).then(function (res) {
      // 网络抖动：等下一轮再查
      if (!res) return
      if (res.code !== 0) {
        that._stopPolling()
        that.setData({ state: 'error', message: res.message || '查询失败，请重新扫码' })
        return
      }
      that.applyView(res.data)
    })
  },

  onGetPhoneNumber(e) {
    var that = this
    if (that.data.busy) return
    if (!e || !e.detail || e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({ title: '验证手机号后，店员才能为您开单', icon: 'none' })
      return
    }
    that.setData({ busy: true })
    wx.showLoading({ title: '验证中...', mask: true })
    data.verifyReceptCheckinPhonePromise(that.data.code, e.detail.encryptedData, e.detail.iv, app.globalData.sessionKey)
      .then(function (view) {
        wx.hideLoading()
        that.setData({ busy: false })
        that.applyView(view)
      }).catch(function () {
        // performWebRequest 已 toast 错误信息
        wx.hideLoading()
        that.setData({ busy: false })
      })
  },

  onRetryTap() {
    this.setData({ state: 'loading', message: '' })
    this.checkin()
  }
})

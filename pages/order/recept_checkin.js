// pages/order/recept_checkin.js
// 店铺接待扫码落地页（顾客侧）：顾客用微信扫店员手机上的接待码，直接进入本页（不经公众号）。
//   报到 → 没有手机号的先一键授权验证 → 「请耐心等待店员开单」
//   头像昵称（2026-11-15 用户定的顾客侧流程）：扫码后没授权手机号的先提示授权手机号；无论授权还是跳过，
//   等约 5 秒，再提示授权昵称、最后授权头像（同一个弹层：昵称在上、头像在下，都可以跳过）。
//   手机号早就绑过的会员没有第一步，扫码报到成功后同样等 5 秒再问。付款阶段不问；离开页面就不再问。
//   → 店员开单后在结算页选微信支付：轮询到待支付的微信支付单，redirectTo 付款页并自动调起支付；
//     选支付宝：提示顾客用支付宝扫店员手机上的码（支付宝付款流程不变）。
// 扫码打开依赖小程序后台「扫普通链接二维码打开小程序」规则：
//   https://mini.snowmeet.top/mapp/recept_checkin → pages/order/recept_checkin
// 后端：QrCode/ScanReceptCheckin、VerifyReceptCheckinPhone、GetReceptCheckinByCustomer
const app = getApp()
const data = require('../../utils/data.js')
const profileAuth = require('../../utils/profile_auth.js')

const POLL_INTERVAL = 2000
// 手机号这一步（授权或跳过）做完之后，等多久再问昵称头像
const PROFILE_PROMPT_DELAY_MS = 5000

Page({
  // 实例上的间隔，测试里改小
  profilePromptDelay: PROFILE_PROMPT_DELAY_MS,

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
    this._stopProfileTimer()
  },

  onUnload() {
    this._stopPolling()
    this._stopProfileTimer()
  },

  // 等 profilePromptDelay 之后请顾客完善昵称头像（可跳过）。只留一个计时，离开页面就不再问。
  // 页面状态和轮询不受弹层影响；弹层组件记着已保存 / 已跳过 / 已有完整资料，同一次运行里不会反复弹。
  _scheduleProfilePrompt() {
    var that = this
    if (that._profileTimer || that._leaving) return
    that._profileTimer = setTimeout(function () {
      that._profileTimer = null
      if (that._leaving) return
      profileAuth.ensureOn(that)
    }, that.profilePromptDelay)
    if (that._profileTimer && typeof that._profileTimer.unref === 'function') that._profileTimer.unref()
  },

  _stopProfileTimer() {
    if (this._profileTimer) {
      clearTimeout(this._profileTimer)
      this._profileTimer = null
    }
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
      // 手机号早就绑过的会员没有「授权手机号」这一步：报到成功、进入「等待店员开单」后，等 5 秒再问昵称头像。
      // 没绑手机号的（need_phone）先授权手机号，那一步做完再计时；付款阶段（wepay / alipay）不问。
      if (view && view.stage === 'waiting') that._scheduleProfilePrompt()
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
    that._stopProfileTimer()
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
      // 跳过 / 拒绝授权也一样：等 5 秒再问昵称头像（页面还停在授权手机号，之后仍可以授权）
      that._scheduleProfilePrompt()
      return
    }
    that.setData({ busy: true })
    wx.showLoading({ title: '验证中...', mask: true })
    data.verifyReceptCheckinPhonePromise(that.data.code, e.detail.encryptedData, e.detail.iv, app.globalData.sessionKey)
      .then(function (view) {
        wx.hideLoading()
        that.setData({ busy: false })
        // 手机号验证成功：先继续等店员开单，等 5 秒再问昵称头像（不是授权完立刻弹）
        that.applyView(view)
        that._scheduleProfilePrompt()
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

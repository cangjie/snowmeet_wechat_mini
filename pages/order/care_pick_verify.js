// pages/order/care_pick_verify.js
// 养护扫码取板落地页（顾客侧）：顾客用微信扫店员手机上的取板码，直接进入本页（不经公众号）。
//   验证规则同原公众号取板：扫码人就是下单会员即通过，店员页随即自动完成发板；不是本人提示用下单人的微信扫。
//   新微信号还没有会员身份时，先授权手机号绑定会员再验证一次（与身份核验页 identity_verify 同一套绑定接口）。
// 扫码打开依赖小程序后台「扫普通链接二维码打开小程序」规则：
//   https://mini.snowmeet.top/mapp/care_pick → pages/order/care_pick_verify
// 后端：QrCode/VerifyCarePick；绑定手机号 core/MiniAppUser/UpdateWechatMemberCell
const app = getApp()
const data = require('../../utils/data.js')

Page({
  data: {
    code: '',
    state: 'loading',   // loading | matched | mismatch | bind_cell | error
    message: '',
    maskedCell: '',
    busy: false,
    login_error: false
  },

  onLoad(options) {
    var code = options.code || ''
    // 普通链接二维码直达：q 里是 https://mini.snowmeet.top/mapp/care_pick?code=...，与 payment_entry 同口径
    if (!code && options.q != undefined) {
      var url = decodeURIComponent(options.q)
      var urlArr = url.split('?')
      var queryStr = urlArr[urlArr.length - 1]
      code = queryStr.replace('code=', '')
    }
    this.setData({ code: code })
    this.verifyNow()
  },

  showLoginError() {
    this.setData({
      state: 'error',
      login_error: true,
      message: '微信登录未完成，请检查网络后点击“重新登录”；如仍失败，请退出小程序后重新扫描店员二维码。'
    })
  },

  async verifyNow(retryLogin) {
    var that = this
    if (that.data.busy) return
    if (!that.data.code) {
      that.setData({ state: 'error', login_error: false, message: '二维码参数缺失，请重新扫描店员手机上的二维码' })
      return
    }
    that.setData({ state: 'loading', message: '', login_error: false, busy: true })
    try {
      var loginResult
      try {
        loginResult = await (retryLogin === true ? app.retryLogin() : app.loginPromiseNew)
      } catch (err) {
        that.showLoginError()
        return
      }
      if (!loginResult || loginResult.authenticated !== true
        || typeof app.globalData.sessionKey !== 'string' || !app.globalData.sessionKey.trim()) {
        that.showLoginError()
        return
      }
      var view = await data.verifyCarePickPromise(that.data.code, app.globalData.sessionKey)
      if (view && view.stage === 'matched') {
        that.setData({ state: 'matched' })
      } else if (view && view.stage === 'need_member') {
        that.setData({ state: 'bind_cell' })
      } else {
        that.setData({ state: 'mismatch', maskedCell: (view && view.orderMemberMaskedCell) || '' })
      }
    } catch (msg) {
      var errMsg = (typeof msg === 'string' && msg) ? msg : '验证失败，请重新扫码'
      that.setData({ state: 'error', message: errMsg })
    } finally {
      that.setData({ busy: false })
    }
  },

  onBindCell(e) {
    var that = this
    if (that.data.busy) return
    if (typeof app.globalData.sessionKey !== 'string' || !app.globalData.sessionKey.trim()) {
      that.showLoginError()
      return
    }
    if (!e || !e.detail || e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({ title: '未授权手机号', icon: 'none' })
      return
    }
    that.setData({ busy: true })
    wx.showLoading({ title: '处理中...', mask: true })
    data.bindWechatCellPromise(e.detail.encryptedData, e.detail.iv, app.globalData.sessionKey).then(function () {
      wx.hideLoading()
      that.setData({ busy: false })
      that.verifyNow()
    }).catch(function () {
      wx.hideLoading()
      that.setData({ busy: false })
      wx.showToast({ title: '手机号绑定失败，请重试', icon: 'none' })
    })
  },

  onRetryTap() {
    return this.verifyNow(this.data.login_error)
  }
})

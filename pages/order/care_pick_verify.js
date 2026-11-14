// pages/order/care_pick_verify.js
// 养护扫码取板落地页（顾客侧）：顾客用微信扫店员手机上的取板码，直接进入本页（不经公众号）。
//   验证规则同原公众号取板：扫码人就是下单会员即通过，店员页随即自动完成发板；不是本人提示用下单人的微信扫。
//   新微信号还没有会员身份时，先授权手机号绑定会员再验证一次（与身份核验页 identity_verify 同一套绑定接口）。
// 扫码打开依赖小程序后台「扫普通链接二维码打开小程序」规则：
//   https://mini.snowmeet.top/mapp/care_pick → pages/order/care_pick_verify
// 后端：QrCode/VerifyCarePick；绑定手机号 core/MiniAppUser/UpdateWechatMemberCell
const app = getApp()
const data = require('../../utils/data.js')
const profileAuth = require('../../utils/profile_auth.js')

Page({
  // 自动登录失败后，等 autoRetrySeconds 秒（每 autoRetryTickMs 毫秒倒计时一跳）再自动重试 1 次：
  // 给手机网络恢复的时间，界面上显示倒计时提示。测试里把秒数改成 0 或把一跳缩短。
  autoRetrySeconds: 10,
  autoRetryTickMs: 1000,

  data: {
    code: '',
    state: 'loading',   // loading | matched | mismatch | bind_cell | error
    message: '',
    maskedCell: '',
    busy: false,
    login_error: false,
    login_reason: '',  // 登录失败时的原因（阶段: 微信返回的文字），小字显示，方便店员拍照
    wait_hint: ''      // 自动重试前的倒计时 / 重试中的提示，显示在「正在验证」下面；空时显示「请稍候」
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

  showLoginError(reason) {
    this.setData({
      state: 'error',
      login_error: true,
      login_reason: reason || '',
      message: '微信登录未完成，请检查网络后点击“重新登录”；如仍失败，请退出小程序后重新扫描店员二维码。'
    })
  },

  // 登录一次：成功返回 { ok: true }；结果不是已认证、或抛异常，返回 { ok: false, reason }。
  // fresh 为 true 时重新发起登录，否则等启动时那次登录。
  async loginOnce(fresh) {
    try {
      var result = await (fresh ? app.retryLogin() : app.loginPromiseNew)
      if (result && result.authenticated === true) return { ok: true }
      return { ok: false, reason: (result && result.reason) || 'no_result' }
    } catch (err) {
      return { ok: false, reason: 'login_exception: ' + String((err && (err.message || err.errMsg)) || err || '').trim().slice(0, 100) }
    }
  },

  // 自动重试前的倒计时：每跳更新一次界面提示，倒数完返回；秒数为 0 时直接返回。
  async waitBeforeRetry() {
    var that = this
    for (var left = that.autoRetrySeconds; left > 0; left--) {
      that.setData({ wait_hint: '网络不太稳定，' + left + ' 秒后自动重新登录，请稍候…' })
      await new Promise(function (resolve) { setTimeout(resolve, that.autoRetryTickMs) })
    }
  },

  async verifyNow(retryLogin) {
    var that = this
    if (that.data.busy) return
    if (!that.data.code) {
      that.setData({ state: 'error', login_error: false, message: '二维码参数缺失，请重新扫描店员手机上的二维码' })
      return
    }
    that.setData({ state: 'loading', message: '', login_error: false, login_reason: '', busy: true })
    try {
      var attempt = await that.loginOnce(retryLogin === true)
      // 自动进入时登录失败，先静默重试 1 次（页面仍是「正在验证」）：手机网络瞬断时顾客不用自己点「重新登录」。
      // 顾客手动点「重新登录」那次不再自动重试。
      if (!attempt.ok && retryLogin !== true) {
        await that.waitBeforeRetry()
        if (that.autoRetrySeconds > 0) that.setData({ wait_hint: '正在重新登录…' })
        attempt = await that.loginOnce(true)
      }
      if (!attempt.ok) {
        that.showLoginError(attempt.reason)
        return
      }
      if (typeof app.globalData.sessionKey !== 'string' || !app.globalData.sessionKey.trim()) {
        that.showLoginError('empty_session')
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
      that.setData({ busy: false, wait_hint: '' })
    }
  },

  onBindCell(e) {
    var that = this
    if (that.data.busy) return
    if (typeof app.globalData.sessionKey !== 'string' || !app.globalData.sessionKey.trim()) {
      that.showLoginError('empty_session')
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
      // 手机号验证成功：先请顾客完善头像昵称（可跳过），处理完再继续核验取板
      return profileAuth.ensureOn(that).then(function () { that.verifyNow() })
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

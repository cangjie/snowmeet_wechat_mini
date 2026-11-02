// 学员领取页：打开教练分享的小程序卡片。状态：可领取 / 已领取 / 已被别人领走 / 已失效 / 教练本人 / 已有该教练的卡。
// 还不是会员的人先授权手机号（成为会员），再领取。别人再点同一张卡片显示「已被领取」
const app = getApp()
const api = require('../common/api.js')
const view = require('../common/coach-view.js')
const data = require('../../../utils/data.js')

function parseToken(options) {
  options = options || {}
  let t = options.t
  if (t == null) {
    let query = options.scene || options.q || ''
    try { query = decodeURIComponent(query) } catch (err) { return '' }
    const m = /(?:^|[?&])t=([0-9a-zA-Z]+)(?:&|$)/.exec(query)
    t = m ? m[1] : ''
  }
  return /^[0-9a-zA-Z]{8,32}$/.test(String(t)) ? String(t) : ''
}

Page({
  data: { token: '', loading: true, claiming: false, loginError: false, errMsg: '', state: '', message: '', coachName: '', needMember: false, benefit: null, validUntil: '' },

  onLoad(options) {
    this.setData({ token: parseToken(options) })
    return this.load()
  },

  async load(retryLogin) {
    if (this._loading) return
    if (!this.data.token) { this.setData({ loading: false, errMsg: '分享链接不完整' }); return }
    this._loading = true
    this.setData({ loading: true, errMsg: '', loginError: false })
    try {
      const login = await (retryLogin === true ? app.retryLogin() : app.loginPromiseNew)
      if ((login && login.authenticated === false) || typeof app.globalData.sessionKey !== 'string' || !app.globalData.sessionKey.trim()) {
        this.setData({ loginError: true, errMsg: '微信登录未完成，请检查网络后重新登录。' })
        return
      }
      this.apply(await api.getShareCard(this.data.token))
    } catch (err) {
      this.setData({ errMsg: (err && err.message) || '加载失败，请重试' })
    } finally {
      this._loading = false
      this.setData({ loading: false })
    }
  },

  // 服务端返回的状态 → 页面数据
  apply(d) {
    const v = d.view || {}
    this.setData({
      state: v.state || 'invalid', message: v.message || '', coachName: v.coachName || '', needMember: !!d.needMember,
      benefit: view.benefitLines(v.carePrices, v.rentalRate), validUntil: view.dayText(v.validUntil)
    })
  },

  // 已是会员：直接领取
  async onClaim() {
    if (this.data.loading || this.data.claiming) return
    this.setData({ claiming: true, errMsg: '' })
    try {
      this.apply(await api.claimShareCard(this.data.token))
      this.setData({ needMember: false })
      wx.showToast({ title: '领取成功', icon: 'success' })
    } catch (err) {
      await this.onClaimFailed(err)
    } finally {
      this.setData({ claiming: false })
    }
  },

  // 领取失败：code 5 = 还不是会员；其余带 state 的（已被领走、已失效、本人、已有该教练的卡）显示对应画面
  async onClaimFailed(err) {
    if (err && err.code === 5) { this.setData({ needMember: true, errMsg: '需要先授权手机号' }); return }
    const state = err && err.data && err.data.state
    if (state) { this.setData({ state, message: err.message || '', needMember: false }); return }
    if (err && err.code === 2) { this.setData({ loginError: true, errMsg: err.message }); return }
    this.setData({ errMsg: (err && err.message) || '领取失败，请重试' })
  },

  // 还不是会员：授权手机号后成为会员，再自动领取
  async onPhone(e) {
    const detail = (e && e.detail) || {}
    if (!detail.encryptedData || !detail.iv) {
      this.setData({ errMsg: '需要授权手机号才能领取，请重试' })
      return
    }
    this.setData({ claiming: true, errMsg: '' })
    try {
      await data.bindWechatCellPromise(detail.encryptedData, detail.iv, app.globalData.sessionKey)
    } catch (err) {
      this.setData({ claiming: false, errMsg: '手机号授权失败，请重试' })
      return
    }
    this.setData({ claiming: false })
    return this.onClaim()
  },

  onRetry() { return this.load(this.data.loginError) },
  onGoMine() { wx.redirectTo({ url: '../card/card' }) },
  onGoCoach() { wx.redirectTo({ url: '../home/home' }) }
})

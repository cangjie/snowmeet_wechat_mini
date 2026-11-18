// 分销商优惠券批次的领取页（用户 2026-11-18）：顾客扫批次二维码、或点开分销商转发的小程序卡片到这里。
// 创建批次时没有生成券，这里点「领取」才由服务端生成一张；规则：领满规定张数不能再领，每个 openid 每天只能领一次、同一批次只能领一次。
// 状态：可领取 / 已领取（带券码）/ 今天已领过 / 已领完 / 已过期 / 已失效 / 分销商本人。
// 还不是会员的人先授权手机号（成为会员），再领取；领取成功不要求头像昵称，手机号授权后会请顾客完善头像昵称（可跳过）。
const app = getApp()
const api = require('../common/api.js')
const data = require('../../../utils/data.js')
const profileAuth = require('../../../utils/profile_auth.js')

function parseToken(options) {
  options = options || {}
  let c = options.c
  if (c == null) {
    let query = options.scene || options.q || ''
    try { query = decodeURIComponent(query) } catch (err) { return '' }
    const m = /(?:^|[?&])c=([0-9a-zA-Z]+)(?:&|$)/.exec(query)
    c = m ? m[1] : ''
  }
  return /^[0-9a-zA-Z]{8,32}$/.test(String(c)) ? String(c) : ''
}

Page({
  data: {
    token: '', loading: true, claiming: false, loginError: false, errMsg: '', needMember: false,
    state: '', message: '', name: '', memo: '', distributorName: '', total: 0, remaining: 0, validUntil: '', code: ''
  },

  onLoad(options) {
    this.setData({ token: parseToken(options) })
    return this.load()
  },

  async load(retryLogin) {
    if (this._loading) return
    if (!this.data.token) { this.setData({ loading: false, errMsg: '领取链接不完整' }); return }
    this._loading = true
    this.setData({ loading: true, errMsg: '', loginError: false })
    try {
      const login = await (retryLogin === true ? app.retryLogin() : app.loginPromiseNew)
      if ((login && login.authenticated === false) || typeof app.globalData.sessionKey !== 'string' || !app.globalData.sessionKey.trim()) {
        this.setData({ loginError: true, errMsg: '微信登录未完成，请检查网络后重新登录。' })
        return
      }
      this.apply(await api.getCouponShare(this.data.token))
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
      state: v.state || 'invalid', message: v.message || '', name: v.name || '', memo: v.memo || '', distributorName: v.distributorName || '',
      total: v.total || 0, remaining: v.remaining || 0, validUntil: v.validUntil ? String(v.validUntil).slice(0, 10) : '', code: v.code || '',
      needMember: !!d.needMember
    })
  },

  // 领取：服务端这时才生成券。失败时 code 5 = 还不是会员；code 2 = 登录失效
  async onClaim() {
    if (this.data.loading || this.data.claiming) return
    this.setData({ claiming: true, errMsg: '' })
    try {
      this.apply(await api.claimCoupon(this.data.token))
      this.setData({ needMember: false })
      if (this.data.state === 'claimed_by_me') wx.showToast({ title: '领取成功', icon: 'success' })
    } catch (err) {
      if (err && err.code === 5) this.setData({ needMember: true, errMsg: '需要先授权手机号' })
      else if (err && err.code === 2) this.setData({ loginError: true, errMsg: err.message })
      else this.setData({ errMsg: (err && err.message) || '领取失败，请重试' })
    } finally {
      this.setData({ claiming: false })
    }
  },

  // 还不是会员：授权手机号后成为会员，再请顾客完善头像昵称（可跳过），然后自动领取
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
    await profileAuth.ensureOn(this)
    return this.onClaim()
  },

  onRetry() { return this.load(this.data.loginError) },
  onGoMine() { wx.redirectTo({ url: '/pages/mine/ticket/ticket_list' }) }
})

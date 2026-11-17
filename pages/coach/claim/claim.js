// 会籍卡领取页：顾客扫分享二维码或点开分享的小程序卡片到这里。状态：可领取 / 已领取 / 已被别人领走 / 已失效 / 分销商本人 / 已有该卡种。
// 还不是会员的人先授权手机号（成为会员），再领取；领取要求头像和昵称都已授权（2026-11-17），没授权的会弹出授权层，
// 授权完才领；领取成功显示和本人绑定的会籍卡卡号。别人再点同一张卡片显示「已被领取」
const app = getApp()
const api = require('../common/api.js')
const view = require('../common/coach-view.js')
const data = require('../../../utils/data.js')
const profileAuth = require('../../../utils/profile_auth.js')

// 服务端「领取需要先授权头像和昵称」：code 1 + data.state = need_profile
function isNeedProfile(err) { return !!(err && err.data && err.data.state === 'need_profile') }

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
  data: { token: '', isTemplate: false, loading: true, claiming: false, loginError: false, errMsg: '', state: '', message: '', coachName: '', cardName: '', needMember: false, needProfile: false, cardNo: '', benefit: null, validUntil: '' },

  onLoad(options) {
    const template = options && options.template
    this.setData({ token: template ? parseToken({ t: template }) : parseToken(options), isTemplate: !!template })
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
      this.apply(await (this.data.isTemplate ? api.getShareTemplate(this.data.token) : api.getShareCard(this.data.token)))
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
      state: v.state || 'invalid', message: v.message || '', coachName: v.coachName || '', cardName: v.cardName || ((v.coachName || '') + '的会籍卡'), needMember: !!d.needMember,
      needProfile: !!v.needProfile, cardNo: v.cardNo || '',
      benefit: view.benefitLines(v.carePrices, v.rentalRate), validUntil: view.dayText(v.validUntil)
    })
  },

  // 领取。头像昵称没授权的先弹授权层（跳过过也再弹）；授权完才领，顾客跳过了服务端会拒绝，卡仍留着，授权后可再领
  async onClaim() {
    if (this.data.loading || this.data.claiming) return
    this.setData({ claiming: true, errMsg: '' })
    try {
      // onPhone 刚在授权手机号后问过一次头像昵称：这次不重复问
      let asked = this._profileAsked === true
      this._profileAsked = false
      if (this.data.needProfile && !asked) { await profileAuth.ensureOn(this, true); asked = true }
      for (;;) {
        try {
          this.apply(await (this.data.isTemplate ? api.claimShareTemplate(this.data.token) : api.claimShareCard(this.data.token)))
          this.setData({ needMember: false, needProfile: false })
          wx.showToast({ title: '领取成功', icon: 'success' })
          return
        } catch (err) {
          // 页面没带「需要授权」的标志、服务端却说需要（刚改过资料、旧页面）：这里补弹一次再领
          if (isNeedProfile(err) && !asked) { asked = true; this.setData({ needProfile: true }); await profileAuth.ensureOn(this, true); continue }
          throw err
        }
      }
    } catch (err) {
      await this.onClaimFailed(err)
    } finally {
      this.setData({ claiming: false })
    }
  },

  // 领取失败：code 5 = 还不是会员；其余带 state 的（已被领走、已失效、本人、已有该教练的卡）显示对应画面
  async onClaimFailed(err) {
    if (isNeedProfile(err)) { this.setData({ needProfile: true, errMsg: '领取会籍卡需要先授权头像和昵称，请点「授权头像昵称并领取」，按提示完成后再领' }); return }
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
    // 手机号验证成功：领取要求头像昵称，先请顾客授权（已有完整资料的不会弹；跳过过也再弹一次），处理完再领取；
    // 顾客跳过了，服务端会拒绝领取（卡仍留着），页面提示授权后再领
    this.setData({ claiming: false })
    await profileAuth.ensureOn(this, true)
    this._profileAsked = true
    return this.onClaim()
  },

  onRetry() { return this.load(this.data.loginError) },
  onGoMine() { wx.redirectTo({ url: '../card/card' }) },
  onGoCoach() { wx.redirectTo({ url: '../home/home' }) }
})

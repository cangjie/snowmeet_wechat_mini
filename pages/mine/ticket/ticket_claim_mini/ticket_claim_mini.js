// 新分享批次的领取入口；历史批次与旧海报继续使用原领取页面。
const app = getApp()
const data = require('../../../../utils/data.js')

function parseBatchId(options) {
  options = options || {}
  let value = options.batch
  if (value == null) {
    let query = options.scene || options.q || ''
    try { query = decodeURIComponent(query) } catch (err) { return 0 }
    const match = /(?:^|[?&])batch=(\d+)(?:&|$)/.exec(query)
    value = match ? match[1] : ''
  }
  if (!/^\d+$/.test(String(value))) return 0
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : 0
}

Page({
  data: {
    batchId: 0, loading: true, claiming: false,
    loginError: false, needMember: false, authBusy: false,
    errMsg: '', info: null, doneCode: ''
  },

  onLoad(options) {
    this.setData({ batchId: parseBatchId(options) })
    return this.load()
  },

  async load(retryLogin) {
    if (this._loading || this.data.claiming) return
    if (!this.data.batchId) {
      this.setData({ loading: false, errMsg: '分享链接不完整' })
      return
    }
    this._loading = true
    this.setData({ loading: true, errMsg: '', loginError: false, needMember: false })
    try {
      const login = await (retryLogin === true ? app.retryLogin() : app.loginPromiseNew)
      if ((login && login.authenticated === false)
        || typeof app.globalData.sessionKey !== 'string' || !app.globalData.sessionKey.trim()) {
        this.setData({ loginError: true, errMsg: '微信登录未完成，请检查网络后重新登录。' })
        return
      }
      // 新顾客或尚未绑定手机号的会员，都要先验证手机号再领取。
      if (!app.globalData.member || !app.globalData.member.id || !app.globalData.member.cell) {
        this.setData({ needMember: true })
        return
      }
      const info = await data.getMiniShareBatchPromise(this.data.batchId, app.globalData.sessionKey)
      if (!info) throw new Error('分享链接已失效')
      this.setData({ info: info, doneCode: info.claimed ? (info.claimedCode || '') : '' })
    } catch (err) {
      this.setData({ errMsg: typeof err === 'string' ? err : (err.message || '加载失败，请重试') })
    } finally {
      this._loading = false
      this.setData({ loading: false })
    }
  },

  async onClaim() {
    const info = this.data.info
    if (this.data.loading || this.data.claiming || this.data.needMember || !info || info.claimed || info.soldOut || this.data.doneCode) return
    if (typeof app.globalData.sessionKey !== 'string' || !app.globalData.sessionKey.trim()) {
      this.setData({ loginError: true, errMsg: '微信登录未完成，请重新登录。' })
      return
    }
    this.setData({ claiming: true, errMsg: '' })
    try {
      const claim = info.shareType === 'qrcode' ? data.claimMiniQrCodeTicketPromise : data.claimMiniSharedTicketPromise
      const result = await claim(this.data.batchId, app.globalData.sessionKey)
      if (!result || !result.code) throw new Error('领取结果无效，请重试')
      this.setData({ doneCode: result.code })
      wx.showToast({ title: '领取成功', icon: 'success' })
    } catch (err) {
      this.setData({ errMsg: typeof err === 'string' ? err : (err.message || '领取失败，请重试') })
    } finally {
      this.setData({ claiming: false })
    }
  },

  async onGetCell(e) {
    if (this.data.authBusy) return
    const detail = e && e.detail
    if (!detail || detail.errMsg !== 'getPhoneNumber:ok' || !detail.encryptedData || !detail.iv) {
      this.setData({ errMsg: '授权手机号后才能领取优惠券' })
      return
    }
    this.setData({ authBusy: true, errMsg: '' })
    try {
      const member = await data.bindWechatCellPromise(detail.encryptedData, detail.iv, app.globalData.sessionKey)
      if (!member || !member.id || !member.cell) throw new Error('手机号验证未完成，请重试')
      app.globalData.member = member
      this.setData({ needMember: false })
      await this.load()
    } catch (err) {
      this.setData({ errMsg: typeof err === 'string' ? err : (err.message || '手机号授权失败，请重试') })
    } finally {
      this.setData({ authBusy: false })
    }
  },

  onRetry() { return this.load(this.data.loginError) },
  onGoMyTickets() { wx.redirectTo({ url: '/pages/mine/ticket/ticket_list' }) }
})

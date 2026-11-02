// 今后新发起的转赠使用此页；已有链接仍进入原 ticket_share 页面。
const app = getApp()
const data = require('../../../utils/data.js')

Page({
  data: {
    code: '', ticket: null, loading: true, accepting: false,
    canAccept: false, loginError: false, needPhone: false, authBusy: false, message: ''
  },

  onLoad(options) {
    this.setData({ code: String((options && options.code) || '').trim() })
    return this.load()
  },

  async load(retryLogin) {
    if (this._loading || this.data.accepting) return
    if (!this.data.code) {
      this.setData({ loading: false, canAccept: false, message: '分享链接不完整' })
      return
    }
    this._loading = true
    this.setData({ loading: true, canAccept: false, loginError: false, needPhone: false, message: '' })
    try {
      const login = await (retryLogin === true ? app.retryLogin() : app.loginPromiseNew)
      if ((login && login.authenticated === false)
        || typeof app.globalData.sessionKey !== 'string' || !app.globalData.sessionKey.trim()) {
        this.setData({ loginError: true, message: '微信登录未完成，请检查网络后重新登录。' })
        return
      }
      if (!app.globalData.member || !app.globalData.member.id || !app.globalData.member.cell) {
        this.setData({ needPhone: true, message: '验证手机号后才能接受优惠券' })
        return
      }
      const ticket = await data.getTicket(this.data.code)
      if (!ticket) throw new Error('分享链接已失效')
      ticket.usage = String(ticket.memo || '').split(';').filter(Boolean)
      const isMine = app.globalData.member && Number(ticket.member_id) === Number(app.globalData.member.id)
      const canAccept = ticket.shared === 1 && !isMine
      this.setData({
        ticket: ticket,
        canAccept: canAccept,
        message: ticket.shared !== 1
          ? (isMine ? '优惠券已在你的券包中' : '优惠券已被领取，或分享人已撤回分享。')
          : (isMine ? '不能接受自己分享的优惠券' : '')
      })
    } catch (err) {
      this.setData({ message: typeof err === 'string' ? err : (err.message || '加载失败，请重试') })
    } finally {
      this._loading = false
      this.setData({ loading: false })
    }
  },

  async accept() {
    if (this.data.accepting || this.data.loading || this.data.needPhone || !this.data.canAccept || !this.data.ticket) return
    if (!app.globalData.sessionKey) {
      this.setData({ canAccept: false, loginError: true, message: '微信登录未完成，请重新登录。' })
      return
    }
    this.setData({ accepting: true, message: '' })
    try {
      await data.acceptMiniTicketPromise(this.data.ticket.code, '分享获得', app.globalData.sessionKey)
      this.setData({ canAccept: false, message: '优惠券已经入账' })
      wx.showToast({ title: '优惠券已经入账', icon: 'success' })
      wx.redirectTo({ url: '/pages/mine/ticket/ticket_list' })
    } catch (err) {
      this.setData({ message: typeof err === 'string' ? err : '接受失败，请重试' })
    } finally {
      this.setData({ accepting: false })
    }
  },

  async onGetCell(e) {
    if (this.data.authBusy) return
    const detail = e && e.detail
    if (!detail || detail.errMsg !== 'getPhoneNumber:ok' || !detail.encryptedData || !detail.iv) {
      this.setData({ message: '授权手机号后才能接受优惠券' })
      return
    }
    this.setData({ authBusy: true, message: '' })
    try {
      const member = await data.bindWechatCellPromise(detail.encryptedData, detail.iv, app.globalData.sessionKey)
      if (!member || !member.id || !member.cell) throw new Error('手机号验证未完成，请重试')
      app.globalData.member = member
      await this.load()
    } catch (err) {
      this.setData({ message: typeof err === 'string' ? err : (err.message || '手机号验证失败，请重试') })
    } finally {
      this.setData({ authBusy: false })
    }
  },

  onRetry() { return this.load(this.data.loginError) },
  onGoMyTickets() { wx.redirectTo({ url: '/pages/mine/ticket/ticket_list' }) }
})

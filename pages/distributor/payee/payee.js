// 收款资料（只读）：分账打到哪里。要修改请联系系统管理员，小程序里不提供修改入口（用户 2026-11-15 定）。
const app = getApp()
const api = require('../common/api.js')

Page({
  data: { loading: true, error: '', payee: null },
  onLoad() {
    return Promise.resolve(app.loginPromiseNew).then(() => this.load())
      .catch(() => this.setData({ error: '登录失败，请重试', loading: false }))
  },
  onPullDownRefresh() { return this.load().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh()) },
  load() {
    this.setData({ loading: true, error: '' })
    return api.getPayee().then(payee => {
      this.setData({ payee, loading: false })
    }).catch(e => {
      this.setData({ loading: false, error: (e && e.message) || '加载失败，请重试' })
    })
  }
})

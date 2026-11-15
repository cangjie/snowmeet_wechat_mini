// 某位顾客记在我名下的订单（逐单显示来源：雪票码 / 学员卡 / 优惠券）。
const app = getApp()
const api = require('../common/api.js')

function fmtDate(value) {
  if (!value) return ''
  const d = new Date(String(value).replace(/-/g, '/').replace('T', ' ').replace(/\.\d+$/, ''))
  if (isNaN(d.getTime())) return String(value).slice(0, 10)
  const pad = n => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

Page({
  data: { loading: true, error: '', customer: null, orders: [] },
  onLoad(options) {
    this._memberId = options && options.memberId
    return Promise.resolve(app.loginPromiseNew).then(() => this.load())
      .catch(() => this.setData({ error: '登录失败，请重试', loading: false }))
  },
  load() {
    if (!this._memberId) { this.setData({ loading: false, error: '缺少顾客信息' }); return Promise.resolve() }
    this.setData({ loading: true, error: '' })
    return api.getCustomerOrders(this._memberId).then(res => {
      const orders = (res.orders || []).map(o => Object.assign({}, o, { day: fmtDate(o.date), from: (o.sources || []).join('、') }))
      this.setData({ customer: res.customer || null, orders, loading: false })
    }).catch(e => {
      this.setData({ loading: false, error: (e && e.message) || '加载失败，请重试' })
    })
  }
})

// 我的顾客与消费（教练 / 机构）。顾客认定：接了我转发的券、领了我的学员卡、或取了我雪票码订的票，
// 且还没有归属别的分销商；已有归属的顾客关系不变，但这一笔订单记在我名下。消费只算归属我的订单实付净额。
const app = getApp()
const api = require('../common/api.js')

const RELATION = {
  mine: { text: '名下顾客', tone: 'ok' },
  other: { text: '他人顾客 · 仅本单', tone: 'warn' },
  none: { text: '尚未归属 · 仅本单', tone: 'gray' }
}

function fmtDate(value) {
  if (!value) return ''
  const d = new Date(String(value).replace(/-/g, '/').replace('T', ' ').replace(/\.\d+$/, ''))
  if (isNaN(d.getTime())) return String(value).slice(0, 10)
  const pad = n => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

Page({
  data: { loading: true, error: '', summary: null, customers: [] },
  onLoad() {
    return Promise.resolve(app.loginPromiseNew).then(() => this.load())
      .catch(() => this.setData({ error: '登录失败，请重试', loading: false }))
  },
  onPullDownRefresh() { return this.load().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh()) },
  load() {
    this.setData({ loading: true, error: '' })
    return api.getMyCustomers().then(res => {
      const customers = (res.customers || []).map(c => Object.assign({}, c, {
        tag: RELATION[c.relation] || RELATION.none,
        last: fmtDate(c.lastOrderDate)
      }))
      this.setData({ summary: res.summary || null, customers, loading: false })
    }).catch(e => {
      this.setData({ loading: false, error: (e && e.message) || '加载失败，请重试' })
    })
  },
  onCustomer(e) {
    const id = e.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: '/pages/distributor/customer_orders/customer_orders?memberId=' + id })
  }
})

const api = require('../../utils/trial_api.js')

function today() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}
function rows(list) {
  const labels = { pending: '待签到', in_use: '试滑中', returned: '已归还', cancelled: '已取消' }
  return (list || []).map(x => ({ ...x, date: String(x.reservation_date).slice(0, 10),
    label: x.status === 'pending' && String(x.reservation_date).slice(0, 10) < today() ? '已过期' : labels[x.status] }))
}
Page({
  data: { date: today(), today: today(), boards: [], reservations: [], eligible: false, already: false, loading: false, error: '' },
  onShow() { this.setData({ today: today() }); this.load() },
  onDate(e) { this.setData({ date: e.detail.value }); this.load() },
  load() {
    const date = this.data.date
    this.setData({ loading: true, error: '' })
    return Promise.all([api.request('Options', { date }), api.request('Mine')]).then(([options, mine]) => {
      if (date !== this.data.date) return
      this.setData({ ...options, reservations: rows(mine.reservations), loading: false })
    }).catch(err => { if (date === this.data.date) this.setData({ error: err.message, loading: false }) })
  },
  reserve(e) {
    const productId = Number(e.currentTarget.dataset.id)
    if (this.data.loading || !this.data.eligible || this.data.already) return
    this.setData({ loading: true })
    api.request('Reserve', {}, { productId, date: this.data.date }).then(() => {
      wx.showToast({ title: '预约成功' })
      return this.load()
    }).catch(err => { this.setData({ error: err.message, loading: false }) })
  },
  cancel(e) {
    const id = Number(e.currentTarget.dataset.id)
    wx.showModal({ title: '取消预约', content: '取消后可重新选择单板。', success: r => {
      if (!r.confirm) return
      api.request('CancelMine', {}, { id }).then(() => this.load()).catch(err => this.setData({ error: err.message }))
    } })
  }
})

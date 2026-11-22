const api = require('../../utils/trial_api.js')
const localQrImage = require('../../utils/local_qr_image.js')
function today() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}
Page({
  data: { date: today(), today: today(), rows: [], loading: true, error: '', qr: null },
  onShow() { this.setData({ today: today(), qr: null }); this.load() },
  onHide() { this.stopPolling() },
  onUnload() { this.stopPolling() },
  dateChange(e) { this.setData({ date: e.detail.value, rows: [] }); this.load() },
  load() {
    const date = this.data.date
    this.setData({ loading: true, error: '' })
    api.request('StaffList', { date }).then(result => {
      if (date !== this.data.date) return
      const labels = { pending: '待签到', in_use: '试滑中', returned: '已归还', cancelled: '已取消' }
      this.setData({ rows: (result.reservations || []).map(x => ({ ...x,
        date: String(x.reservation_date).slice(0, 10),
        label: x.status === 'pending' && String(x.reservation_date).slice(0, 10) < today() ? '已过期' : labels[x.status] })), loading: false, error: '' })
    }).catch(err => { if (date === this.data.date) this.setData({ error: err.message, loading: false }) })
  },
  showQr(e) {
    const id = Number(e.currentTarget.dataset.id)
    api.request('CreateQr', {}, { id }).then(() => {
      const url = api.qrUrl(id)
      const local = localQrImage.isLocalUrl(url)
      this.setData({ error: '', qr: { id, url: local ? '' : url, message: local ? '正在生成二维码…' : '请预约会员本人扫码确认，两分钟内有效' } })
      this.stopPolling()
      this._timer = setInterval(() => api.request('QrStatus', { id }).then(r => {
        if (!this.data.qr || this.data.qr.id !== id) return
        if (r.status === 'in_use') { this.closeQr(); this.load(); wx.showToast({ title: '签到成功' }) }
        else if (r.expired || r.status !== 'pending') { this.stopPolling(); this.setData({ 'qr.url': '', 'qr.message': '二维码已失效，请重新生成' }) }
      }).catch(err => { this.stopPolling(); this.setData({ 'qr.message': err.message }) }), 2000)
      if (local) this.loadLocalQr(id, url)
    }).catch(err => this.setData({ error: err.message }))
  },
  loadLocalQr(id, url) {
    const qr = this.data.qr
    localQrImage.load(url).then(image => {
      if (this.data.qr !== qr || !this._timer) return
      this.setData({ 'qr.url': image, 'qr.message': '请预约会员本人扫码确认，两分钟内有效' })
    }).catch(err => {
      if (this.data.qr !== qr || !this._timer) return
      console.warn('试滑签到二维码加载失败', err.message)
      this.stopPolling()
      this.setData({ 'qr.message': err.message })
    })
  },
  qrError() { this.stopPolling(); this.setData({ 'qr.url': '', 'qr.message': '二维码生成失败，请重试' }) },
  stopPolling() { if (this._timer) clearInterval(this._timer); this._timer = null },
  closeQr() { this.stopPolling(); this.setData({ qr: null }) },
  cancel(e) { this.action('StaffCancel', Number(e.currentTarget.dataset.id), '确认取消预约？') },
  returnBoard(e) { this.action('Return', Number(e.currentTarget.dataset.id), '确认单板已归还？') },
  action(action, id, content) {
    wx.showModal({ title: '请确认', content, success: r => {
      if (r.confirm) api.request(action, {}, { id }).then(() => this.load()).catch(err => this.setData({ error: err.message }))
    } })
  }
})

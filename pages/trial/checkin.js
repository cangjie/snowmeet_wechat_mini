const api = require('../../utils/trial_api.js')
Page({
  data: { token: '', info: null, error: '', busy: false, done: false },
  onLoad(options) {
    let token
    try { token = decodeURIComponent(options.scene || '') } catch (e) { this.setData({ error: '二维码无效' }); return }
    if (!/^[0-9a-f]{24}$/.test(token)) { this.setData({ error: '二维码无效' }); return }
    this.setData({ token })
    api.request('CheckinInfo', { token }).then(info => this.setData({ info }))
      .catch(err => this.setData({ error: err.message }))
  },
  confirm() {
    if (this.data.busy || this.data.done) return
    this.setData({ busy: true, error: '' })
    api.request('Checkin', {}, { token: this.data.token }).then(() => this.setData({ done: true }))
      .catch(err => this.setData({ error: err.message })).finally(() => this.setData({ busy: false }))
  }
})

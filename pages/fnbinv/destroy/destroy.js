// 过期食材销毁：待销毁（已过期在库批次）逐批确认 → PostWaste(expiry)；已销毁取损耗台账，留痕不可回退
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/stock-view.js')
const expiry = require('../common/expiry.js')
const dash = require('../common/dash.js')
const requestId = require('../common/request-id.js')

Page({
  data: { blocked: '', loading: true, isManager: false, tab: 'pending', pending: [], done: [], doneError: '' },

  onLoad() {
    this.keeper = requestId.createKeeper()
    base.boot(this).then(() => this.load()).catch(() => {})
  },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    if (!this.ctx) return Promise.resolve()
    const pending = api.getAll(this.ctx, 'FnbReport/GetExpirySummary').then(rows => {
      this.setData({ pending: expiry.groupAlerts(rows).expired.map(r => view.alertRow(r, this.data.today)) })
    })
    const done = this.data.isManager
      ? api.getAll(this.ctx, 'FnbReport/GetLossLedger', { from: expiry.addDays(this.data.today, -90), to: this.data.today }).then(rows => {
        this.setData({ done: rows.filter(r => r.reason_code === 'expiry').map(r => Object.assign(dash.ledgerRow(r), { at: String(r.posted_at).slice(0, 16).replace('T', ' ') })) })
      })
      : Promise.resolve(this.setData({ doneError: '查看销毁记录需要店长权限' }))
    return Promise.all([pending, done]).then(() => this.setData({ loading: false }))
      .catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  onTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }) },

  onDestroy(e) {
    if (!this.data.isManager) { wx.showToast({ title: '确认销毁需要店长权限', icon: 'none' }); return }
    const id = Number(e.currentTarget.dataset.id)
    const row = this.data.pending.find(r => r.batchId === id)
    wx.showModal({
      title: '确认已销毁', content: row.name + ' ' + row.qtyLabel + '（批次 ' + row.batchNo + '，已过期 ' + row.overdue + ' 天）确认已实际销毁？记录后不可回退。',
      confirmText: '已销毁', confirmColor: '#EF4444',
      success: res => {
        if (!res.confirm) return
        const key = 'destroy:' + id
        api.post(this.ctx, 'FnbInventory/PostWaste', { requestId: this.keeper.get(key), batchId: id, quantity: row.quantity, reasonCode: 'expiry', remark: '过期销毁' })
          .then(() => { this.keeper.done(key); wx.showToast({ title: '已记录销毁', icon: 'success' }); this.load() })
          .catch(err => { if (!err.retryable) this.keeper.done(key); base.fail(err) })
      }
    })
  }
})

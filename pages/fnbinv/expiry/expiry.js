// 临期与过期：三档分组；临期可报损（店长），已过期转销毁清单逐批确认
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/stock-view.js')
const expiry = require('../common/expiry.js')
const lowstock = require('../common/lowstock.js')
const requestId = require('../common/request-id.js')

Page({
  data: { blocked: '', loading: true, isManager: false, groups: [], expiredCount: 0 },

  onLoad() {
    this.keeper = requestId.createKeeper()
    base.boot(this).then(() => this.load()).catch(() => {})
  },
  onShow() { if (this.loadedOnce) this.load() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    if (!this.ctx) return Promise.resolve()
    return api.getAll(this.ctx, 'FnbReport/GetExpirySummary').then(rows => {
      this.loadedOnce = true
      const g = expiry.groupAlerts(rows)
      lowstock.setBadge({ expiry: g.total })
      const row = r => view.alertRow(r, this.data.today)
      this.setData({
        loading: false, expiredCount: g.expired.length,
        groups: [
          { key: 'expired', title: '已过期', tone: 'danger', rows: g.expired.map(row) },
          { key: 'opened', title: '开封后临期', tone: 'warn', rows: g.opened.map(row) },
          { key: 'sealed', title: '未开封临期', tone: 'warn', rows: g.sealed.map(row) }
        ].filter(x => x.rows.length)
      })
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  goDestroy() { wx.navigateTo({ url: '/pages/fnbinv/destroy/destroy' }) },
  goBatch(e) { wx.navigateTo({ url: '/pages/fnbinv/batch/batch?id=' + e.currentTarget.dataset.id }) },

  onDiscard(e) {
    if (!this.data.isManager) { wx.showToast({ title: '报损需要店长权限', icon: 'none' }); return }
    const id = Number(e.currentTarget.dataset.id)
    const row = this.data.groups.reduce((all, g) => all.concat(g.rows), []).find(r => r.batchId === id)
    wx.showModal({
      title: '临期报损', content: row.name + ' ' + row.qtyLabel + '（批次 ' + row.batchNo + '）将整批报损并记入损耗台账，不可恢复。',
      confirmText: '报损', confirmColor: '#EF4444',
      success: res => {
        if (!res.confirm) return
        const key = 'waste:' + id
        api.post(this.ctx, 'FnbInventory/PostWaste', { requestId: this.keeper.get(key), batchId: id, quantity: row.quantity, reasonCode: 'near_expiry', remark: '临期报损' })
          .then(() => { this.keeper.done(key); wx.showToast({ title: '已报损', icon: 'success' }); this.load() })
          .catch(err => { if (!err.retryable) this.keeper.done(key); base.fail(err) })
      }
    })
  }
})

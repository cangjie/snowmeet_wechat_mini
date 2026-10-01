// 工作手机：手机池。分给新员工、收回离职员工占用的手机、给手机绑定微信都在这里
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/staff-view.js')

const ORDER = { orphan: 0, no_wechat: 1, idle: 2, in_use: 3 }

Page({
  data: { blocked: '', loading: true, counts: {}, rows: [], openId: null, addShow: false, addCell: '' },

  onLoad() { base.boot(this, true).then(() => this.load()).catch(() => {}) },
  onShow() { if (this.loadedOnce) this.load() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    return api.listPhones().then(list => {
      this.loadedOnce = true
      const rows = list.map(p => Object.assign(view.viewPhone(p), {
        historyRows: p.history.map((h, i) => ({ key: i, name: h.name, range: view.dateLabel(h.start_date) + ' 至 ' + (h.end_date ? view.dateLabel(h.end_date) : '今') }))
      })).sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.tail > b.tail ? 1 : -1))
      const counts = view.summarizePhones(rows)
      counts.attention = counts.orphan + counts.no_wechat
      this.setData({ loading: false, rows, counts })
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  find(e) { return this.data.rows.find(r => r.id === Number(e.currentTarget.dataset.id)) },
  onToggle(e) {
    const id = Number(e.currentTarget.dataset.id)
    this.setData({ openId: this.data.openId === id ? null : id })
  },

  onReclaim(e) {
    const p = this.find(e)
    base.confirm('收回手机', '结束「' + p.holderLabel + '」对 ' + p.tail + ' 的占用，手机退回空闲。', '收回').then(ok => {
      if (!ok) return
      api.reclaimPhone(p.id).then(() => { base.done('已收回'); this.load() }).catch(base.fail)
    })
  },
  onBindWechat(e) {
    api.bindJobPhone(Number(e.currentTarget.dataset.id)).then(r => wx.navigateTo({ url: '../bindcode/bindcode?token=' + r.token })).catch(base.fail)
  },
  onAssign(e) { wx.navigateTo({ url: '../onboard/onboard?type=job&account=' + e.currentTarget.dataset.id }) },
  onHolder(e) { wx.navigateTo({ url: '../detail/detail?id=' + e.currentTarget.dataset.id }) },

  onAdd() { this.setData({ addShow: true, addCell: '' }) },
  closeAdd() { this.setData({ addShow: false }) },
  onAddCell(e) { this.setData({ addCell: e.detail.value }) },
  onConfirmAdd() {
    api.addJobPhone(this.data.addCell).then(r => {
      this.setData({ addShow: false })
      wx.navigateTo({ url: '../bindcode/bindcode?token=' + r.token })
    }).catch(base.fail)
  }
})

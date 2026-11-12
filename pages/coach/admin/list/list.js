// 教练管理（管理员）：教练列表、统计、搜索；勾选后批量发券，底部可添加教练
const api = require('../../common/api.js')
const base = require('../../common/page-base.js')
const view = require('../../common/coach-view.js')

Page({
  data: { blocked: '', loading: true, stats: null, keyword: '', rows: [], selected: {}, selectedCount: 0 },

  onLoad() { base.boot(this, 'admin').then(() => this.load()).catch(() => {}) },
  onShow() { if (this.loadedOnce) this.load() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    return api.listCoaches().then(d => {
      this.loadedOnce = true
      this.all = (d.coaches || []).map(row => {
        const c = row.coach
        return {
          id: c.id, name: c.name, valid: c.valid, phoneTail: c.phoneTail,
          chips: view.priceChips(c.carePrices, c.rentalRate), cards: c.cards,
          students: row.students, seasonAmount: row.seasonAmount, couponsGranted: row.couponsGranted
        }
      })
      this.setData({ loading: false, stats: d.stats })
      this.refresh()
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  refresh() {
    const k = (this.data.keyword || '').trim()
    const rows = (this.all || []).filter(r => !k || r.name.indexOf(k) >= 0 || String(r.phoneTail).indexOf(k) >= 0)
    // 停用的教练不能发券，不给勾选
    const selected = {}
    rows.forEach(r => { if (this.data.selected[r.id] && r.valid) selected[r.id] = true })
    this.setData({ rows, selected, selectedCount: Object.keys(selected).length })
  },

  onSearch(e) { this.setData({ keyword: e.detail.value }); this.refresh() },
  onClear() { this.setData({ keyword: '' }); this.refresh() },

  onToggle(e) {
    const id = e.currentTarget.dataset.id
    const row = (this.all || []).find(r => r.id === id)
    if (!row || !row.valid) { wx.showToast({ title: '已停用的教练不能发券', icon: 'none' }); return }
    const selected = Object.assign({}, this.data.selected)
    if (selected[id]) delete selected[id]
    else selected[id] = true
    this.setData({ selected, selectedCount: Object.keys(selected).length })
  },

  onOpen(e) { wx.navigateTo({ url: '../detail/detail?id=' + e.currentTarget.dataset.id }) },
  onAdd() { wx.navigateTo({ url: '../add/add' }) },
  onIssue() {
    const ids = Object.keys(this.data.selected)
    if (!ids.length) { wx.showToast({ title: '请先勾选要发券的教练', icon: 'none' }); return }
    wx.navigateTo({ url: '../issue/issue?ids=' + ids.join(',') })
  }
})

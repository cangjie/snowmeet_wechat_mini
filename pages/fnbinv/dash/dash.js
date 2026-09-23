// 数据看板（店长）：在库成本及一级分类结构、本周损耗金额与台账。损耗率 / 周转首版不做
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const units = require('../common/units.js')
const dash = require('../common/dash.js')

Page({
  data: { blocked: '', loading: true, isManager: false, totalCost: '', lossLabel: '', lossCount: 0, skuCount: 0, bars: [], ledger: [], range: '' },

  onLoad() { base.boot(this).then(() => this.load()).catch(() => {}) },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    if (!this.ctx) return Promise.resolve()
    if (!this.data.isManager) { this.setData({ loading: false }); return Promise.resolve() }
    const week = dash.weekRange(this.data.today)
    return Promise.all([
      api.getAll(this.ctx, 'FnbReport/GetOverview'),
      api.get(this.ctx, 'FnbCatalog/ListCategories'),
      api.getAll(this.ctx, 'FnbReport/GetLossLedger', { from: week.from, to: week.to })
    ]).then(([overview, categories, ledger]) => {
      const total = overview.reduce((s, r) => s + Number(r.total_amount || 0), 0)
      this.setData({
        loading: false, totalCost: units.money(total), skuCount: overview.filter(r => r.total_qty > 0).length,
        bars: dash.costBars(overview, categories), lossLabel: units.money(dash.lossAmount(ledger)), lossCount: ledger.length,
        ledger: ledger.map(dash.ledgerRow), range: week.from.slice(5) + ' ~ ' + week.to.slice(5)
      })
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  }
})

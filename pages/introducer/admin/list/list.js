// 介绍人管理（系统管理员）：列表、补绑支付宝分账关系、停用 / 启用；添加在 add 页
const api = require('../../../../utils/introducer_api.js')

const ADMIN_LEVEL = 300
const FILTERS = ['全部', '教练', 'KOL', '机构']
const TYPE_CLASS = { '教练': 'blue', 'KOL': 'kol', '机构': 'org' }

function decorate(r) {
  return {
    id: r.id, name: r.name, type: r.type, valid: r.valid, wechat: r.wechat, alipay: r.alipay, alipayMessage: r.alipayMessage || '',
    typeClass: TYPE_CLASS[r.type] || 'muted',
    wechatClass: r.wechat === '已填写' ? 'ok' : 'warn',
    alipayClass: r.alipay === '已绑定' ? 'ok' : (r.alipay === '未绑定' ? 'danger' : 'muted')
  }
}

Page({
  data: { blocked: '', loading: true, filters: FILTERS, filter: '全部', rows: [], counts: {} },

  onLoad() {
    Promise.resolve(getApp().loginPromiseNew).then(() => {
      const staff = getApp().globalData.staff
      if (!(staff && staff.valid === 1 && staff.title_level >= ADMIN_LEVEL)) {
        this.setData({ blocked: '只有系统管理员可以管理介绍人', loading: false })
        return null
      }
      return this.load()
    }).catch(() => {})
  },

  onShow() { if (this.loadedOnce) this.load() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    return api.listIntroducers().then(d => {
      this.loadedOnce = true
      this.all = (d.introducers || []).map(decorate)
      this.setData({ loading: false })
      this.refresh()
    }).catch(err => { this.setData({ loading: false }); api.fail(err) })
  },

  refresh() {
    const all = this.all || []
    const counts = { '全部': all.length }
    FILTERS.slice(1).forEach(f => { counts[f] = all.filter(r => r.type === f).length })
    const f = this.data.filter
    this.setData({ counts, rows: all.filter(r => f === '全部' || r.type === f) })
  },

  onFilter(e) { this.setData({ filter: e.currentTarget.dataset.name }); this.refresh() },
  onAdd() { wx.navigateTo({ url: '../add/add' }) },

  onRebind(e) {
    return api.bindAlipay(e.currentTarget.dataset.id).then(v => {
      wx.showToast({ title: v.alipay === '已绑定' ? '已绑定支付宝' : '绑定失败：' + (v.alipayMessage || '请核对账号和姓名'), icon: 'none', duration: 2800 })
      return this.load()
    }).catch(err => api.fail(err))
  },

  onToggle(e) {
    const d = e.currentTarget.dataset
    return api.updateIntroducer({ introducerId: d.id, valid: !d.valid }).then(() => this.load()).catch(err => api.fail(err))
  }
})

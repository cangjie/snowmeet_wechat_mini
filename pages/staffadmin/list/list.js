// 员工账号：入口页。按状态筛选、按姓名或手机号搜索，点开进详情办理各项操作
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/staff-view.js')

Page({
  data: { blocked: '', loading: true, filters: view.FILTERS, status: 'active', sectionTitle: '在职', keyword: '', counts: {}, rows: [] },

  onLoad(options) {
    if (options && options.status) this.setData({ status: options.status })
    base.boot(this, true).then(() => this.load()).catch(() => {})
  },
  onShow() { if (this.loadedOnce) this.load() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    return api.listStaff().then(list => {
      this.loadedOnce = true
      this.views = list.map(view.viewStaff)
      this.setData({ loading: false, counts: view.summarize(this.views) })
      this.refresh()
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  refresh() {
    const f = view.FILTERS.find(x => x.key === this.data.status)
    this.setData({ sectionTitle: f ? f.label : '', rows: view.filterStaff(this.views || [], this.data.status, this.data.keyword) })
  },

  onFilter(e) { this.setData({ status: e.currentTarget.dataset.key, keyword: '' }); this.refresh() },
  onSearch(e) { this.setData({ keyword: e.detail.value }); this.refresh() },
  onClear() { this.setData({ keyword: '' }); this.refresh() },

  onOpen(e) { wx.navigateTo({ url: '../detail/detail?id=' + e.currentTarget.dataset.id }) },
  onOnboard() { wx.navigateTo({ url: '../onboard/onboard' }) },
  onPhones() { wx.navigateTo({ url: '../phones/phones' }) },
  onSelfCode() { wx.navigateTo({ url: '../bindcode/bindcode?token=selfreg' }) }
})

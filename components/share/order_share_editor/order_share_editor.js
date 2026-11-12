// 订单详情页里的「介绍人分账」：店长以上（title_level ≥ 200）才显示；只显示这一单的分账列表（未提交的可以删除），
// 「添加分账记录」是一个按钮，点了去新页面（pages/introducer/share/add）里填收款人、金额、日期等；回来时列表自动刷新。
// 规则由服务端判断：什么时候能设置（canEdit / reason）、自动还是手动（每条的 state）。
// 卡片默认折叠，标题右边的摘要说明已经设了几条、合计多少。
const api = require('../../../utils/introducer_api.js')

const MANAGER_LEVEL = 200
// 已经提交的（已分账、被拒绝）不能再删
const REMOVABLE = ['待自动分账', '手动处理']
const STATE_CLASS = { '待自动分账': 'blue', '手动处理': 'warn', '已分账': 'ok', '被拒绝': 'danger' }
const ADD_PAGE = '/pages/introducer/share/add/add'

function decorate(s) {
  return Object.assign({}, s, { stateClass: STATE_CLASS[s.state] || 'muted', removable: REMOVABLE.indexOf(s.state) >= 0 })
}

function summarize(shares) {
  if (!shares.length) return '未设置'
  const total = Math.round(shares.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) * 100) / 100
  return '已设 ' + shares.length + ' 条，合计 ¥' + total
}

// 服务端返回的分账列表 → 页面上要刷新的两项
function sharesPatch(list) {
  const shares = (list || []).map(decorate)
  return { shares, summary: summarize(shares) }
}

Component({
  properties: {
    orderId: { type: Number, value: 0, observer(value, previous) { if (this._attached && value !== previous) this.load() } }
  },
  data: {
    hidden: true, loading: false, expanded: false, canEdit: false, reason: '', shares: [], summary: '未设置'
  },
  lifetimes: {
    attached() { this._attached = true; return this.load() }
  },
  pageLifetimes: {
    show() { this.onPageShow() }
  },
  methods: {
    load() {
      const staff = getApp().globalData.staff
      if (!(staff && staff.valid === 1 && staff.title_level >= MANAGER_LEVEL)) {
        this.setData({ hidden: true, loading: false })
        return Promise.resolve()
      }
      const orderId = this.properties.orderId
      if (!orderId) return Promise.resolve()
      this.setData({ hidden: false, loading: true })
      return api.getOrderShares(orderId).then(d => {
        this.setData(Object.assign({ loading: false, canEdit: !!d.canEdit, reason: d.reason || '' }, sharesPatch(d.shares)))
      }).catch(err => {
        this.setData({ loading: false })
        // 网络不通或接口不存在（新版小程序先于后端上线）：这张卡片只是附加功能，静默隐藏，别在每个订单详情页都弹提示
        if (err && err.code === -1) { this.setData({ hidden: true }); return }
        api.fail(err)
      })
    },

    // 从「添加分账记录」页回来时重新读列表；没去过那一页的显示事件（比如第一次显示）不重复请求
    onPageShow() {
      if (!this._needRefresh) return Promise.resolve()
      this._needRefresh = false
      return this.load()
    },

    onToggle() { this.setData({ expanded: !this.data.expanded }) },

    onAdd() {
      this._needRefresh = true
      wx.navigateTo({ url: ADD_PAGE + '?orderId=' + this.properties.orderId })
    },

    onRemove(e) {
      const id = e.currentTarget.dataset.id
      return new Promise(resolve => {
        wx.showModal({ title: '删除介绍人分账', content: '删除后这一份分账记录作废，其余分账会按新的合计重新判断自动还是手动。', confirmText: '删除',
          success: res => resolve(!!res.confirm) })
      }).then(ok => {
        if (!ok) return null
        return api.removeShare(id).then(r => this.setData(sharesPatch(r.shares)))
      }).catch(err => api.fail(err))
    }
  }
})

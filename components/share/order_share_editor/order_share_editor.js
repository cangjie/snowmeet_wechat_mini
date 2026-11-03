// 订单详情页里的「介绍人分账」：店长以上（title_level ≥ 200）可以看、设置、删除。
// 规则由服务端判断：什么时候能设置（canEdit / reason）、自动还是手动（每条的 state）、金额预填（suggested）。
const api = require('../../../utils/introducer_api.js')

const MANAGER_LEVEL = 200
// 已经提交的（已分账、被拒绝）不能再删
const REMOVABLE = ['待自动分账', '手动处理']
const STATE_CLASS = { '待自动分账': 'blue', '手动处理': 'warn', '已分账': 'ok', '被拒绝': 'danger' }

function decorate(s) {
  return Object.assign({}, s, { stateClass: STATE_CLASS[s.state] || 'muted', removable: REMOVABLE.indexOf(s.state) >= 0 })
}

Component({
  properties: {
    orderId: { type: Number, value: 0, observer(value, previous) { if (this._attached && value !== previous) this.load() } }
  },
  data: {
    hidden: true, loading: false, canEdit: false, reason: '', suggested: 0, shares: [], choices: [],
    form: { introducerId: '', amount: '', memo: '' }, saving: false
  },
  lifetimes: {
    attached() { this._attached = true; return this.load() }
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
        this.setData({
          loading: false, canEdit: !!d.canEdit, reason: d.reason || '', suggested: d.suggested || 0, shares: (d.shares || []).map(decorate),
          'form.amount': d.suggested > 0 ? String(d.suggested) : ''
        })
        if (!d.canEdit) return null
        return api.listChoices().then(c => this.setData({ choices: c.choices || [] }))
      }).catch(err => {
        this.setData({ loading: false })
        // 网络不通或接口不存在（新版小程序先于后端上线）：这张卡片只是附加功能，静默隐藏，别在每个订单详情页都弹提示
        if (err && err.code === -1) { this.setData({ hidden: true }); return }
        api.fail(err)
      })
    },

    onPick(e) { this.setData({ 'form.introducerId': e.currentTarget.dataset.id }) },
    onAmount(e) { this.setData({ 'form.amount': e.detail.value }) },
    onMemo(e) { this.setData({ 'form.memo': e.detail.value }) },

    onSave() {
      const d = this.data
      if (d.saving) return
      const toast = title => wx.showToast({ title, icon: 'none', duration: 2400 })
      if (!d.form.introducerId) { toast('请先选择介绍人'); return }
      const amount = Number(d.form.amount)
      if (!(amount > 0)) { toast('请填写大于 0 的金额'); return }
      this.setData({ saving: true })
      return api.setShare({
        orderId: this.properties.orderId, introducerId: d.form.introducerId, amount, memo: (d.form.memo || '').trim()
      }).then(r => {
        this.setData({
          saving: false, shares: (r.shares || []).map(decorate),
          form: { introducerId: '', amount: d.suggested > 0 ? String(d.suggested) : '', memo: '' }
        })
        toast('已保存')
      }).catch(err => { this.setData({ saving: false }); api.fail(err) })
    },

    onRemove(e) {
      const id = e.currentTarget.dataset.id
      return new Promise(resolve => {
        wx.showModal({ title: '删除介绍人分账', content: '删除后这一份分账记录作废，其余分账会按新的合计重新判断自动还是手动。', confirmText: '删除',
          success: res => resolve(!!res.confirm) })
      }).then(ok => {
        if (!ok) return null
        return api.removeShare(id).then(r => this.setData({ shares: (r.shares || []).map(decorate) }))
      }).catch(err => api.fail(err))
    }
  }
})

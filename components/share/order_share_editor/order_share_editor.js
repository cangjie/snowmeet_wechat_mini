// 订单详情页里的「介绍人分账」：店长以上（title_level ≥ 200）可以看、设置、删除。
// 规则由服务端判断：什么时候能设置（canEdit / reason）、自动还是手动（每条的 state）、金额预填（suggested）。
// 卡片默认折叠，标题右边的摘要说明已经设了几条、合计多少；一单可以给不同的介绍人各设一条。
const api = require('../../../utils/introducer_api.js')

const MANAGER_LEVEL = 200
const ADMIN_LEVEL = 300
// 已经提交的（已分账、被拒绝）不能再删
const REMOVABLE = ['待自动分账', '手动处理']
const STATE_CLASS = { '待自动分账': 'blue', '手动处理': 'warn', '已分账': 'ok', '被拒绝': 'danger' }
const ADD_INTRODUCER_PAGE = '/pages/introducer/admin/add/add'

function decorate(s) {
  return Object.assign({}, s, { stateClass: STATE_CLASS[s.state] || 'muted', removable: REMOVABLE.indexOf(s.state) >= 0 })
}

// 本地日期 yyyy-MM-dd，和后端、date-range-picker 一致，可以直接按字符串比大小
function today() {
  const d = new Date()
  const pad = n => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
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
    hidden: true, loading: false, expanded: false, canEdit: false, canAddIntroducer: false, reason: '', suggested: 0,
    // 预计分账日期只在后端支持时才显示（后端给了 suggestedPlanDate 才算支持；旧后端没有这个字段）
    supportsPlanDate: false, suggestedPlanDate: '',
    shares: [], summary: '未设置', choices: [],
    form: { introducerId: '', introducerLabel: '', amount: '', planDate: '', memo: '' }, saving: false
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
        this.setData(Object.assign({
          loading: false, canEdit: !!d.canEdit, canAddIntroducer: staff.title_level >= ADMIN_LEVEL,
          reason: d.reason || '', suggested: d.suggested || 0,
          supportsPlanDate: !!d.suggestedPlanDate, suggestedPlanDate: d.suggestedPlanDate || '',
          'form.amount': d.suggested > 0 ? String(d.suggested) : '', 'form.planDate': d.suggestedPlanDate || ''
        }, sharesPatch(d.shares)))
        if (!d.canEdit) return null
        return api.listChoices().then(c => this.setData({
          choices: (c.choices || []).map(v => Object.assign({}, v, { label: v.name + ' · ' + v.type }))
        }))
      }).catch(err => {
        this.setData({ loading: false })
        // 网络不通或接口不存在（新版小程序先于后端上线）：这张卡片只是附加功能，静默隐藏，别在每个订单详情页都弹提示
        if (err && err.code === -1) { this.setData({ hidden: true }); return }
        api.fail(err)
      })
    },

    onToggle() { this.setData({ expanded: !this.data.expanded }) },

    // picker 的 detail.value 是选项下标，不同基础库给数字或数字字符串
    onPick(e) {
      const choice = this.data.choices[Number(e.detail.value)]
      if (!choice) return
      this.setData({ 'form.introducerId': choice.id, 'form.introducerLabel': choice.label })
    },
    onAmount(e) { this.setData({ 'form.amount': e.detail.value }) },
    onPlanDate(e) { this.setData({ 'form.planDate': e.detail.date || '' }) },
    onMemo(e) { this.setData({ 'form.memo': e.detail.value }) },
    onGoAddIntroducer() { wx.navigateTo({ url: ADD_INTRODUCER_PAGE }) },

    onSave() {
      const d = this.data
      if (d.saving) return
      const toast = title => wx.showToast({ title, icon: 'none', duration: 2400 })
      if (!d.form.introducerId) { toast('请先选择介绍人'); return }
      const amount = Number(d.form.amount)
      if (!(amount > 0)) { toast('请填写大于 0 的金额'); return }
      if (d.supportsPlanDate) {
        if (!d.form.planDate) { toast('请选择预计分账日期'); return }
        if (d.form.planDate < today()) { toast('预计分账日期不能早于今天'); return }
      }
      const body = { orderId: this.properties.orderId, introducerId: d.form.introducerId, amount, memo: (d.form.memo || '').trim() }
      if (d.supportsPlanDate) body.planDate = d.form.planDate
      this.setData({ saving: true })
      return api.setShare(body).then(r => {
        this.setData(Object.assign({
          saving: false,
          form: { introducerId: '', introducerLabel: '', amount: d.suggested > 0 ? String(d.suggested) : '', planDate: d.suggestedPlanDate, memo: '' }
        }, sharesPatch(r.shares)))
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
        return api.removeShare(id).then(r => this.setData(sharesPatch(r.shares)))
      }).catch(err => api.fail(err))
    }
  }
})

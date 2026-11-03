// 添加分账记录（店长以上）：从订单详情页的「介绍人分账」卡片进入，带 orderId。
// 分账请求 = 收款人（从介绍人里选：按 教练 / KOL / 机构 筛选，也能用关键词、手机号搜）+ 金额 + 预计分账日期 + 是否自动分账 + 备注。
// 规则都在服务端：能不能设置（canEdit / reason）、金额预填（suggested）、最早能分的日期（suggestedPlanDate）、
// 自动还是手动最终由系统判断；预计分账日期、自动分账开关只在后端支持时才显示和发送（旧后端没有那两个字段）。
const api = require('../../../../utils/introducer_api.js')

const MANAGER_LEVEL = 200
const ALL = '全部'
const SEARCH_DELAY = 350

// 本地日期 yyyy-MM-dd，和后端、date-range-picker 一致，可以直接按字符串比大小
function today() {
  const d = new Date()
  const pad = n => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

Page({
  data: {
    blocked: '', loading: true, orderId: 0, canEdit: false, reason: '',
    suggested: 0, suggestedPlanDate: '', supportsPlanDate: false, supportsAutoShare: false,
    types: [ALL, '教练', 'KOL', '机构'], type: '', keyword: '', choices: [], pickedId: '', pickedLabel: '',
    form: { amount: '', planDate: '', autoShare: true, memo: '' }, saving: false
  },

  onLoad(options) {
    const orderId = Number(options && options.orderId) || 0
    this.setData({ orderId })
    return Promise.resolve(getApp().loginPromiseNew).then(() => {
      const staff = getApp().globalData.staff
      if (!(staff && staff.valid === 1 && staff.title_level >= MANAGER_LEVEL)) {
        this.setData({ blocked: '只有店长以上可以设置介绍人分账', loading: false })
        return null
      }
      return this.loadOrder()
    }).catch(err => { this.setData({ loading: false }); api.fail(err) })
  },

  onUnload() { clearTimeout(this._timer) },

  loadOrder() {
    return api.getOrderShares(this.data.orderId).then(d => {
      this.setData({
        loading: false, canEdit: !!d.canEdit, reason: d.reason || '', suggested: d.suggested || 0,
        suggestedPlanDate: d.suggestedPlanDate || '', supportsPlanDate: !!d.suggestedPlanDate, supportsAutoShare: !!d.autoShareSupported,
        'form.amount': d.suggested > 0 ? String(d.suggested) : '', 'form.planDate': d.suggestedPlanDate || ''
      })
      return d.canEdit ? this.loadChoices() : null
    })
  },

  // 候选：类型 + 关键词都交给后端；连续点几次时只认最后一次的结果
  loadChoices() {
    const seq = this._seq = (this._seq || 0) + 1
    return api.listChoices(this.data.type, (this.data.keyword || '').trim()).then(c => {
      if (seq !== this._seq) return
      this.setData({ choices: (c.choices || []).map(v => Object.assign({}, v, { tail: v.cellTail ? '尾号 ' + v.cellTail : '' })) })
    }).catch(err => { if (seq === this._seq) api.fail(err) })
  },

  onType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ type: type === ALL ? '' : type })
    return this.loadChoices()
  },

  // 边打边搜，停一下再请求；点键盘上的「搜索」立即搜
  onKeyword(e) {
    this.setData({ keyword: e.detail.value })
    clearTimeout(this._timer)
    this._timer = setTimeout(() => this.loadChoices(), SEARCH_DELAY)
  },
  onSearch() {
    clearTimeout(this._timer)
    return this.loadChoices()
  },

  // 换了筛选条件、已选的收款人仍然保留（列表里暂时看不到也没关系）
  onPick(e) {
    const id = e.currentTarget.dataset.id
    const choice = this.data.choices.find(c => c.id === id)
    if (!choice) return
    this.setData({ pickedId: choice.id, pickedLabel: choice.name + ' · ' + choice.type })
  },

  onAmount(e) { this.setData({ 'form.amount': e.detail.value }) },
  onPlanDate(e) { this.setData({ 'form.planDate': e.detail.date || '' }) },
  onAutoShare(e) { this.setData({ 'form.autoShare': !!e.detail.value }) },
  onMemo(e) { this.setData({ 'form.memo': e.detail.value }) },

  onSave() {
    const d = this.data
    if (d.saving) return
    const toast = title => wx.showToast({ title, icon: 'none', duration: 2400 })
    if (!d.pickedId) { toast('请先选择收款人'); return }
    const amount = Number(d.form.amount)
    if (!(amount > 0)) { toast('请填写大于 0 的金额'); return }
    if (d.supportsPlanDate) {
      if (!d.form.planDate) { toast('请选择预计分账日期'); return }
      if (d.form.planDate < today()) { toast('预计分账日期不能早于今天'); return }
    }
    const body = { orderId: d.orderId, introducerId: d.pickedId, amount, memo: (d.form.memo || '').trim() }
    if (d.supportsPlanDate) body.planDate = d.form.planDate
    if (d.supportsAutoShare) body.autoShare = !!d.form.autoShare
    this.setData({ saving: true })
    return api.setShare(body).then(() => {
      this.setData({ saving: false })
      toast('已保存')
      wx.navigateBack()
    }).catch(err => { this.setData({ saving: false }); api.fail(err) })
  }
})

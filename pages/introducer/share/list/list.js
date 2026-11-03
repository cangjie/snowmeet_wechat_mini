// 分账列表（店长以上）：跨订单列出所有分账；勾选「未分 + 手动」的条目，弹窗确认后按批次一次记成已分（只记账，不转钱）。
// 规则都在服务端（api/ShareList）：哪些条目可勾选（selectable）、自动/手动、状态、默认批次号。
// 设计：snowmeet_ai_doc/docs/superpowers/specs/2026-11-03-share-list-manual-batch-design.md
const api = require('../../../../utils/introducer_api.js')
const shareList = require('../../../../utils/share_list.js')

const MANAGER_LEVEL = 200
const PAGE_SIZE = 20
const SEARCH_DELAY = 350

// 本地日期 yyyy-MM-dd，和后端、date-range-picker 一致
function today() {
  const d = new Date()
  const pad = n => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

const EMPTY_MODAL = { show: false, count: 0, total: 0, oldCount: 0, batchNo: '' }

Page({
  data: {
    blocked: '', loading: false, submitting: false,
    statusOptions: [{ label: '未分', value: '未分' }, { label: '已分', value: '已分' }, { label: '全部', value: '' }],
    typeOptions: [{ label: '全部', value: '' }, { label: '租赁', value: '租赁' }, { label: '养护', value: '养护' }, { label: '零售', value: '零售' }, { label: '雪票', value: '雪票' }],
    modeOptions: [{ label: '全部', value: '' }, { label: '自动', value: '自动' }, { label: '手动', value: '手动' }],
    rangeOptions: [{ label: '近 30 天', value: '30' }, { label: '全部时间', value: 'all' }],
    status: '未分', type: '', mode: '', keyword: '', rangeKey: '30', startDate: '', endDate: '',
    items: [], total: 0, totalAmount: 0, selectableCount: 0, pageIndex: 0, hasMore: false,
    selected: {}, selectedCount: 0, selectedTotal: 0, modal: EMPTY_MODAL
  },

  onLoad() {
    return Promise.resolve(getApp().loginPromiseNew).then(() => {
      const staff = getApp().globalData.staff
      if (!(staff && staff.valid === 1 && staff.title_level >= MANAGER_LEVEL)) {
        this.setData({ blocked: '只有店长以上可以查看和处理分账' })
        return null
      }
      this.setData(shareList.defaultRange(today()))
      return this.load(true)
    }).catch(err => api.fail(err))
  },

  onUnload() { clearTimeout(this._timer) },

  // reset = 从第 1 页重来（筛选变了、记完账）；否则加载下一页追加
  load(reset) {
    const d = this.data
    const pageIndex = reset ? 1 : d.pageIndex + 1
    const seq = this._seq = (this._seq || 0) + 1
    this.setData({ loading: true })
    return api.listShares({
      status: d.status, type: d.type, mode: d.mode, keyword: (d.keyword || '').trim(),
      startDate: d.rangeKey === 'all' ? '' : d.startDate, endDate: d.rangeKey === 'all' ? '' : d.endDate, pageIndex, pageSize: PAGE_SIZE
    }).then(r => {
      if (seq !== this._seq) return                                   // 连着点几次，只认最后一次的结果
      const items = reset ? r.items : d.items.concat(r.items)
      this.setData({ items: this.decorate(items, this.data.selected), total: r.total, totalAmount: r.totalAmount, selectableCount: r.selectableCount,
        pageIndex, hasMore: items.length < r.total, loading: false })
    }).catch(err => { if (seq === this._seq) { this.setData({ loading: false }); api.fail(err) } })
  },

  decorate(items, selected) {
    return items.map(i => Object.assign({}, i, { checked: !!selected[i.orderShareId] }))
  },

  // ---- 筛选：每次从第 1 页重来，勾选清空 ----
  reload() {
    this.clearSelection()
    return this.load(true)
  },
  onStatus(e) { this.setData({ status: e.currentTarget.dataset.value }); return this.reload() },
  onType(e) { this.setData({ type: e.currentTarget.dataset.value }); return this.reload() },
  onMode(e) { this.setData({ mode: e.currentTarget.dataset.value }); return this.reload() },
  onRange(e) {
    const key = e.currentTarget.dataset.value
    this.setData(Object.assign({ rangeKey: key }, key === 'all' ? { startDate: '', endDate: '' } : shareList.defaultRange(today())))
    return this.reload()
  },
  onRangeChange(e) {
    this.setData({ rangeKey: 'custom', startDate: e.detail.startDate, endDate: e.detail.endDate })
    return this.reload()
  },
  // 边打边搜，停一下再请求；点键盘上的「搜索」立即搜
  onKeyword(e) {
    this.setData({ keyword: e.detail.value })
    clearTimeout(this._timer)
    this._timer = setTimeout(() => this.onSearch(), SEARCH_DELAY)
  },
  onSearch() {
    clearTimeout(this._timer)
    return this.reload()
  },
  onReachBottom() {
    if (this.data.loading || !this.data.hasMore) return Promise.resolve()
    return this.load(false)
  },

  // ---- 勾选 ----
  clearSelection() { this.setData({ selected: {}, selectedCount: 0, selectedTotal: 0, items: this.decorate(this.data.items, {}) }) },
  applySelection(selected) {
    const picked = this.data.items.filter(i => selected[i.orderShareId])
    this.setData({ selected, selectedCount: picked.length, selectedTotal: shareList.summarize(picked, today()).total, items: this.decorate(this.data.items, selected) })
  },
  onToggle(e) {
    const id = Number(e.currentTarget.dataset.id)
    const item = this.data.items.find(i => i.orderShareId === id)
    if (!item || !item.selectable) return
    const selected = Object.assign({}, this.data.selected)
    if (selected[id]) delete selected[id]
    else selected[id] = true
    this.applySelection(selected)
  },
  // 已加载的可勾选项全勾上；已经全勾了就取消
  onSelectAll() {
    const selectable = this.data.items.filter(i => i.selectable)
    const allOn = selectable.length > 0 && selectable.every(i => this.data.selected[i.orderShareId])
    const selected = {}
    if (!allOn) selectable.forEach(i => { selected[i.orderShareId] = true })
    this.applySelection(selected)
  },

  onItem(e) {
    const id = Number(e.currentTarget.dataset.id)
    const item = this.data.items.find(i => i.orderShareId === id)
    if (!item) return
    const url = shareList.detailUrl(item)
    if (url) { wx.navigateTo({ url }); return }
    wx.showToast({ title: item.orderType === '雪票' ? '没有找到对应的雪票' : '这类订单暂时没有详情页', icon: 'none', duration: 2400 })
  },

  // ---- 手动分账弹窗 ----
  pickedItems() { return this.data.items.filter(i => this.data.selected[i.orderShareId]) },
  onOpenModal() {
    const picked = this.pickedItems()
    if (!picked.length) { wx.showToast({ title: '请先勾选要分账的条目', icon: 'none', duration: 2400 }); return Promise.resolve() }
    return api.nextBatchNo().then(r => {
      this.setData({ modal: Object.assign({ show: true, batchNo: r.batchNo }, shareList.summarize(picked, today())) })
    }).catch(err => api.fail(err))
  },
  onBatchNo(e) { this.setData({ 'modal.batchNo': e.detail.value }) },
  onCancelModal() { this.setData({ 'modal.show': false }) },
  onConfirm() {
    if (this.data.submitting) return Promise.resolve()
    const batchNo = (this.data.modal.batchNo || '').trim()
    if (!batchNo) { wx.showToast({ title: '请填写批次号', icon: 'none', duration: 2400 }); return Promise.resolve() }
    const ids = this.pickedItems().map(i => i.orderShareId)
    this.setData({ submitting: true })
    return api.completeManual({ orderShareIds: ids, batchNo }).then(r => {
      this.setData({ submitting: false, modal: EMPTY_MODAL })
      wx.showToast({ title: '已记账 ' + r.count + ' 笔，批次 ' + r.batchNo, icon: 'none', duration: 2800 })
      return this.reload()
    }).catch(err => { this.setData({ submitting: false }); api.fail(err) })     // 批次号重复等：弹窗保持打开，让用户改
  }
})

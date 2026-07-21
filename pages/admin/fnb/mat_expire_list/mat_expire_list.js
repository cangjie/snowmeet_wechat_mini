// 食材过期提醒 · 列表页。对标网页版 wwwroot/fnb/mat_expire/index.html + mat.js。
// WXML 不能调函数，状态/徽章文案/短日期等派生字段都在这里算好再 setData（仿 care_order_detail.js 的 _renderCare 写法）。
const app = getApp()
const data = require('../../../../utils/data.js')
const matExpire = require('../../../../utils/matExpire.js')

const STATUSES = ['全部', '已过期', '今日', '临期', '正常', '已处理']
const BADGE_CLS = { '已过期': 'expired', '今日': 'today', '临期': 'warning', '正常': 'normal', '已处理': 'done' }

Page({
  data: {
    loading: true,
    today: '',
    kw: '',
    filter: '全部',
    chips: [],
    rows: [],
    sheet: { show: false, batch: null },
    printShow: false,
    printBatch: null,
  },

  async onLoad() {
    this._batches = []
    this._loadedOnce = false
    await app.loginPromiseNew
    this.load()
  },

  onShow() {
    // 从详情页 navigateBack 回来要刷新（新建/编辑/处置都发生在详情页）；首次进入由 onLoad 触发，这里跳过避免重复查询
    if (this._loadedOnce) {
      this.load()
    }
  },

  load() {
    var that = this
    this.setData({ loading: true })
    data.getMatExpireBatchesPromise(app.globalData.sessionKey).then(function (res) {
      that._loadedOnce = true
      that._batches = (res && res.batches) || []
      that.setData({ today: (res && res.today) || '', loading: false })
      that._render()
    }).catch(function () {
      that.setData({ loading: false })
    })
  },

  _render() {
    var today = this.data.today
    var kw = (this.data.kw || '').trim().toLowerCase()
    var filter = this.data.filter
    var batches = this._batches || []

    // 各状态计数基于全量未过滤列表，与当前筛选/搜索无关
    var counts = { '全部': batches.length }
    STATUSES.slice(1).forEach(function (s) { counts[s] = 0 })
    batches.forEach(function (b) { counts[matExpire.deriveStatus(b, today)]++ })
    var chips = STATUSES.map(function (s) {
      return { status: s, label: s, count: counts[s], on: filter === s }
    })

    var rows = batches.filter(function (b) {
      if (filter !== '全部' && matExpire.deriveStatus(b, today) !== filter) return false
      if (kw && (b.name || '').toLowerCase().indexOf(kw) < 0 && (b.batch_no || '').toLowerCase().indexOf(kw) < 0) return false
      return true
    })
    // 默认按到期升序（后端已排）；「已处理」下按处置时间倒序
    if (filter === '已处理') {
      rows = rows.slice().sort(function (a, b) { return (b.dispose_date || '') > (a.dispose_date || '') ? 1 : -1 })
    }

    rows = rows.map(function (b) {
      var st = matExpire.deriveStatus(b, today)
      var e = (b.expire_date || '').slice(0, 10)
      var badgeText
      if (st === '已处理') {
        badgeText = b.dispose_status === '报废' ? '已报废' : '已用完'
      } else if (st === '已过期') {
        badgeText = '逾期 ' + matExpire.daysBetween(e, today) + ' 天'
      } else if (st === '今日') {
        badgeText = '今日到期'
      } else {
        badgeText = '剩 ' + matExpire.daysBetween(today, e) + ' 天'
      }
      return {
        id: b.id,
        name: b.name,
        batch_no: b.batch_no,
        dateShort: e ? e.slice(5).replace('-', '/') : '',
        _badgeCls: BADGE_CLS[st] || '',
        _badgeText: badgeText,
        _disposed: st === '已处理',
      }
    })

    this.setData({ chips: chips, rows: rows })
  },

  onKwInput(e) {
    this.setData({ kw: e.detail.value })
    this._render()
  },

  onChipTap(e) {
    this.setData({ filter: e.currentTarget.dataset.status })
    this._render()
  },

  onCardTap(e) {
    wx.navigateTo({ url: '/pages/admin/fnb/mat_expire_detail/mat_expire_detail?id=' + e.currentTarget.dataset.id })
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/admin/fnb/mat_expire_detail/mat_expire_detail' })
  },

  onMoreTap(e) {
    var id = e.currentTarget.dataset.id
    var batch = (this._batches || []).find(function (b) { return b.id === id })
    if (!batch) return
    this.setData({ sheet: { show: true, batch: batch } })
  },

  onSheetClose() {
    this.setData({ 'sheet.show': false })
  },

  onSheetDispose(e) {
    var that = this
    var action = e.currentTarget.dataset.action
    var batch = this.data.sheet.batch
    if (!batch) return
    this.setData({ 'sheet.show': false })
    data.disposeMatExpireBatchPromise(batch.id, action, app.globalData.sessionKey).then(function () {
      wx.showToast({ title: '已标记' + action, icon: 'none' })
      that.load()
    }).catch(function () {})
  },

  onSheetEdit() {
    var batch = this.data.sheet.batch
    if (!batch) return
    this.setData({ 'sheet.show': false })
    wx.navigateTo({ url: '/pages/admin/fnb/mat_expire_detail/mat_expire_detail?id=' + batch.id })
  },

  onSheetPrint() {
    var batch = this.data.sheet.batch
    if (!batch) return
    this.setData({ 'sheet.show': false, printShow: true, printBatch: batch })
  },

  onPrinterClose() {
    this.setData({ printShow: false })
  },

  onSheetDelete() {
    var that = this
    var batch = this.data.sheet.batch
    if (!batch) return
    this.setData({ 'sheet.show': false })
    wx.showModal({
      title: '删除批次',
      content: '删除「' + batch.name + '」？删除后列表不再显示。',
      confirmColor: '#ba1a1a',
      success: function (res) {
        if (!res.confirm) return
        data.deleteMatExpireBatchPromise(batch.id, app.globalData.sessionKey).then(function () {
          wx.showToast({ title: '已删除', icon: 'none' })
          that.load()
        }).catch(function () {})
      },
    })
  },
})

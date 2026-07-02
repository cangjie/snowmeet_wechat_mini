// 会员标签库维护 — 只管 member_tag_preset：列出库标签 + 会员用量，合并 / 删除(仅0用量) / 新增
const app = getApp()
const data = require('../../../utils/data.js')

Page({
  data: {
    tags: [],          // [{tag, group, count}]
    loading: true,
    // 新增
    addShow: false,
    addInput: '',
    // 合并
    mergeShow: false,
    mergeFrom: '',
    mergeTargets: []   // 除 from 外的库标签
  },

  onShow() { this.loadTags() },

  loadTags() {
    var that = this
    that.setData({ loading: true })
    data.getTagLibraryStatsPromise(app.globalData.sessionKey).then(function (r) {
      that.setData({ tags: (r && r.tags) || [], loading: false })
    }).catch(function () {
      that.setData({ tags: [], loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  // ── 新增 ──
  onAddOpen() { this.setData({ addShow: true, addInput: '' }) },
  onAddClose() { this.setData({ addShow: false }) },
  onAddInput(e) { this.setData({ addInput: e.detail.value }) },
  onAddConfirm() {
    var that = this
    var v = (that.data.addInput || '').trim()
    if (!v) { wx.showToast({ title: '请输入标签', icon: 'none' }); return }
    wx.showLoading({ title: '添加中', mask: true })
    data.addTagPresetPromise(v, '', app.globalData.sessionKey).then(function () {
      wx.hideLoading(); that.setData({ addShow: false }); that.loadTags()
    }).catch(function () { wx.hideLoading(); wx.showToast({ title: '添加失败', icon: 'none' }) })
  },

  // ── 合并 ──
  onMergeOpen(e) {
    var from = e.currentTarget.dataset.tag
    var targets = this.data.tags.filter(function (t) { return t.tag !== from })
    this.setData({ mergeShow: true, mergeFrom: from, mergeTargets: targets })
  },
  onMergeClose() { this.setData({ mergeShow: false }) },
  onMergePick(e) {
    var that = this
    var to = e.currentTarget.dataset.tag
    var from = that.data.mergeFrom
    wx.showModal({
      title: '确认合并',
      content: '把「' + from + '」合并到「' + to + '」：所有打了「' + from + '」的会员改成「' + to + '」，「' + from + '」从标签库移除。',
      complete: function (res) {
        if (!res.confirm) return
        wx.showLoading({ title: '合并中', mask: true })
        data.mergeTagPresetPromise(from, to, app.globalData.sessionKey).then(function () {
          wx.hideLoading(); wx.showToast({ title: '合并成功', icon: 'success' })
          that.setData({ mergeShow: false }); that.loadTags()
        }).catch(function () { wx.hideLoading(); wx.showToast({ title: '合并失败', icon: 'none' }) })
      }
    })
  },

  // ── 删除（仅 0 用量）──
  onDelete(e) {
    var that = this
    var tag = e.currentTarget.dataset.tag
    var count = e.currentTarget.dataset.count
    if (count > 0) {
      wx.showToast({ title: '已被 ' + count + ' 个会员使用，请先合并', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认删除', content: '从标签库删除「' + tag + '」？',
      complete: function (res) {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中', mask: true })
        data.deleteTagPresetPromise(tag, app.globalData.sessionKey).then(function (r) {
          wx.hideLoading()
          // 后端在用量>0 时返回 code=1 + message（performWebRequest 已 resolve data；这里兜底再查）
          wx.showToast({ title: '已删除', icon: 'success' }); that.loadTags()
        }).catch(function () { wx.hideLoading(); wx.showToast({ title: '删除失败', icon: 'none' }) })
      }
    })
  },

  noop() {}
})

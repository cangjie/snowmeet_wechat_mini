// pages/admin/ticket/template_admin/template_admin.js
// 优惠券模板维护 —— 列表（管理后台 staff≥200）
//
// 门槛比「优惠券管理」（100，只是看券）高一档：这里改的是发放规则和定价规则——
// 业务类型决定这类券在开单时选不选得到，可用天数决定券多久过期，
// 商品优惠规则直接进养护服务费的算式。
//
// 模板一共只有十几个，一次全捞不分页。前端按 hide 分成「当前 / 失效」两个 tab：
// hide = 1 就是失效模板（停用但要留着，历史券还挂在它名下）。
// 顶部的待办统计只算当前模板——失效模板的冲突和缺业务类型都不需要再去修，
// 混进来只会让人以为有一堆活要干。
var app = getApp()
var data = require('../../../../utils/data.js')

Page({
  data: {
    view: 'active',            // 'active' 当前模板(hide=0) | 'hidden' 失效模板(hide=1)
    viewOptions: [
      { key: 'active', name: '当前模板' },
      { key: 'hidden', name: '失效模板' }
    ],
    allItems: [],
    items: [],
    activeCount: 0,
    hiddenCount: 0,
    conflictCount: 0,
    missingBizCount: 0,
    loading: false
  },

  onShow() {
    var that = this
    app.loginPromiseNew.then(function () {
      var staff = app.globalData.staff
      if (!staff || staff.title_level < 200) {
        wx.showToast({ title: '没有权限', icon: 'none' })
        wx.navigateBack()
        return
      }
      // 从编辑页返回时重查，改完的模板立刻反映在列表上
      that.getData()
    })
  },

  getData() {
    var that = this
    that.setData({ loading: true })
    data.getTicketTemplateListPromise(app.globalData.sessionKey).then(function (res) {
      var all = (res && res.items) || []
      var active = all.filter(function (x) { return x.hide != 1 })
      that.setData({
        allItems: all,
        activeCount: active.length,
        hiddenCount: all.length - active.length,
        // 统计口径固定为当前模板，与正在看哪个 tab 无关
        conflictCount: active.filter(function (x) { return x.hasConflict }).length,
        missingBizCount: active.filter(function (x) { return x.bizTypeMissing }).length,
        loading: false
      })
      that._applyView()
    }).catch(function () {
      that.setData({ loading: false })
    })
  },

  _applyView() {
    var hidden = this.data.view === 'hidden'
    this.setData({
      items: this.data.allItems.filter(function (x) {
        return hidden ? x.hide == 1 : x.hide != 1
      })
    })
  },

  onViewTap(e) {
    var key = e.currentTarget.dataset.key
    if (key === this.data.view) { return }
    this.setData({ view: key })
    this._applyView()
  },

  onTemplateTap(e) {
    wx.navigateTo({
      url: '/pages/admin/ticket/template_edit/template_edit?id=' + e.currentTarget.dataset.id
    })
  },

  onAddTap() {
    wx.navigateTo({ url: '/pages/admin/ticket/template_edit/template_edit?id=0' })
  }
})

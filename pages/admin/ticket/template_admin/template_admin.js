// pages/admin/ticket/template_admin/template_admin.js
// 优惠券模板维护 —— 列表（管理后台 staff≥200）
//
// 门槛比「优惠券管理」（100，只是看券）高一档：这里改的是发放规则和定价规则——
// 业务类型决定这类券在开单时选不选得到，可用天数决定券多久过期，
// 商品优惠规则直接进养护服务费的算式。
//
// 模板一共只有十几个，不分页、不筛选，一次全捞。隐藏的排在后面。
var app = getApp()
var data = require('../../../../utils/data.js')

Page({
  data: {
    items: [],
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
      var items = (res && res.items) || []
      that.setData({
        items: items,
        conflictCount: items.filter(function (x) { return x.hasConflict }).length,
        missingBizCount: items.filter(function (x) { return x.bizTypeMissing }).length,
        loading: false
      })
    }).catch(function () {
      that.setData({ loading: false })
    })
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

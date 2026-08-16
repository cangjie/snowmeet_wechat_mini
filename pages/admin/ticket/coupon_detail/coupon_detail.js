// pages/admin/ticket/coupon_detail/coupon_detail.js
// 优惠券详情（管理后台 staff≥100）：券本身的信息 + 全量操作流水。
//
// 流水把 ticket_log 每一条都列出来（转赠成功 / 核销 / 撤回分享 / 发放 / 其它），
// 不像列表上的「转赠次数」那样只数真转赠——排查一张券时，核销和撤回同样是关键线索。
var app = getApp()
var data = require('../../../../utils/data.js')

Page({
  data: {
    code: '',
    ticket: null,
    logs: [],
    usageList: [],
    loading: true
  },

  onLoad(options) {
    this.setData({ code: (options.code || '').trim() })
  },

  onShow() {
    var that = this
    app.loginPromiseNew.then(function () {
      var staff = app.globalData.staff
      if (!staff || staff.title_level < 100) {
        wx.showToast({ title: '没有权限', icon: 'none' })
        wx.navigateBack()
        return
      }
      that.getData()
    })
  },

  getData() {
    var that = this
    if (!that.data.code) {
      that.setData({ loading: false })
      return
    }
    data.getTicketDetailByStaffPromise(that.data.code, app.globalData.sessionKey).then(function (res) {
      res = res || {}
      // WXML 表达式不支持方法调用，展示文案一律在这里派生好
      var t = Object.assign({}, res, {
        customerText: res.memberId
          ? ((res.memberName || '（未填姓名）') + (res.memberGender ? '·' + res.memberGender : ''))
          : '（无会员归属）',
        showInvalid: res.valid !== 1,
        showInactive: res.isActive !== 1,
        valueText: String(res.currencyValue == null ? 0 : res.currencyValue),
        transferText: res.transferCount > 0 ? (res.transferCount + ' 次') : '未转赠过'
      })
      var logs = (res.logs || []).map(function (l) {
        // 「发起人 → 接受人」，任一侧为空时用 — 占位（撤回分享没有接受人、核销没有发起人）
        return Object.assign({}, l, {
          flowText: (l.fromName || '—') + ' → ' + (l.toName || '—')
        })
      })
      that.setData({
        ticket: t,
        logs: logs,
        usageList: (res.usageMemo || '').split(';').filter(function (s) { return (s || '').trim() !== '' }),
        loading: false
      })
    }).catch(function () {
      that.setData({ loading: false })
    })
  },

  onMemberTap() {
    var t = this.data.ticket
    if (!t || !t.memberId) { return }
    wx.navigateTo({ url: '/pages/admin/member/member_detail?id=' + t.memberId })
  },

  onCopyCode() {
    var t = this.data.ticket
    if (!t) { return }
    wx.setClipboardData({ data: t.code })
  }
})

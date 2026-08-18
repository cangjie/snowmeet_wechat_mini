// pages/admin/ticket/coupon_admin/coupon_admin.js
// 优惠券管理（管理后台 staff≥100）。
//
// 两种视图共用同一套筛选条件，切视图时回第 1 页（两边分页单位不同：一个是券、一个是会员）。
// 默认范围 = 未过期 ∪ 已核销，废券（已过期且从没核销）默认藏起来——生产库里有 9000+ 张，
// 不藏没法看；顶部给开关能放出来。
//
// 与顾客侧「我的优惠券」的口径差异：这里**不过滤 valid / is_active**，
// 因为这是审计视图，要能看到顾客端看不到的券。对应的行上会打「无效」「未激活」徽标。
var app = getApp()
var util = require('../../../../utils/util.js')
var data = require('../../../../utils/data.js')

var PAGE_SIZE = 20

// 本雪季起始日：5 月及以后算下一个雪季周期，与财年 5-01~4-30 同口径。
// 默认不给「今天」——优惠券管理是盘存性质，默认今天会一片空白。
function seasonStart(now) {
  var y = now.getMonth() + 1 >= 5 ? now.getFullYear() : now.getFullYear() - 1
  return y + '-05-01'
}

Page({
  data: {
    view: 'ticket',            // 'ticket' 按券明细 | 'member' 按会员汇总
    viewOptions: [
      { key: 'ticket', name: '按券明细' },
      { key: 'member', name: '按会员汇总' }
    ],

    // ── 筛选（两视图共用，切视图不重置）
    startDate: '',
    endDate: '',
    templateId: null,
    templateIndex: 0,
    templateOptions: [],       // [{id,name}]，第 0 项是「全部模板」
    templateNames: [],         // picker 用的纯文案数组
    usedKey: '',               // '' 全部 | '1' 已核销 | '0' 未核销
    usedOptions: [
      { key: '', name: '全部' }, { key: '1', name: '已核销' }, { key: '0', name: '未核销' }
    ],
    transferKey: '',           // '' 全部 | '1' 转赠过 | '0' 没转赠过
    transferOptions: [
      { key: '', name: '全部' }, { key: '1', name: '转赠过' }, { key: '0', name: '没转赠过' }
    ],
    includeWasted: false,

    // ── 分页
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1,
    total: 0,

    // ── 结果
    ticketItems: [],
    memberItems: [],
    ticketTotal: 0,            // 汇总视图下的券总数
    wastedTotal: 0,
    invalidCount: 0,
    loading: false
  },

  onLoad() {
    var now = new Date()
    this.setData({ startDate: seasonStart(now), endDate: util.formatDate(now) })
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
      if (!that.data.templateOptions.length) {
        that.loadTemplates()
      }
      // 从会员详情返回时保留当前页码/筛选重查（列表页实例没销毁，this.data 就是记录）
      that.getData(that.data.page, that.data.pageSize)
    })
  },

  loadTemplates() {
    var that = this
    data.getTicketTemplateOptionsPromise(app.globalData.sessionKey).then(function (res) {
      var list = [{ id: null, name: '全部模板' }].concat((res && res.templates) || [])
      that.setData({
        templateOptions: list,
        templateNames: list.map(function (t) { return t.name })
      })
    }).catch(function () {})
  },

  _filter() {
    return {
      startDate: this.data.startDate,
      endDate: this.data.endDate,
      templateId: this.data.templateId,
      used: this.data.usedKey === '' ? null : this.data.usedKey === '1',
      transferred: this.data.transferKey === '' ? null : this.data.transferKey === '1',
      includeWasted: this.data.includeWasted
    }
  },

  getData(page, pageSize) {
    var that = this
    that.setData({ loading: true })
    var isTicket = that.data.view === 'ticket'
    var fn = isTicket ? data.searchTicketsByStaffPromise : data.searchTicketMembersByStaffPromise
    fn(that._filter(), page, pageSize, app.globalData.sessionKey).then(function (res) {
      res = res || {}
      var total = res.total || 0
      var patch = {
        total: total,
        page: page,
        pageSize: pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        loading: false
      }
      if (isTicket) {
        // WXML 表达式不支持方法调用，展示文案一律在这里派生好
        patch.ticketItems = (res.items || []).map(function (it) {
          return Object.assign({}, it, {
            customerText: it.memberId
              ? ((it.memberName || '（未填姓名）') + (it.memberGender ? '·' + it.memberGender : ''))
              : '（无会员归属）',
            transferText: it.transferCount > 0
              ? ('转赠 ' + it.transferCount + ' 次'
                 + (it.lastTransferTimeStr ? '（最后一次 ' + it.lastTransferTimeStr + '）' : ''))
              : '',
            showInvalid: it.valid !== 1,
            showInactive: it.isActive !== 1,
            // 失效（已核销/已过期）的券种色条降灰
            muted: it.used === 1 || it.stateCls === 'expired'
          })
        })
        patch.wastedTotal = res.wastedTotal || 0
        patch.invalidCount = res.invalidCount || 0
        patch.ticketTotal = total
      } else {
        patch.memberItems = (res.items || []).map(function (it) {
          return Object.assign({}, it, {
            customerText: it.memberId
              ? ((it.memberName || '（未填姓名）') + (it.memberGender ? '·' + it.memberGender : ''))
              : '（无会员归属）',
            avatarText: it.memberId ? ((it.memberName || '?').substr(0, 1)) : '?',
            transferText: it.transferCount > 0 ? ('转赠 ' + it.transferCount + ' 次') : '未转赠'
          })
        })
        patch.ticketTotal = res.ticketTotal || 0
      }
      that.setData(patch)
    }).catch(function () {
      that.setData({ loading: false })
    })
  },

  // 切视图：分页单位不同（券 vs 会员），必须回第 1 页
  onViewTap(e) {
    var key = e.currentTarget.dataset.key
    if (key === this.data.view) { return }
    this.setData({ view: key })
    this.getData(1, this.data.pageSize)
  },

  // 筛选卡片里的四项（日期/模板/核销/转赠）都只暂存，点「查询」才生效。
  // 与养护、租赁订单列表一致——筛选项一多，每改一项就打一次接口既慢又容易误触。
  onDateRangeChange(e) {
    this.setData({ startDate: e.detail.startDate, endDate: e.detail.endDate })
  },

  onQuery() {
    if (this.data.loading) { return }
    this.getData(1, this.data.pageSize)
  },

  onTemplateChange(e) {
    var idx = parseInt(e.detail.value, 10) || 0
    var opt = this.data.templateOptions[idx] || {}
    this.setData({ templateIndex: idx, templateId: opt.id || null })
  },

  onUsedTap(e) {
    var key = e.currentTarget.dataset.key || ''
    if (key === this.data.usedKey) { return }
    this.setData({ usedKey: key })
  },

  onTransferTap(e) {
    var key = e.currentTarget.dataset.key || ''
    if (key === this.data.transferKey) { return }
    this.setData({ transferKey: key })
  },

  onToggleWasted() {
    this.setData({ includeWasted: !this.data.includeWasted })
    this.getData(1, this.data.pageSize)
  },

  onPagerChange(e) {
    var d = e.detail || {}
    this.getData(d.page || 1, d.pageSize || this.data.pageSize)
  },

  // 明细视图点一行 → 券详情（券信息 + 转赠历史）
  onTicketTap(e) {
    var code = e.currentTarget.dataset.code
    if (!code) { return }
    wx.navigateTo({ url: '/pages/admin/ticket/coupon_detail/coupon_detail?code=' + code })
  },

  // 汇总视图点一行 → 会员详情
  onMemberTap(e) {
    var id = e.currentTarget.dataset.id
    if (!id) { return }   // 无会员归属的行不可点
    wx.navigateTo({ url: '/pages/admin/member/member_detail?id=' + id })
  }
})

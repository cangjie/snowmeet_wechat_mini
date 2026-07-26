// pages/admin/rent/punchcard_sales/punchcard_sales.js
// 卡类产品销售列表（管理后台 staff≥200）：倒序列出已卖出/发出的次卡与季卡。
// 每行：卡名 / 适用业务 / 总次数 / 剩余次数 / 顾客姓名+性别 / 顾客电话 / 销售方式。
// 点条目进明细页（复用 pages/mine/punchcard_usage 的店员模式：顾客信息 + 购买时间 + 核销订单列表，
// 季卡另有修改装备品牌/长度的功能）。
var app = getApp()
var data = require('../../../../utils/data.js')

var PAGE_SIZE = 20

Page({
  data: {
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1,
    keyword: '',
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
      // 从明细页返回时保留当前页码/搜索词重查（列表页实例没销毁，this.data 就是记录）
      that.getData(that.data.page, that.data.pageSize)
    })
  },

  getData(page, pageSize) {
    var that = this
    that.setData({ loading: true })
    data.getPunchCardSalesByStaffPromise(that.data.keyword, page, pageSize, app.globalData.sessionKey)
      .then(function (res) {
        res = res || {}
        var items = (res.items || []).map(function (it) {
          return Object.assign({}, it, {
            // WXML 表达式不支持方法调用，展示文案一律在这里派生好
            countText: it.isSeason ? '不限次数' : (it.total + ' 次'),
            remainText: it.isSeason ? '—' : ('剩余 ' + it.remaining + ' 次'),
            customerText: (it.memberName || '（未填姓名）') + (it.memberGender ? '·' + it.memberGender : ''),
            saleTypeCls: it.saleType === '赠送' ? 'st-gift'
              : (it.saleType === '随订单购买' ? 'st-order' : 'st-self')
          })
        })
        var total = res.total || 0
        that.setData({
          items: items,
          total: total,
          page: page,
          pageSize: pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          loading: false
        })
      }).catch(function () {
        that.setData({ loading: false })
      })
  },

  onKeywordInput(e) { this.setData({ keyword: e.detail.value }) },
  onSearch() { this.getData(1, this.data.pageSize) },
  onClearKeyword() {
    this.setData({ keyword: '' })
    this.getData(1, this.data.pageSize)
  },

  onPagerChange(e) {
    var d = e.detail || {}
    this.getData(d.page || 1, d.pageSize || this.data.pageSize)
  },

  onItemTap(e) {
    var cardId = e.currentTarget.dataset.id
    if (!cardId) { return }
    // staff=1 切店员模式：换成按 staff 权限放行的接口，且不显示顾客自助退款入口
    wx.navigateTo({ url: '/pages/mine/punchcard_usage?cardId=' + cardId + '&staff=1' })
  }
})

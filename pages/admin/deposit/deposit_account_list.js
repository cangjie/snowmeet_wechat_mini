// 储值账户管理 — 按手机号搜会员，按会员分组显示名下储值账户（总储值/已消费/可用）
const app = getApp()
const data = require('../../../utils/data.js')
const util = require('../../../utils/util.js')

Page({
  data: {
    cell: '',
    items: [],       // [{ memberId, name, avatar, female, gender, phone, accounts: [{id, typeLabel, incomeStr, consumeStr, availableStr}] }]
    total: 0,
    pageAccounts: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    querying: false
  },

  onShow() {
    // 保参重查（从详情返回保留页码 + 搜索词）
    this.getData(this.data.page, this.data.pageSize)
  },

  onCellInput(e) {
    this.setData({ cell: (e.detail.value || '').replace(/[^0-9]/g, '') })
  },
  onSearch() {
    this.getData(1, this.data.pageSize)
  },

  getData(page, pageSize) {
    var that = this
    if (that.data.querying) return
    that.setData({ querying: true })
    data.searchDepositAccountsByStaffPromise(that.data.cell, page, pageSize, app.globalData.sessionKey).then(function (r) {
      r = r || { items: [], total: 0 }
      var pageAccounts = 0
      var items = (r.items || []).map(function (m) {
        var accounts = (m.accounts || []).map(function (a) {
          pageAccounts++
          return {
            id: a.id,
            typeLabel: (a.type || '储值') + (a.subType ? ' · ' + a.subType : ''),
            incomeStr: util.showAmount(a.income || 0),
            consumeStr: util.showAmount(a.consume || 0),
            availableStr: util.showAmount(a.available || 0)
          }
        })
        return {
          memberId: m.memberId,
          name: m.name || '—',
          avatar: (m.name && m.name.length > 0) ? m.name[0] : '?',
          female: m.gender === '女',
          gender: m.gender,
          phone: m.phone || '',
          accounts: accounts
        }
      })
      var total = r.total || 0
      that.setData({
        items: items,
        total: total,
        pageAccounts: pageAccounts,
        page: page,
        pageSize: pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        querying: false
      })
    }).catch(function () {
      that.setData({ items: [], total: 0, pageAccounts: 0, totalPages: 1, querying: false })
      wx.showToast({ title: '查询失败', icon: 'none' })
    })
  },

  onPagerChange(e) {
    var d = e.detail || {}
    this.getData(d.page || 1, d.pageSize || this.data.pageSize)
  },

  gotoDetail(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/admin/deposit/deposit_account_detail?accountId=' + id })
  },
  gotoMember(e) {
    var id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/admin/member/member_detail?id=' + id })
  }
})

// 会员管理 — 列表 + 搜索（姓名/手机/性别/参与业务/自定义标签）+ 分页
const app = getApp()
const data = require('../../../utils/data.js')
const util = require('../../../utils/util.js')

const SYS_TAGS = ['租赁', '养护', '零售', '雪票', '二手回收', '水吧餐厅']
// 标签选中态用每项的 on 标记（WXML 不支持 arr.indexOf() 表达式，故不能靠数组 indexOf 判高亮）
function mkTagObjs(names) { return names.map(function (n) { return { name: n, on: false } }) }

Page({
  data: {
    filterOpen: false,
    filter: { name: '', cell: '', gender: '全部' },
    sysTags: mkTagObjs(SYS_TAGS),
    presetTags: [],
    activeCount: 0,

    members: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    querying: false,
    pageDepositStr: '¥0.00'
  },

  onLoad() {
    this._loadTagLibrary()
  },
  onShow() {
    // 保参重查（从详情/注册返回保留页码 + 筛选）
    this.getData(this.data.page, this.data.pageSize)
  },

  // 标签库（从 DB 读，member_tag_preset）
  _loadTagLibrary() {
    var that = this
    data.getTagLibraryPromise(app.globalData.sessionKey).then(function (r) {
      var tags = ((r && r.tags) || []).map(function (t) { return { name: t.tag, on: false } })
      that.setData({ presetTags: tags })
    }).catch(function () {})
  },

  // 折叠筛选面板
  onToggleFilter() {
    this.setData({ filterOpen: !this.data.filterOpen })
  },
  onNameInput(e) { this.setData({ 'filter.name': e.detail.value }) },
  onCellInput(e) { this.setData({ 'filter.cell': e.detail.value }) },
  onGenderTap(e) { this.setData({ 'filter.gender': e.currentTarget.dataset.v }) },
  // 系统标签（参与业务）多选：切 on 标记（需同时参与所选全部业务）
  onSysTagTap(e) {
    var idx = e.currentTarget.dataset.idx
    this.setData({ ['sysTags[' + idx + '].on']: !this.data.sysTags[idx].on })
  },
  // 自定义标签多选
  onCustomTagTap(e) {
    var idx = e.currentTarget.dataset.idx
    this.setData({ ['presetTags[' + idx + '].on']: !this.data.presetTags[idx].on })
  },
  onResetFilter() {
    this.setData({
      filter: { name: '', cell: '', gender: '全部' },
      sysTags: this.data.sysTags.map(function (t) { return { name: t.name, on: false } }),
      presetTags: this.data.presetTags.map(function (t) { return { name: t.name, on: false } })
    })
  },
  onQuery() {
    this.setData({ filterOpen: false })
    this.getData(1, this.data.pageSize)
  },

  _selectedNames(list) {
    return list.filter(function (t) { return t.on }).map(function (t) { return t.name })
  },
  _activeCount() {
    var f = this.data.filter
    return (f.name ? 1 : 0) + (f.cell ? 1 : 0) + (f.gender !== '全部' ? 1 : 0)
      + this._selectedNames(this.data.sysTags).length + this._selectedNames(this.data.presetTags).length
  },

  getData(page, pageSize) {
    var that = this
    if (that.data.querying) return
    var f = that.data.filter
    var param = {
      name: f.name,
      cell: f.cell,
      gender: f.gender === '全部' ? '' : f.gender,
      bizTypes: that._selectedNames(that.data.sysTags).join(','),
      tags: that._selectedNames(that.data.presetTags).join(',')
    }
    that.setData({ querying: true, activeCount: that._activeCount() })
    data.searchMembersByStaffPromise(param, page, pageSize, app.globalData.sessionKey).then(function (r) {
      r = r || { items: [], total: 0 }
      var pageDeposit = 0
      var members = (r.items || []).map(function (m) {
        pageDeposit += parseFloat(m.deposit) || 0
        return {
          id: m.id,
          name: m.name || '—',
          avatar: (m.name && m.name.length > 0) ? m.name[0] : '?',
          female: m.gender === '女',
          gender: m.gender,
          phone: m.phone || '',
          depositStr: util.showAmount(m.deposit || 0),
          points: m.points || 0,
          sys: m.sys || [],
          custom: m.custom || []
        }
      })
      var total = r.total || 0
      that.setData({
        members: members,
        total: total,
        page: page,
        pageSize: pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        pageDepositStr: util.showAmount(pageDeposit),
        querying: false
      })
    }).catch(function () {
      that.setData({ members: [], total: 0, totalPages: 1, querying: false })
      wx.showToast({ title: '查询失败', icon: 'none' })
    })
  },

  onPagerChange(e) {
    var d = e.detail || {}
    this.getData(d.page || 1, d.pageSize || this.data.pageSize)
  },

  gotoDetail(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/admin/member/member_detail?id=' + id })
  },
  gotoRegister() {
    wx.navigateTo({ url: '/pages/admin/member/member_register' })
  },
  gotoTagAdmin() {
    wx.navigateTo({ url: '/pages/admin/member/member_tag_admin' })
  }
})

// 会员管理 — 列表 + 搜索（姓名/手机/性别/参与业务/自定义标签）+ 分页
const app = getApp()
const data = require('../../../utils/data.js')
const util = require('../../../utils/util.js')

const SYS_TAGS = ['租赁', '养护', '零售', '雪票', '二手回收', '水吧餐厅']
const DEFAULT_FILTER = { name: '', cell: '', gender: '全部', bizTypes: [], customTags: [] }

Page({
  data: {
    filterOpen: false,
    filter: { name: '', cell: '', gender: '全部', bizTypes: [], customTags: [] },
    sysTags: SYS_TAGS,
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
      var tags = ((r && r.tags) || []).map(function (t) { return t.tag })
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
  // 系统标签（参与业务）多选：需同时参与所选全部业务
  onSysTagTap(e) {
    var v = e.currentTarget.dataset.v
    var arr = this.data.filter.bizTypes.slice()
    var i = arr.indexOf(v)
    if (i >= 0) { arr.splice(i, 1) } else { arr.push(v) }
    this.setData({ 'filter.bizTypes': arr })
  },
  // 自定义标签多选
  onCustomTagTap(e) {
    var v = e.currentTarget.dataset.v
    var arr = this.data.filter.customTags.slice()
    var i = arr.indexOf(v)
    if (i >= 0) { arr.splice(i, 1) } else { arr.push(v) }
    this.setData({ 'filter.customTags': arr })
  },
  onResetFilter() {
    this.setData({ filter: JSON.parse(JSON.stringify(DEFAULT_FILTER)) })
  },
  onQuery() {
    this.setData({ filterOpen: false })
    this.getData(1, this.data.pageSize)
  },

  _activeCount(f) {
    return (f.name ? 1 : 0) + (f.cell ? 1 : 0) + (f.gender !== '全部' ? 1 : 0) + f.bizTypes.length + f.customTags.length
  },

  getData(page, pageSize) {
    var that = this
    if (that.data.querying) return
    var f = that.data.filter
    var param = {
      name: f.name,
      cell: f.cell,
      gender: f.gender === '全部' ? '' : f.gender,
      bizTypes: (f.bizTypes || []).join(','),
      tags: (f.customTags || []).join(',')
    }
    that.setData({ querying: true, activeCount: that._activeCount(f) })
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

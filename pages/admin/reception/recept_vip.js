// pages/admin/reception/recept_vip.js
// VIP 开单（接待页 recept_scan 的「VIP开单」按钮进来）：列出所有 VIP 会员，点一位直接给他开单。
//   不用顾客扫码、不用店长授权，视同身份已经验证（2026-11-09 用户要求）；进了顾客信息页以后的开单流程和以往一样。
// 后端依赖（SnowmeetApi）：
//   MemberAdmin/SearchMembersByStaff（vip=true，按 member.is_vip 索引筛，姓名 / 手机号可再搜）
//   QrCode/EnterReceptByVip：建一条已授权的接待记录（用途 VIP开单），返回 stage = phone_authed；
//     开单保存时后端认这条记录，订单自动算已核验本人。
const app = getApp()
const data = require('../../../utils/data.js')

const MEMBER_PAGE = '/pages/admin/reception/recept_member'
const PAGE_SIZE = 20
const SEARCH_DELAY = 350   // 输入停下来再查，别每敲一个字就发请求

Page({
  data: {
    keyword: '',          // 姓名或手机号（全是数字当手机号搜，否则当姓名搜）
    members: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1,
    querying: false,
    loaded: false         // 第一次查询回来之前不显示「没有 VIP」，免得先闪一下空状态
  },

  onLoad() {
    this._seq = 0         // 查询序号：只认最后一次发出的查询，输入搜索时旧响应回来也不会盖掉新结果
    this._entering = false
    this._timer = null
  },

  // 第一次进来、从顾客信息页返回都重新查一遍（保留当前页码和搜索词）：那段时间可能有人改了 VIP
  onShow() {
    this.getData(this.data.page, this.data.pageSize)
  },

  onUnload() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null }
    this._seq += 1
  },

  /* ---------- 搜索 / 列表 ---------- */
  onKeywordInput(e) {
    this.setData({ keyword: (e.detail.value || '').trim() })
    if (this._timer) clearTimeout(this._timer)
    this._timer = setTimeout(() => {
      this._timer = null
      this.getData(1, this.data.pageSize)
    }, SEARCH_DELAY)
  },

  _filter() {
    const kw = (this.data.keyword || '').trim()
    const filter = { vip: true }
    if (kw) {
      if (/^\d+$/.test(kw)) filter.cell = kw
      else filter.name = kw
    }
    return filter
  },

  getData(page, pageSize) {
    const that = this
    const seq = ++that._seq
    that.setData({ querying: true })
    return Promise.resolve(app.loginPromiseNew).then(function () {
      return data.searchMembersByStaffPromise(that._filter(), page, pageSize, app.globalData.sessionKey)
    }).then(function (r) {
      if (seq !== that._seq) return
      r = r || { items: [], total: 0 }
      const members = (r.items || []).map(function (m) {
        return {
          id: m.id,
          name: m.name || '—',
          avatar: (m.name && m.name.length > 0) ? m.name[0] : '?',
          female: m.gender === '女',
          gender: m.gender || '',
          phone: m.phone || ''
        }
      })
      const total = r.total || 0
      that.setData({
        members: members,
        total: total,
        page: page,
        pageSize: pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        querying: false,
        loaded: true
      })
    }).catch(function () {
      if (seq !== that._seq) return
      that.setData({ members: [], total: 0, totalPages: 1, querying: false, loaded: true })
      wx.showToast({ title: '查询失败', icon: 'none' })
    })
  },

  onPagerChange(e) {
    const d = e.detail || {}
    this.getData(d.page || 1, d.pageSize || this.data.pageSize)
  },

  /* ---------- 点一位 VIP 直接开单 ---------- */
  onVipTap(e) {
    const memberId = e.currentTarget.dataset.id
    if (!memberId || this._entering) return
    this._entering = true
    // 不是 VIP（刚被取消）/ 没有手机号 / 会员不存在时，请求层会提示原因，页面保持原样
    data.enterReceptByVipPromise(memberId, app.globalData.sessionKey).then((view) => {
      this._entering = false
      wx.navigateTo({
        url: MEMBER_PAGE + '?checkinId=' + view.id + '&stage=' + (view.stage || 'phone_authed'),
        fail: () => wx.showToast({ title: '打开顾客信息页没成功，请再点一次', icon: 'none' })
      })
    }).catch(() => {
      this._entering = false
    })
  }
})

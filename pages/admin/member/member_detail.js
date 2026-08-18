// 会员详情 — 资料 + 储值/龙珠 + 标签(系统只读+自定义可编辑) + 绑定账户 + 最近订单 + 名下次卡
//           底部：发券 / 加次卡 / 充值储值
const app = getApp()
const data = require('../../../utils/data.js')
const util = require('../../../utils/util.js')

Page({
  data: {
    memberId: 0,
    member: null,
    loading: true,

    // 标签编辑弹层
    tagSheetShow: false,
    tagSel: [],
    tagInput: '',
    presetTags: [],
    presetTagsView: [],   // [{name, on}]，WXML 不支持 arr.indexOf() 故派生 on 标记

    // 最近订单分类
    orderTabs: ['全部'],
    orderTab: '全部',
    filteredOrders: [],

    // 名下优惠券（可折叠）。一次拉全，按 未使用/已核销/已过期 前端切换——
    // 三个桶是完备互斥划分，由后端 bucket 字段决定，前端不再自己判过期
    couponOpen: false,
    couponLoaded: false,
    couponLoading: false,
    coupons: [],
    filteredCoupons: [],
    couponTab: 'unused',
    couponTabs: [
      { key: 'unused', name: '未使用' },
      { key: 'used', name: '已核销' },
      { key: 'expired', name: '已过期' }
    ],
    couponCounts: { unused: 0, used: 0, expired: 0, total: 0 },

    // 编辑资料（姓名/性别/手机号）
    profileShow: false,
    pf: { name: '', gender: '男', cell: '' },

    // 充值储值（类型/七色米订单号/备注/金额 四项一个弹窗）
    chargeShow: false,
    chargeTypes: ['储值送装备', '二手回收', '零售赠送', '预定', '其它赠送'],
    chargeType: '',
    chargeMi7: '',
    chargeMemo: '',
    chargeAmount: '',

    // 加次卡
    punchShow: false,
    punchPresets: [],
    punchSelIdx: -1,

    // 发券
    couponShow: false,
    couponTemplates: [],
    couponSelId: 0,
    couponCount: '1',

    // 会员合并（当前会员 → 搜索选中的目标会员），仅系统管理员（title_level >= 300）可操作
    isAdmin: false,
    mergeShow: false,
    mergeKeyword: '',
    mergeResults: [],
    mergeSearched: false
  },

  onLoad(options) {
    var that = this
    this.setData({ memberId: parseInt(options.id) || 0 })
    this._loadTagLibrary()
    Promise.resolve(app.loginPromiseNew).then(function () {
      var staff = app.globalData.staff
      that.setData({ isAdmin: !!(staff && staff.title_level >= 300) })
    }).catch(function () {})
  },
  onShow() {
    if (this.data.memberId) this.getData()
  },

  // 标签库（从 DB 读，member_tag_preset）
  _loadTagLibrary() {
    var that = this
    data.getTagLibraryPromise(app.globalData.sessionKey).then(function (r) {
      var tags = ((r && r.tags) || []).map(function (t) { return t.tag })
      that.setData({ presetTags: tags, presetTagsView: that._buildPresetView(tags, that.data.tagSel) })
    }).catch(function () {})
  },
  _buildPresetView(names, sel) {
    return (names || []).map(function (n) { return { name: n, on: sel.indexOf(n) >= 0 } })
  },

  getData() {
    var that = this
    data.getMemberDetailByStaffPromise(that.data.memberId, app.globalData.sessionKey).then(function (m) {
      if (!m) { that.setData({ loading: false }); wx.showToast({ title: '会员不存在', icon: 'none' }); return }
      m.depositTotalStr = util.showAmount(m.depositTotal || 0)
      m.avatar = (m.name && m.name.length > 0) ? m.name[0] : '?'
      m.female = m.gender === '女'
      // 联系手机号（合并会员时保留的旧号，type=contact）
      m.contactCellsStr = (m.accounts && m.accounts.contactCells && m.accounts.contactCells.length > 0) ? m.accounts.contactCells.join('、') : ''
      m.recentOrders = (m.recentOrders || []).map(function (o) {
        return { id: o.id, code: o.code, type: o.type, dateStr: o.bizDate ? util.formatDate(new Date(o.bizDate)) : '' }
      })
      m.punchCards = (m.punchCards || []).map(function (c) {
        // total=NULL 即季卡（不限次数，2026-07-09 起）
        var isSeason = c.total == null
        return { id: c.id, biz_type: c.biz_type, card_name: c.card_name, total: c.total,
          punches: c.punches || 0, isSeason: isSeason,
          // 已退款的卡仍列出但标灰（2026-07-25 起）：钱已退回顾客，任何核销入口都用不了它，
          // 店员在这里必须一眼看出来，不能当成可用余额报给顾客
          isRefund: !!c.is_refund,
          remaining: isSeason ? null : (c.total - (c.punches || 0)) }
      })
      // 最近订单分类 tab：全部 + 实际出现的业务类型（按首次出现顺序）
      var typeSet = []
      m.recentOrders.forEach(function (o) { if (o.type && typeSet.indexOf(o.type) < 0) typeSet.push(o.type) })
      that.setData({
        member: m, loading: false,
        orderTabs: ['全部'].concat(typeSet),
        orderTab: '全部',
        filteredOrders: m.recentOrders
      })
    }).catch(function () {
      that.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  // 优惠券折叠区：首次展开才拉数据，收起不清空（再展开不用重拉）
  onCouponToggle() {
    var open = !this.data.couponOpen
    this.setData({ couponOpen: open })
    if (open && !this.data.couponLoaded && !this.data.couponLoading) {
      this.loadCoupons()
    }
  },

  loadCoupons() {
    var that = this
    that.setData({ couponLoading: true })
    data.getMemberCouponsByStaffPromise(that.data.memberId, app.globalData.sessionKey).then(function (res) {
      res = res || {}
      // WXML 表达式不支持方法调用，展示文案一律在这里派生好
      var list = (res.items || []).map(function (c) {
        return Object.assign({}, c, {
          showInvalid: c.valid !== 1,
          showInactive: c.isActive !== 1,
          transferText: c.transferCount > 0 ? ('转赠 ' + c.transferCount + ' 次') : '',
          metaLine: c.bucket === 'used'
            ? ('核销 ' + (c.usedTimeStr || ''))
            : ('发放 ' + c.createDateStr + ' · 到期 ' + c.expireDateStr)
        })
      })
      that.setData({
        coupons: list,
        couponLoaded: true,
        couponLoading: false,
        couponCounts: {
          unused: res.unusedCount || 0,
          used: res.usedCount || 0,
          expired: res.expiredCount || 0,
          total: res.total || 0
        }
      })
      that._filterCoupons(that.data.couponTab)
    }).catch(function () {
      that.setData({ couponLoading: false })
    })
  },

  onCouponTab(e) {
    var key = e.currentTarget.dataset.k
    if (key === this.data.couponTab) { return }
    this.setData({ couponTab: key })
    this._filterCoupons(key)
  },

  _filterCoupons(key) {
    this.setData({
      filteredCoupons: this.data.coupons.filter(function (c) { return c.bucket === key })
    })
  },

  gotoCoupon(e) {
    var code = e.currentTarget.dataset.code
    if (!code) { return }
    wx.navigateTo({ url: '/pages/admin/ticket/coupon_detail/coupon_detail?code=' + code })
  },

  callPhone() {
    var p = this.data.member && this.data.member.phone
    if (p) wx.makePhoneCall({ phoneNumber: p })
  },

  // ── 编辑资料（姓名/性别/手机号）──
  onEditProfile() {
    var m = this.data.member || {}
    this.setData({ profileShow: true, pf: { name: m.name === '—' ? '' : (m.name || ''), gender: m.gender || '男', cell: m.phone || '' } })
  },
  onProfileClose() { this.setData({ profileShow: false }) },
  onPfNameInput(e) { this.setData({ 'pf.name': e.detail.value }) },
  onPfGenderTap(e) { this.setData({ 'pf.gender': e.currentTarget.dataset.v }) },
  onPfCellInput(e) { this.setData({ 'pf.cell': (e.detail.value || '').replace(/[^0-9]/g, '').slice(0, 11) }) },
  onProfileSave() {
    var that = this
    var pf = that.data.pf
    var cell = (pf.cell || '').trim()
    if (cell !== '' && !/^1\d{10}$/.test(cell)) { wx.showToast({ title: '手机号格式不对', icon: 'none' }); return }
    wx.showLoading({ title: '保存中', mask: true })
    data.updateMemberProfilePromise(
      { memberId: that.data.memberId, realName: pf.name, gender: pf.gender, cell: cell },
      app.globalData.sessionKey
    ).then(function () {
      wx.hideLoading(); wx.showToast({ title: '已保存', icon: 'success' })
      that.setData({ profileShow: false }); that.getData()
    }).catch(function () { wx.hideLoading() /* 后端 message 已 toast（如手机号已被他人绑定）*/ })
  },

  // 点某张次卡 → 该卡的核销记录。复用顾客侧的使用明细页，带 staff=1 切成店员模式
  // （换成按 staff 权限放行的接口，且不显示顾客自助退款入口）
  onPunchCardTap(e) {
    var cardId = e.currentTarget.dataset.id
    if (!cardId) { return }
    wx.navigateTo({ url: '/pages/mine/punchcard_usage?cardId=' + cardId + '&staff=1' })
  },

  onOrderTab(e) {
    var t = e.currentTarget.dataset.t
    var all = (this.data.member && this.data.member.recentOrders) || []
    var list = t === '全部' ? all : all.filter(function (o) { return o.type === t })
    this.setData({ orderTab: t, filteredOrders: list })
  },

  // 最近订单 → 按业务类型进对应详情页
  gotoOrder(e) {
    var id = e.currentTarget.dataset.id
    var type = e.currentTarget.dataset.type
    if (!id) return
    var url = ''
    if (type === '租赁') { url = '/pages/admin/rent/rent_order_detail/rent_order_detail?id=' + id }
    else if (type === '养护') { url = '/pages/admin/care/care_order_detail/care_order_detail?orderId=' + id }
    else if (type === '零售') { url = '/pages/admin/retail/retail_order_detail?id=' + id }
    else { wx.showToast({ title: type + '订单暂无详情页', icon: 'none' }); return }
    wx.navigateTo({ url: url })
  },

  // ── 标签编辑 ──
  onEditTags() {
    var sel = ((this.data.member && this.data.member.custom) || []).slice()
    this.setData({ tagSheetShow: true, tagSel: sel, tagInput: '', presetTagsView: this._buildPresetView(this.data.presetTags, sel) })
  },
  onTagSheetClose() { this.setData({ tagSheetShow: false }) },
  onTagInput(e) { this.setData({ tagInput: e.detail.value }) },
  onTagToggle(e) {
    var v = e.currentTarget.dataset.v
    var arr = this.data.tagSel.slice()
    var i = arr.indexOf(v)
    if (i >= 0) { arr.splice(i, 1) } else { arr.push(v) }
    this.setData({ tagSel: arr, presetTagsView: this._buildPresetView(this.data.presetTags, arr) })
  },
  onTagAdd() {
    var v = (this.data.tagInput || '').trim()
    if (!v) return
    var arr = this.data.tagSel.slice()
    if (arr.indexOf(v) < 0) arr.push(v)
    this.setData({ tagSel: arr, tagInput: '', presetTagsView: this._buildPresetView(this.data.presetTags, arr) })
  },
  onTagRemove(e) {
    var v = e.currentTarget.dataset.v
    var arr = this.data.tagSel.filter(function (x) { return x !== v })
    this.setData({ tagSel: arr, presetTagsView: this._buildPresetView(this.data.presetTags, arr) })
  },
  onTagSave() {
    var that = this
    var sk = app.globalData.sessionKey
    var orig = (that.data.member && that.data.member.custom) || []
    var sel = that.data.tagSel
    var toAdd = sel.filter(function (t) { return orig.indexOf(t) < 0 })
    var toRemove = orig.filter(function (t) { return sel.indexOf(t) < 0 })
    if (toAdd.length === 0 && toRemove.length === 0) { that.setData({ tagSheetShow: false }); return }
    wx.showLoading({ title: '保存中', mask: true })
    var chain = Promise.resolve()
    toAdd.forEach(function (t) {
      chain = chain.then(function () { return data.addMemberTagPromise(that.data.memberId, t, sk) })
    })
    toRemove.forEach(function (t) {
      chain = chain.then(function () { return data.removeMemberTagPromise(that.data.memberId, t, sk) })
    })
    chain.then(function () {
      wx.hideLoading()
      that.setData({ tagSheetShow: false })
      that.getData()
    }).catch(function () {
      wx.hideLoading(); wx.showToast({ title: '保存失败', icon: 'none' }); that.getData()
    })
  },

  // ── 充值储值 ──
  onChargeOpen() { this.setData({ chargeShow: true, chargeType: '', chargeMi7: '', chargeMemo: '', chargeAmount: '' }) },
  onChargeClose() { this.setData({ chargeShow: false }) },
  onChargeTypeTap(e) { this.setData({ chargeType: e.currentTarget.dataset.v }) },
  onChargeMi7Input(e) { this.setData({ chargeMi7: e.detail.value }) },
  onChargeMemoInput(e) { this.setData({ chargeMemo: e.detail.value }) },
  onChargeInput(e) { this.setData({ chargeAmount: e.detail.value }) },
  onChargeConfirm() {
    var that = this
    if (!that.data.chargeType) { wx.showToast({ title: '请选择充值类型', icon: 'none' }); return }
    var amt = parseFloat(that.data.chargeAmount)
    if (isNaN(amt) || amt <= 0) { wx.showToast({ title: '请输入金额', icon: 'none' }); return }
    wx.showModal({
      title: '确认充值', content: '为该会员充值储值 ' + util.showAmount(amt) + '（' + that.data.chargeType + '）',
      complete: function (res) {
        if (!res.confirm) return
        wx.showLoading({ title: '充值中', mask: true })
        data.chargeMemberDepositPromise({
          memberId: that.data.memberId, depositType: 'C', amount: amt,
          chargeType: that.data.chargeType, mi7Code: that.data.chargeMi7, memo: that.data.chargeMemo
        }, app.globalData.sessionKey)
          .then(function () { wx.hideLoading(); wx.showToast({ title: '充值成功', icon: 'success' }); that.setData({ chargeShow: false }); that.getData() })
          .catch(function () { wx.hideLoading(); wx.showToast({ title: '充值失败', icon: 'none' }) })
      }
    })
  },

  // ── 加次卡 ──
  onPunchOpen() {
    var that = this
    that.setData({ punchShow: true, punchSelIdx: -1 })
    if (that.data.punchPresets.length === 0) {
      data.getPunchCardPresetsPromise(app.globalData.sessionKey).then(function (r) {
        that.setData({ punchPresets: (r && r.presets) || [] })
      }).catch(function () {})
    }
  },
  onPunchClose() { this.setData({ punchShow: false }) },
  onPunchSelect(e) { this.setData({ punchSelIdx: e.currentTarget.dataset.idx }) },
  onPunchConfirm() {
    var that = this
    var idx = that.data.punchSelIdx
    if (idx < 0) { wx.showToast({ title: '请选择卡种', icon: 'none' }); return }
    var p = that.data.punchPresets[idx]
    var spec = p.isSeason ? '不限次数' : (p.total + ' 次')
    wx.showModal({
      title: '确认发卡', content: '发放「' + p.card_name + '」（' + p.biz_type + p.card_type + ' ' + spec + '）给该会员',
      complete: function (res) {
        if (!res.confirm) return
        wx.showLoading({ title: '发放中', mask: true })
        // 只传 productId：卡名/次数/业务类型由服务端从商品目录取，前端传的字符串一概不作数
        data.grantPunchCardPromise({ memberId: that.data.memberId, productId: p.productId }, app.globalData.sessionKey)
          .then(function () { wx.hideLoading(); wx.showToast({ title: '发放成功', icon: 'success' }); that.setData({ punchShow: false }); that.getData() })
          .catch(function () { wx.hideLoading(); wx.showToast({ title: '发放失败', icon: 'none' }) })
      }
    })
  },

  // ── 发券 ──
  onCouponOpen() {
    var that = this
    that.setData({ couponShow: true, couponSelId: 0, couponCount: '1' })
    if (that.data.couponTemplates.length === 0) {
      data.getCouponTemplatesPromise(app.globalData.sessionKey).then(function (r) {
        that.setData({ couponTemplates: (r && r.templates) || [] })
      }).catch(function () {})
    }
  },
  onCouponClose() { this.setData({ couponShow: false }) },
  onCouponSelect(e) { this.setData({ couponSelId: e.currentTarget.dataset.id }) },
  onCouponCountInput(e) { this.setData({ couponCount: e.detail.value }) },
  onCouponConfirm() {
    var that = this
    if (!that.data.couponSelId) { wx.showToast({ title: '请选择券', icon: 'none' }); return }
    var count = parseInt(that.data.couponCount) || 1
    if (count < 1) count = 1
    wx.showLoading({ title: '发放中', mask: true })
    data.grantCouponPromise({ memberId: that.data.memberId, templateId: that.data.couponSelId, count: count }, app.globalData.sessionKey)
      .then(function (r) {
        wx.hideLoading()
        wx.showToast({ title: '已发放 ' + ((r && r.granted) || count) + ' 张', icon: 'success' })
        that.setData({ couponShow: false }); that.getData()
      })
      .catch(function () { wx.hideLoading(); wx.showToast({ title: '发放失败', icon: 'none' }) })
  },

  // ── 会员合并 ──
  onMergeOpen() {
    if (!this.data.isAdmin) { wx.showToast({ title: '仅系统管理员可操作', icon: 'none' }); return }
    this.setData({ mergeShow: true, mergeKeyword: '', mergeResults: [], mergeSearched: false })
  },
  onMergeClose() { this.setData({ mergeShow: false }) },
  onMergeInput(e) { this.setData({ mergeKeyword: e.detail.value }) },
  onMergeSearch() {
    var that = this
    var kw = (that.data.mergeKeyword || '').trim()
    if (!kw) { wx.showToast({ title: '请输入手机号或姓名', icon: 'none' }); return }
    var filter = /^\d{3,}$/.test(kw) ? { cell: kw } : { name: kw }
    wx.showLoading({ title: '搜索中', mask: true })
    data.searchMembersByStaffPromise(filter, 1, 20, app.globalData.sessionKey).then(function (r) {
      wx.hideLoading()
      var items = ((r && r.items) || [])
        .filter(function (m) { return m.id !== that.data.memberId })
        .map(function (m) { return { id: m.id, name: m.name || '—', gender: m.gender || '', phone: m.phone || '' } })
      that.setData({ mergeResults: items, mergeSearched: true })
    }).catch(function () {
      wx.hideLoading()
      that.setData({ mergeResults: [], mergeSearched: true })
    })
  },
  onMergeSelect(e) {
    var that = this
    var t = that.data.mergeResults[e.currentTarget.dataset.idx]
    if (!t) return
    wx.showModal({
      title: '确认合并',
      content: '当前会员将被合并，订单、储值、龙珠、次卡、优惠券全部转移到「' + t.name + '（ID ' + t.id + '）」名下，当前会员失效。此操作不可撤销！',
      confirmText: '确认合并',
      confirmColor: '#ba1a1a',
      complete: function (res) {
        if (!res.confirm) return
        wx.showLoading({ title: '合并中', mask: true })
        data.mergeMemberByStaffPromise(that.data.memberId, t.id, app.globalData.sessionKey).then(function () {
          wx.hideLoading()
          wx.showToast({ title: '合并完成', icon: 'success' })
          that.setData({ mergeShow: false })
          wx.redirectTo({ url: '/pages/admin/member/member_detail?id=' + t.id })
        }).catch(function () {
          wx.hideLoading() /* 后端 message（已被合并过/没有权限等）已由 performWebRequest toast */
        })
      }
    })
  },

  noop() {}
})

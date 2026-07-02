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

    // 充值储值
    chargeShow: false,
    chargeAmount: '',

    // 加次卡
    punchShow: false,
    punchPresets: [],
    punchSelIdx: -1,

    // 发券
    couponShow: false,
    couponTemplates: [],
    couponSelId: 0,
    couponCount: '1'
  },

  onLoad(options) {
    this.setData({ memberId: parseInt(options.id) || 0 })
    this._loadTagLibrary()
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
      m.recentOrders = (m.recentOrders || []).map(function (o) {
        return { code: o.code, type: o.type, dateStr: o.bizDate ? util.formatDate(new Date(o.bizDate)) : '' }
      })
      m.punchCards = (m.punchCards || []).map(function (c) {
        return { id: c.id, biz_type: c.biz_type, card_name: c.card_name, total: c.total, punches: c.punches, remaining: c.total - c.punches }
      })
      that.setData({ member: m, loading: false })
    }).catch(function () {
      that.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  callPhone() {
    var p = this.data.member && this.data.member.phone
    if (p) wx.makePhoneCall({ phoneNumber: p })
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
  onChargeOpen() { this.setData({ chargeShow: true, chargeAmount: '' }) },
  onChargeClose() { this.setData({ chargeShow: false }) },
  onChargeInput(e) { this.setData({ chargeAmount: e.detail.value }) },
  onChargeConfirm() {
    var that = this
    var amt = parseFloat(that.data.chargeAmount)
    if (isNaN(amt) || amt <= 0) { wx.showToast({ title: '请输入金额', icon: 'none' }); return }
    wx.showModal({
      title: '确认充值', content: '为该会员充值储值 ' + util.showAmount(amt) + '（C 类）',
      complete: function (res) {
        if (!res.confirm) return
        wx.showLoading({ title: '充值中', mask: true })
        data.chargeMemberDepositPromise({ memberId: that.data.memberId, depositType: 'C', amount: amt }, app.globalData.sessionKey)
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
    wx.showModal({
      title: '确认发卡', content: '发放「' + p.card_name + '」（' + p.biz_type + ' ' + p.total + ' 次）给该会员',
      complete: function (res) {
        if (!res.confirm) return
        wx.showLoading({ title: '发放中', mask: true })
        data.grantPunchCardPromise({ memberId: that.data.memberId, bizType: p.biz_type, cardName: p.card_name, total: p.total }, app.globalData.sessionKey)
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

  noop() {}
})

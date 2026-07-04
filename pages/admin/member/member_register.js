// 店长/管理员 手机号注册会员 — 检测 → 已存在(进详情) / 新建(姓名/性别/初始储值/开卡礼包) → 完成
const app = getApp()
const data = require('../../../utils/data.js')
const util = require('../../../utils/util.js')

Page({
  data: {
    phone: '',
    phase: 'idle', // idle | existing | new | done
    found: null,
    form: { name: '', gender: '男' },
    newMember: null,
    busy: false,

    // 初始储值（四字段一个弹窗；depositCfg = null 未配置 / {chargeType, mi7Code, memo, amount, amountStr, subStr}）
    depositCfg: null,
    depositShow: false,
    chargeTypes: ['储值送装备', '二手回收', '零售赠送', '预定', '其他赠送'],
    depositType: '',
    depositMi7: '',
    depositMemo: '',
    depositAmount: '',

    // 开卡礼包清单：{kind:'coupon',templateId,name,type,count,subStr} / {kind:'punch',bizType,cardName,total,name,subStr}
    grants: [],
    // 优惠券选择弹窗
    couponPickShow: false,
    couponTemplates: [],
    couponSelId: 0,
    couponCount: '1',
    // 次卡选择弹窗（punchPickBiz = '租赁' | '养护'）
    punchPickShow: false,
    punchPickBiz: '',
    punchPresets: [],
    punchPickList: [],   // 按 punchPickBiz 过滤后的列表（WXML 不支持方法调用，JS 预派生）
    punchSelIdx: -1,
    // 完成页发放结果
    grantResults: [],
    grantFailed: false
  },

  onPhoneInput(e) {
    var v = (e.detail.value || '').replace(/[^0-9]/g, '').slice(0, 11)
    this.setData({ phone: v, phase: 'idle' })
  },
  _validPhone() { return /^1\d{10}$/.test(this.data.phone) },

  onDetect() {
    var that = this
    if (!that._validPhone()) { wx.showToast({ title: '请输入 11 位手机号', icon: 'none' }); return }
    that.setData({ busy: true })
    data.getMemberByNumSilentPromise(that.data.phone, app.globalData.sessionKey).then(function (member) {
      if (member && member.id) {
        that.setData({ phase: 'existing', found: member, busy: false })
      } else {
        that.setData({ phase: 'new', busy: false })
      }
    }).catch(function () {
      that.setData({ phase: 'new', busy: false })
    })
  },

  onNameInput(e) { this.setData({ 'form.name': e.detail.value }) },
  onGenderTap(e) { this.setData({ 'form.gender': e.currentTarget.dataset.v }) },

  onReset() {
    this.setData({
      phone: '', phase: 'idle', found: null,
      form: { name: '', gender: '男' }, newMember: null,
      depositCfg: null, depositShow: false,
      grants: [], grantResults: [], grantFailed: false,
      couponPickShow: false, punchPickShow: false
    })
  },

  // ── 初始储值（四字段弹窗；已配置时点摘要重开编辑） ──
  onDepositOpen() {
    var cfg = this.data.depositCfg
    this.setData({
      depositShow: true,
      depositType: cfg ? cfg.chargeType : '',
      depositMi7: cfg ? cfg.mi7Code : '',
      depositMemo: cfg ? cfg.memo : '',
      depositAmount: cfg ? String(cfg.amount) : ''
    })
  },
  onDepositModalClose() { this.setData({ depositShow: false }) },
  onDepositTypeTap(e) { this.setData({ depositType: e.currentTarget.dataset.v }) },
  onDepositMi7Input(e) { this.setData({ depositMi7: e.detail.value }) },
  onDepositMemoInput(e) { this.setData({ depositMemo: e.detail.value }) },
  onDepositAmountInput(e) { this.setData({ depositAmount: e.detail.value }) },
  onDepositModalConfirm() {
    var that = this
    if (!that.data.depositType) { wx.showToast({ title: '请选择充值类型', icon: 'none' }); return }
    var amt = parseFloat(that.data.depositAmount)
    if (isNaN(amt) || amt <= 0) { wx.showToast({ title: '请输入金额', icon: 'none' }); return }
    var subParts = []
    if (that.data.depositMi7) subParts.push(that.data.depositMi7)
    if (that.data.depositMemo) subParts.push(that.data.depositMemo)
    that.setData({
      depositShow: false,
      depositCfg: {
        chargeType: that.data.depositType, mi7Code: that.data.depositMi7, memo: that.data.depositMemo,
        amount: amt, amountStr: util.showAmount(amt),
        subStr: subParts.join(' · ')
      }
    })
  },
  onDepositRemove() { this.setData({ depositCfg: null }) },

  noop() {},

  // ── 开卡礼包：优惠券 ──
  onAddCoupon() {
    var that = this
    that.setData({ couponPickShow: true, couponSelId: 0, couponCount: '1' })
    if (that.data.couponTemplates.length === 0) {
      data.getCouponTemplatesPromise(app.globalData.sessionKey).then(function (r) {
        that.setData({ couponTemplates: (r && r.templates) || [] })
      }).catch(function () {})
    }
  },
  onCouponPickClose() { this.setData({ couponPickShow: false }) },
  onCouponPickSelect(e) { this.setData({ couponSelId: e.currentTarget.dataset.id }) },
  onCouponCountInput(e) { this.setData({ couponCount: (e.detail.value || '').replace(/[^0-9]/g, '') }) },
  onCouponPickConfirm() {
    var that = this
    var tpl = null
    for (var i = 0; i < that.data.couponTemplates.length; i++) {
      if (that.data.couponTemplates[i].id === that.data.couponSelId) { tpl = that.data.couponTemplates[i]; break }
    }
    if (!tpl) { wx.showToast({ title: '请选择优惠券', icon: 'none' }); return }
    var count = parseInt(that.data.couponCount) || 0
    if (count < 1 || count > 50) { wx.showToast({ title: '数量 1-50', icon: 'none' }); return }
    var grants = that.data.grants.concat([{
      kind: 'coupon', templateId: tpl.id, name: tpl.name, type: tpl.type, count: count,
      subStr: (tpl.type || '优惠券') + ' × ' + count
    }])
    that.setData({ grants: grants, couponPickShow: false })
  },

  // ── 开卡礼包：次卡（租赁/养护共用一个弹窗，按 biz_type 过滤卡种） ──
  onAddRentPunch() { this._openPunchPick('租赁') },
  onAddCarePunch() { this._openPunchPick('养护') },
  _openPunchPick(biz) {
    var that = this
    that.setData({ punchPickShow: true, punchPickBiz: biz, punchSelIdx: -1, punchPickList: that._filterPunch(biz) })
    if (that.data.punchPresets.length === 0) {
      data.getPunchCardPresetsPromise(app.globalData.sessionKey).then(function (r) {
        var presets = (r && r.presets) || []
        that.setData({ punchPresets: presets, punchPickList: that._filterPunch(biz, presets) })
      }).catch(function () {})
    }
  },
  _filterPunch(biz, presets) {
    var list = presets || this.data.punchPresets
    var out = []
    for (var i = 0; i < list.length; i++) { if (list[i].biz_type === biz) out.push(list[i]) }
    return out
  },
  onPunchPickClose() { this.setData({ punchPickShow: false }) },
  onPunchPickSelect(e) { this.setData({ punchSelIdx: e.currentTarget.dataset.idx }) },
  onPunchPickConfirm() {
    var that = this
    var p = that.data.punchPickList[that.data.punchSelIdx]
    if (!p) { wx.showToast({ title: '请选择卡种', icon: 'none' }); return }
    var grants = that.data.grants.concat([{
      kind: 'punch', bizType: p.biz_type, cardName: p.card_name, total: p.total,
      name: p.card_name, subStr: p.biz_type + '次卡 · ' + p.total + ' 次'
    }])
    that.setData({ grants: grants, punchPickShow: false })
  },

  onGrantRemove(e) {
    var idx = e.currentTarget.dataset.idx
    var grants = this.data.grants.slice()
    grants.splice(idx, 1)
    this.setData({ grants: grants })
  },

  onSubmit() {
    var that = this
    if (that.data.busy) return
    var f = that.data.form
    that.setData({ busy: true })
    wx.showLoading({ title: '注册中', mask: true })
    var sk = app.globalData.sessionKey
    data.registerMemberByPhonePromise({ cell: that.data.phone, realName: f.name, gender: f.gender }, sk).then(function (r) {
      if (!r || !r.id) {
        wx.hideLoading(); that.setData({ busy: false })
        wx.showToast({ title: (r && r.message) || '注册失败', icon: 'none' }); return
      }
      if (r.exists) {
        // 竞态：已存在 → 转已存在分支
        wx.hideLoading(); that.setData({ busy: false, phase: 'existing', found: r }); return
      }
      that._runGrants(r.id)
    }).catch(function () {
      wx.hideLoading(); that.setData({ busy: false })
      wx.showToast({ title: '注册失败', icon: 'none' })
    })
  },

  // 注册成功后串行执行 初始储值 + 礼包各项，逐项 catch 不中断；全部跑完进 done 展示结果
  _runGrants(memberId) {
    var that = this
    var sk = app.globalData.sessionKey
    var f = that.data.form
    var tasks = []
    var dep = that.data.depositCfg
    if (dep) {
      tasks.push({
        label: '储值 ' + dep.amountStr + '（' + dep.chargeType + '）',
        run: function () {
          return data.chargeMemberDepositPromise({
            memberId: memberId, depositType: 'C', amount: dep.amount,
            chargeType: dep.chargeType, mi7Code: dep.mi7Code, memo: dep.memo
          }, sk)
        }
      })
    }
    that.data.grants.forEach(function (g) {
      if (g.kind === 'coupon') {
        tasks.push({
          label: g.name + ' × ' + g.count,
          run: function () { return data.grantCouponPromise({ memberId: memberId, templateId: g.templateId, count: g.count }, sk) }
        })
      } else {
        tasks.push({
          label: g.cardName + '（' + g.bizType + ' · ' + g.total + ' 次）',
          run: function () { return data.grantPunchCardPromise({ memberId: memberId, bizType: g.bizType, cardName: g.cardName, total: g.total }, sk) }
        })
      }
    })
    if (tasks.length > 0) wx.showLoading({ title: '发放礼包中', mask: true })
    var results = []
    var chain = Promise.resolve()
    tasks.forEach(function (t) {
      chain = chain.then(function () {
        return t.run()
          .then(function () { results.push({ label: t.label, ok: true }) })
          .catch(function () { results.push({ label: t.label, ok: false }) })
      })
    })
    chain.then(function () {
      wx.hideLoading()
      var failed = false
      for (var i = 0; i < results.length; i++) { if (!results[i].ok) failed = true }
      that.setData({
        busy: false, phase: 'done',
        grantResults: results, grantFailed: failed,
        newMember: {
          id: memberId, name: f.name || '未填写', phone: that.data.phone,
          depositStr: dep ? dep.amountStr : util.showAmount(0)
        }
      })
    })
  },

  gotoExisting() {
    if (this.data.found && this.data.found.id) wx.navigateTo({ url: '/pages/admin/member/member_detail?id=' + this.data.found.id })
  },
  gotoNew() {
    if (this.data.newMember && this.data.newMember.id) wx.navigateTo({ url: '/pages/admin/member/member_detail?id=' + this.data.newMember.id })
  }
})

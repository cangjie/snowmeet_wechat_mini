// 店长/管理员 手机号注册会员 — 检测 → 已存在(进详情) / 新建(姓名/性别/初始储值) → 完成
const app = getApp()
const data = require('../../../utils/data.js')
const util = require('../../../utils/util.js')

Page({
  data: {
    phone: '',
    phase: 'idle', // idle | existing | new | done
    found: null,
    form: { name: '', gender: '男', deposit: '' },
    newMember: null,
    busy: false
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
  onDepositInput(e) { this.setData({ 'form.deposit': e.detail.value }) },

  onReset() {
    this.setData({ phone: '', phase: 'idle', found: null, form: { name: '', gender: '男', deposit: '' }, newMember: null })
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
      var depositAmt = parseFloat(f.deposit)
      var afterCharge = function () {
        wx.hideLoading()
        that.setData({
          busy: false, phase: 'done',
          newMember: {
            id: r.id, name: f.name || '未填写', phone: that.data.phone,
            depositStr: util.showAmount(depositAmt > 0 ? depositAmt : 0)
          }
        })
      }
      if (!isNaN(depositAmt) && depositAmt > 0) {
        data.chargeMemberDepositPromise({ memberId: r.id, depositType: 'C', amount: depositAmt }, sk)
          .then(afterCharge).catch(afterCharge)
      } else {
        afterCharge()
      }
    }).catch(function () {
      wx.hideLoading(); that.setData({ busy: false })
      wx.showToast({ title: '注册失败', icon: 'none' })
    })
  },

  gotoExisting() {
    if (this.data.found && this.data.found.id) wx.navigateTo({ url: '/pages/admin/member/member_detail?id=' + this.data.found.id })
  },
  gotoNew() {
    if (this.data.newMember && this.data.newMember.id) wx.navigateTo({ url: '/pages/admin/member/member_detail?id=' + this.data.newMember.id })
  }
})

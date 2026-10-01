// 员工自助登记：新员工用私人手机的微信扫「自助登记码」进来，填姓名、授权手机号后提交，等系统管理员开通
// 新账号关联这部私人手机和微信；要用工作手机的，由管理员在入职页分配
const api = require('../common/api.js')
const base = require('../common/page-base.js')

Page({
  data: { prototype: false, name: '', gender: '', submitted: false, submitting: false },

  onLoad() { base.boot(this, false).catch(() => {}) },

  onName(e) { this.setData({ name: e.detail.value }) },
  onGender(e) { this.setData({ gender: e.currentTarget.dataset.v }) },

  check() {
    if (!this.data.name.trim()) { wx.showToast({ title: '请填写姓名', icon: 'none' }); return false }
    if (!this.data.gender) { wx.showToast({ title: '请选择性别', icon: 'none' }); return false }
    return true
  },
  onPhone(e) {
    const d = (e && e.detail) || {}
    if (!this.check()) return
    if (d.errMsg && d.errMsg.indexOf('ok') < 0) { wx.showToast({ title: '需要授权手机号才能登记', icon: 'none' }); return }
    this.submit()
  },
  // 原型：开发者工具里不方便授权时跳过
  onSkip() { if (this.check()) this.submit() },

  submit() {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    api.selfRegister({ name: this.data.name, gender: this.data.gender }).then(() => {
      this.setData({ submitting: false, submitted: true })
    }).catch(err => { this.setData({ submitting: false }); base.fail(err) })
  },
  onBack() { wx.navigateBack() }
})

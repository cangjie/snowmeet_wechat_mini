// 员工自助登记：新员工用私人手机的微信扫公众号员工入职码，点公众号回复里的链接进来，填姓名、授权手机号后提交，等系统管理员开通。
// 新账号关联这部私人手机和微信；这个微信必须已是会员（code 5）。要用工作手机的，由管理员在入职页分配
const api = require('../common/api.js')
const base = require('../common/page-base.js')

Page({
  data: { name: '', gender: '', state: 'form', notice: '', submitting: false },

  onLoad() { base.boot(this, false).catch(() => {}) },

  onName(e) { this.setData({ name: e.detail.value }) },
  onGender(e) { this.setData({ gender: e.currentTarget.dataset.v }) },

  onPhone(e) {
    const d = (e && e.detail) || {}
    if (!this.data.name.trim()) { wx.showToast({ title: '请填写姓名', icon: 'none' }); return }
    if (!this.data.gender) { wx.showToast({ title: '请选择性别', icon: 'none' }); return }
    if (!d.encryptedData || (d.errMsg && d.errMsg.indexOf('ok') < 0)) { wx.showToast({ title: '需要授权手机号才能登记', icon: 'none' }); return }
    if (this.data.submitting) return
    this.setData({ submitting: true })
    api.selfRegister(this.data.name, this.data.gender, d.encryptedData, d.iv).then(() => {
      this.setData({ submitting: false, state: 'done' })
    }).catch(err => {
      this.setData({ submitting: false })
      if (err && err.code === 5) { this.setData({ state: 'not_member', notice: err.message }); return }
      base.fail(err)
    })
  }
})

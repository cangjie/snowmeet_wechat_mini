// 扫码确认页：在被绑定的那部手机上打开（员工本人或工作手机的微信），不要求员工身份
// 授权手机号后绑定：openid 由服务端从会话里取，手机号用 getPhoneNumber 解密。原型阶段不解密，直接用演示号码
const api = require('../common/api.js')
const base = require('../common/page-base.js')

Page({
  data: { prototype: false, loading: true, code: null, state: '', submitting: false },

  onLoad(options) {
    this.token = options.token
    base.boot(this, false).then(() => this.load()).catch(() => {})
  },

  load() {
    return api.getCode(this.token).then(code => {
      this.setData({ loading: false, code, state: code.status === 'ok' ? 'confirm' : code.status })
    }).catch(err => { this.setData({ loading: false, state: 'missing' }); base.fail(err) })
  },

  onPhone(e) {
    const d = (e && e.detail) || {}
    if (d.errMsg && d.errMsg.indexOf('ok') < 0) { wx.showToast({ title: '需要授权手机号才能绑定', icon: 'none' }); return }
    this.bind()
  },
  // 原型：开发者工具里不方便授权时跳过
  onSkip() { this.bind() },

  bind() {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    api.confirmBind(this.token).then(() => {
      this.setData({ submitting: false, state: 'done' })
    }).catch(err => { this.setData({ submitting: false }); base.fail(err) })
  },
  onBack() { wx.navigateBack() }
})

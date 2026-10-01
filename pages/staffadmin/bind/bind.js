// 扫码确认页：在被绑定的那部手机上打开（员工私人手机或工作手机的微信），不要求员工身份。
// 由「扫普通链接二维码打开小程序」规则进入时，token 在 options.q（https://mini.snowmeet.top/mapp/staff_bind?token=…）里。
// 授权手机号后把 encryptedData + iv 交给后端：openid 取自会话，手机号由后端解密；这个微信必须已是会员（code 5）
const api = require('../common/api.js')
const base = require('../common/page-base.js')

function tokenOf(options) {
  if (options.token) return options.token
  const m = decodeURIComponent(options.q || '').match(/[?&]token=([^&#]+)/)
  return m ? m[1] : ''
}

Page({
  data: { loading: true, code: null, state: '', notice: '', submitting: false },

  onLoad(options) {
    this.token = tokenOf(options || {})
    base.boot(this, false).then(() => this.load()).catch(() => {})
  },

  load() {
    if (!this.token) {
      this.setData({ loading: false, state: 'missing' })
      return Promise.resolve()
    }
    return api.getCode(this.token).then(code => {
      this.setData({ loading: false, code, state: code.status === 'ok' ? 'confirm' : code.status })
    }).catch(err => {
      this.setData({ loading: false, state: 'missing' })
      base.fail(err)
    })
  },

  onPhone(e) {
    const d = (e && e.detail) || {}
    if (!d.encryptedData || (d.errMsg && d.errMsg.indexOf('ok') < 0)) {
      wx.showToast({ title: '需要授权手机号才能绑定', icon: 'none' })
      return
    }
    if (this.data.submitting) return
    this.setData({ submitting: true })
    api.confirmBind(this.token, d.encryptedData, d.iv).then(() => {
      this.setData({ submitting: false, state: 'done' })
    }).catch(err => {
      this.setData({ submitting: false })
      if (err && err.code === 5) { this.setData({ state: 'not_member', notice: err.message }); return }
      base.fail(err)
    })
  }
})

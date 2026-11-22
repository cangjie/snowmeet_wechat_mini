const app = getApp()
const util = require('../../utils/util.js')
const profileAuth = require('../../utils/profile_auth.js')

Page({
  data: { token: '', busy: false, bound: false, message: '' },
  onLoad(options) {
    let token
    try { token = decodeURIComponent(options.scene || '') } catch (err) {
      if (!(err instanceof URIError)) throw err
      this.setData({ message: '二维码无效，请让店员重新生成' })
      return
    }
    if (!/^[0-9a-f]{24}$/.test(token)) {
      this.setData({ message: '二维码无效，请让店员重新生成' })
      return
    }
    this.setData({ token })
  },
  onPhone(e) {
    if (this.data.busy || this.data.bound || !this.data.token) return
    const code = e.detail && e.detail.code
    if (!code) {
      this.setData({ message: '请授权本人手机号后重试' })
      return
    }
    this.setData({ busy: true, message: '' })
    Promise.resolve(app.loginPromiseNew).then(() => {
      const url = app.globalData.requestPrefix + 'MemberWechatBind/Bind?sessionKey='
        + encodeURIComponent(app.globalData.sessionKey || '')
      return util.performWebRequest(url, { token: this.data.token, phoneCode: code })
    }).then(async () => {
      this.setData({ bound: true, message: '微信绑定成功' })
      await app.retryLogin()
      await profileAuth.ensureOn(this, true)
    }).catch(err => {
      console.warn('绑定微信失败', err)
      this.setData({ message: this.data.bound ? '绑定成功，登录刷新失败，请重新打开小程序' :
        (typeof err === 'string' ? err : '绑定失败，请重试') })
    }).finally(() => this.setData({ busy: false }))
  }
})

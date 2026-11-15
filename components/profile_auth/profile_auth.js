// components/profile_auth/profile_auth.js
// 顾客验证手机号之后授权头像和昵称的弹层（2026-11-14 用户要求）。已在 app.json 注册为全局组件 profile-auth。
// 用法：页面 wxml 放 <profile-auth id="profileAuth" />，手机号验证成功后 await profileAuth.ensureOn(this)（见 utils/profile_auth.js）。
//   ensure() 先问后端要不要弹（没有头像昵称才弹）；弹出来后等用户「保存」或「跳过」才完成；
//   不需要弹、后端没部署、没有会员、没有登录会话时立即完成。可以跳过；同一次运行里保存或跳过过就不再弹。
// 头像：<button open-type="chooseAvatar"> 拿到临时文件，保存时 wx.uploadFile 传到后端，后端存 S3；
// 昵称：<input type="nickname">，微信键盘上可以直接选「用微信昵称」。
const data = require('../../utils/data.js')
const profileAuth = require('../../utils/profile_auth.js')

// 不在文件顶部取 getApp()：每次用的时候再取，登录会话换了也能读到最新的
function currentApp() {
  return typeof getApp === 'function' ? getApp() : null
}

Component({
  data: {
    visible: false,
    avatarPath: '',
    nickName: '',
    canSave: false,
    saving: false,
    error: ''
  },
  lifetimes: {
    detached() {
      // 页面销毁时弹层还开着：放开等待，不能让页面的后续流程永远卡住
      this._finish()
    }
  },
  methods: {
    // 需要时弹出，等用户处理完才完成；永远不 reject
    ensure() {
      if (this._pending) return this._pending
      const run = this._run().catch(() => {}).then(() => { this._pending = null })
      this._pending = run
      return run
    },

    async _run() {
      const app = currentApp()
      const globalData = app && app.globalData
      const sessionKey = globalData && globalData.sessionKey
      if (typeof sessionKey !== 'string' || !sessionKey.trim()) return
      if (profileAuth.isDone(globalData, sessionKey)) return
      const res = await data.getMyProfilePromise(sessionKey)
      if (!profileAuth.needPrompt(res)) {
        // 已经存过资料：记下来，本次运行里「我的」页、付款页再显示时不用每次都去问后端
        if (profileAuth.hasProfile(res)) profileAuth.markDone(globalData, sessionKey)
        return
      }
      this._sessionKey = sessionKey
      this.setData({ visible: true, avatarPath: '', nickName: (res.data && res.data.nickName) || '', canSave: false, saving: false, error: '' })
      this._refreshCanSave()
      await new Promise(resolve => { this._resolve = resolve })
    },

    _finish() {
      if (this.data.visible) this.setData({ visible: false })
      const resolve = this._resolve
      this._resolve = null
      if (resolve) resolve()
    },

    _refreshCanSave() {
      this.setData({ canSave: profileAuth.canSave(this.data.nickName, this.data.avatarPath) })
    },

    onChooseAvatar(e) {
      const path = e && e.detail && e.detail.avatarUrl
      if (!path) return
      this.setData({ avatarPath: path, error: '' })
      this._refreshCanSave()
    },

    // type="nickname" 输入框：手动输入走 input / blur，选「用微信昵称」时走 change，都读 e.detail.value
    onNickInput(e) {
      this.setData({ nickName: (e && e.detail && e.detail.value) || '', error: '' })
      this._refreshCanSave()
    },

    async onSave() {
      if (this.data.saving) return
      const nickName = profileAuth.cleanNickName(this.data.nickName)
      const avatarPath = this.data.avatarPath
      if (!profileAuth.canSave(nickName, avatarPath)) {
        this.setData({ error: '请选择头像或填写昵称' })
        return
      }
      const app = currentApp()
      const sessionKey = this._sessionKey || (app && app.globalData && app.globalData.sessionKey)
      this.setData({ saving: true, error: '' })
      try {
        const res = await data.saveMyProfilePromise({ sessionKey, nickName, avatarPath })
        if (res && res.code === 0) {
          profileAuth.markDone(app && app.globalData, sessionKey)
          this.setData({ saving: false })
          if (typeof wx !== 'undefined' && wx.showToast) wx.showToast({ title: '已保存', icon: 'success' })
          this._finish()
          return
        }
        this.setData({ saving: false, error: (res && res.message) || '保存失败，请重试' })
      } catch (err) {
        this.setData({ saving: false, error: '网络不太稳定，保存没成功，请重试' })
      }
    },

    onSkip() {
      if (this.data.saving) return
      const app = currentApp()
      profileAuth.markDone(app && app.globalData, this._sessionKey || (app && app.globalData && app.globalData.sessionKey))
      this._finish()
    },

    // 遮罩、弹层上的点击和滑动不穿透到下面的页面
    noop() {}
  }
})

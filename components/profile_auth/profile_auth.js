// components/profile_auth/profile_auth.js
// 顾客验证手机号之后授权头像和昵称的弹层（2026-11-14 用户要求）。已在 app.json 注册为全局组件 profile-auth。
// 用法：页面 wxml 放 <profile-auth id="profileAuth" />，手机号验证成功后 await profileAuth.ensureOn(this)（见 utils/profile_auth.js）。
//   ensure() 先问后端要不要弹（没有头像昵称才弹）；弹出来后等用户「保存」或「跳过」才完成；
//   不需要弹、后端没部署、没有会员、没有登录会话时立即完成。可以跳过；同一次运行里保存或跳过过就不再弹。
//   edit()：「我的」页点顶部头像昵称时打开同一个弹层来修改（带出已存的昵称和头像，不看「已处理」，按钮是「取消」）。
//   资料不全（存过头像没存昵称，或反过来）后端也会说需要再问，弹层里带出已存的那一半，让顾客补齐。
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
    editing: false,
    avatarPath: '',
    currentAvatarUrl: '',
    nickName: '',
    hasNick: false,
    focusNick: false,
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
      return this._start(false)
    },

    // 「我的」页点顶部头像昵称：不看「已处理」，已有资料也能打开修改
    edit() {
      return this._start(true)
    },

    _start(editing) {
      if (this._pending) return this._pending
      const run = this._run(editing).catch(() => {}).then(() => { this._pending = null })
      this._pending = run
      return run
    },

    async _run(editing) {
      const app = currentApp()
      const globalData = app && app.globalData
      const sessionKey = globalData && globalData.sessionKey
      if (typeof sessionKey !== 'string' || !sessionKey.trim()) return
      if (!editing && profileAuth.isDone(globalData, sessionKey)) return
      const res = await data.getMyProfilePromise(sessionKey)
      if (editing) {
        // 会话还没有会员（没验证手机号）时没有资料可改：后端说不用弹、也没有更新时间
        if (!profileAuth.needPrompt(res) && !profileAuth.hasProfile(res)) return
      } else if (!profileAuth.needPrompt(res)) {
        // 已经存过完整资料：记下来，本次运行里「我的」页再显示时不用每次都去问后端
        if (profileAuth.hasProfile(res)) profileAuth.markDone(globalData, sessionKey)
        return
      }
      // 先确认顾客同意了小程序的隐私协议，再弹我们的弹层：没同意时昵称框会降级、头像选择会失败。
      // 顾客在微信弹出的隐私弹窗里点了不同意：本次运行里不再问（下次重新打开小程序再问）
      if (!(await profileAuth.requirePrivacy())) {
        profileAuth.markDone(globalData, sessionKey)
        return
      }
      const stored = (res && res.data) || {}
      const nickName = typeof stored.nickName === 'string' ? stored.nickName : ''
      this._sessionKey = sessionKey
      // 先填昵称、再选头像：弹出来时昵称框自动获得焦点，键盘上方直接出现「用微信昵称」；
      // 已经存过的昵称、头像带出来（资料不全时补齐、修改时改）
      this.setData({
        visible: true, editing: !!editing, avatarPath: '', currentAvatarUrl: stored.avatarUrl || '',
        nickName: nickName, hasNick: !!nickName.trim(), focusNick: true, canSave: false, saving: false, error: ''
      })
      this._refreshCanSave()
      await new Promise(resolve => { this._resolve = resolve })
    },

    _finish() {
      if (this.data.visible) this.setData({ visible: false, focusNick: false })
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

    // 保存走表单提交：以表单里昵称框此刻的内容为准，不依赖输入事件有没有触发过（2026-11-15 有一次头像存上了、昵称没带上）
    onSubmit(e) {
      const value = e && e.detail && e.detail.value
      if (value && typeof value.nickName === 'string' && value.nickName.trim() && value.nickName !== this.data.nickName) {
        this.setData({ nickName: value.nickName })
        this._refreshCanSave()
      }
      return this.onSave()
    },

    // 只选了头像、昵称是空的（本来也没存过昵称）：提示一下，免得以为昵称存上了
    _confirmAvatarOnly() {
      return new Promise(resolve => {
        if (typeof wx === 'undefined' || typeof wx.showModal !== 'function') { resolve(true); return }
        wx.showModal({
          title: '还没填昵称',
          content: '只保存头像吗？之后可以在「我的」页点头像补填昵称。',
          confirmText: '只保存头像',
          cancelText: '去填昵称',
          success: res => resolve(!!(res && res.confirm)),
          fail: () => resolve(true)
        })
      })
    },

    // 回到昵称框：先收焦点再给，输入框才会重新获得焦点
    _refocusNick() {
      this.setData({ focusNick: false }, () => this.setData({ focusNick: true }))
    },

    async onSave() {
      if (this.data.saving) return
      const nickName = profileAuth.cleanNickName(this.data.nickName)
      const avatarPath = this.data.avatarPath
      if (!profileAuth.canSave(nickName, avatarPath)) {
        this.setData({ error: '请选择头像或填写昵称' })
        return
      }
      if (!nickName && !this.data.hasNick) {
        const proceed = await this._confirmAvatarOnly()
        if (!proceed) {
          this._refocusNick()
          return
        }
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

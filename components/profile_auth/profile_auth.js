// components/profile_auth/profile_auth.js
// 顾客验证手机号之后授权头像和昵称的弹层（2026-11-14 用户要求）。已在 app.json 注册为全局组件 profile-auth。
// 用法：页面 wxml 放 <profile-auth id="profileAuth" />，手机号验证成功后 await profileAuth.ensureOn(this)（见 utils/profile_auth.js）。
//   ensure() 先问后端要不要弹（没有头像昵称才弹）；弹出来后等用户「保存」或「跳过」才完成；
//   不需要弹、后端没部署、没有会员、没有登录会话时立即完成。可以跳过；同一次运行里保存或跳过过就不再弹。
//   edit()：「我的」页点顶部头像昵称时打开同一个弹层来修改（带出已存的昵称和头像，不看「已处理」，按钮是「取消」）。
//   资料不全（存过头像没存昵称，或反过来）后端也会说需要再问，弹层里带出已存的那一半，让顾客补齐。
// 头像：<button open-type="chooseAvatar"> 拿到临时文件，保存时 wx.uploadFile 传到后端，后端存 S3；
// 昵称：<input type="nickname">（画成「点击获取昵称」按钮的样子），微信键盘上可以直接选「用微信昵称」。
// 点昵称、点头像都先弹「请稍候」toast，等微信自己的提示出来再收掉（见 _showWait / _hideWait）。
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
      // 已经存过的昵称、头像带出来（资料不全时补齐、修改时改）
      this.setData({
        visible: true, editing: !!editing, avatarPath: '', currentAvatarUrl: stored.avatarUrl || '',
        nickName: nickName, hasNick: !!nickName.trim(), canSave: false, saving: false, error: ''
      })
      this._refreshCanSave()
      // 用 modal 提示怎么操作（先昵称后头像，只缺一样就只写那一样）；顾客自己点开修改时不用提示。
      // 昵称框不自动聚焦：程序聚焦不是顾客点的，开发者工具报 invalid init scl: init before tap。modal 不拦弹层。
      if (!editing) this._showHint(!nickName.trim(), !stored.avatarUrl)
      await new Promise(resolve => { this._resolve = resolve })
    },

    _finish() {
      this._hideWait()
      if (this.data.visible) this.setData({ visible: false })
      const resolve = this._resolve
      this._resolve = null
      if (resolve) resolve()
    },

    _refreshCanSave() {
      this.setData({ canSave: profileAuth.canSave(this.data.nickName, this.data.avatarPath) })
    },

    onChooseAvatar(e) {
      this._hideWait()
      const path = e && e.detail && e.detail.avatarUrl
      if (!path) return
      this.setData({ avatarPath: path, error: '' })
      this._refreshCanSave()
    },

    // type="nickname" 输入框：手动输入走 input / blur，选「用微信昵称」时走 change，都读 e.detail.value
    onNickInput(e) {
      this._hideWait()
      this.setData({ nickName: (e && e.detail && e.detail.value) || '', error: '' })
      this._refreshCanSave()
    },

    // 点「点击获取昵称」：先弹「请稍候」，微信的昵称提示（键盘上方的「用微信昵称」）出来就收掉
    onNickTap() {
      this._showWait()
    },

    // 点头像：同样先弹「请稍候」，微信的头像选择出来（选好头像触发 chooseavatar）就收掉
    onAvatarTap() {
      this._showWait()
    },

    // 键盘升起来（高度 > 0）说明微信的昵称提示出来了；开发者工具里没有键盘，靠超时收掉
    onKeyboardHeight(e) {
      const height = e && e.detail && e.detail.height
      if (height > 0) this._hideWait()
    },

    // 「请稍候」toast：不挡操作（mask 为 false）；只会有一个，不叠；到点（默认 1.5 秒）自动收，免得微信没有事件可等时一直转
    _showWait() {
      if (this._waiting || typeof wx === 'undefined' || typeof wx.showLoading !== 'function') return
      this._waiting = true
      wx.showLoading({ title: '请稍候', mask: false })
      this._waitTimer = setTimeout(() => this._hideWait(), this.waitMs || 1500)
    },

    _hideWait() {
      if (this._waitTimer) { clearTimeout(this._waitTimer); this._waitTimer = null }
      if (!this._waiting) return
      this._waiting = false
      if (typeof wx !== 'undefined' && typeof wx.hideLoading === 'function') wx.hideLoading()
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

    // 弹层出来时的操作提示（只有「知道了」）
    _showHint(needNick, needAvatar) {
      const content = profileAuth.hintText({ needNick: needNick, needAvatar: needAvatar })
      if (!content || typeof wx === 'undefined' || typeof wx.showModal !== 'function') return
      wx.showModal({ title: '请授权昵称和头像', content: content, showCancel: false, confirmText: '知道了' })
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
        // 选了「去填昵称」就回到弹层，由顾客自己点昵称框
        const proceed = await this._confirmAvatarOnly()
        if (!proceed) return
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

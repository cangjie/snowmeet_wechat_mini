// components/profile_auth/profile_auth.js
// 顾客验证手机号之后授权头像和昵称的弹层（2026-11-14 用户要求）。已在 app.json 注册为全局组件 profile-auth。
// 用法：页面 wxml 放 <profile-auth id="profileAuth" />，手机号验证成功后 await profileAuth.ensureOn(this)（见 utils/profile_auth.js）。
//   ensure() 先问后端要不要弹（没有头像昵称才弹）；弹出来后等用户「保存」或「跳过」才完成；
//   不需要弹、后端没部署、没有会员、没有登录会话时立即完成。可以跳过；同一次运行里保存或跳过过就不再弹。
//   edit()：「我的」页点顶部头像昵称时打开同一个弹层来修改（带出已存的昵称和头像，不看「已处理」）。
//   资料不全（存过头像没存昵称，或反过来）后端也会说需要再问，弹层里带出已存的那一半，让顾客补齐。
// 头像选定后、昵称确认或失焦后分别自动保存；保存按钮只关闭弹层。
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
      this._autoSave = null
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
      this._autoSave = {
        sessionKey,
        nick: { saved: profileAuth.cleanNickName(nickName), desired: '', running: false, failed: false, message: '' },
        avatar: { saved: '', desired: '', running: false, failed: false, message: '' }
      }
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
      this.setData({ avatarPath: path })
      this._refreshCanSave()
      this._queueAutoSave('avatar', path)
    },

    // 输入过程中只更新画面，避免逐字上传；选择微信昵称或输入结束时保存。
    onNickInput(e) {
      this._hideWait()
      this.setData({ nickName: (e && e.detail && e.detail.value) || '' })
      this._refreshCanSave()
    },

    onNickCommit(e) {
      this.onNickInput(e)
      const nickName = profileAuth.cleanNickName(this.data.nickName)
      if (nickName) this._queueAutoSave('nick', nickName)
    },

    _queueAutoSave(field, value) {
      const state = this._autoSave
      if (!state || !value) return
      const item = state[field]
      // change 和 blur 可能对同一个值各触发一次，不要重复上传。
      if (item.desired === value && (item.running || item.saved === value || item.failed)) return
      if (!item.running && item.saved === value) {
        item.desired = value
        item.failed = false
        item.message = ''
        this._syncAutoSave(state)
        return
      }
      item.desired = value
      item.failed = false
      item.message = ''
      this._pumpAutoSave(state, field)
    },

    _pumpAutoSave(state, field) {
      const item = state[field]
      if (item.running || item.failed || !item.desired || item.desired === item.saved) {
        this._syncAutoSave(state)
        return
      }
      const value = item.desired
      item.running = true
      this._syncAutoSave(state)
      const options = {
        sessionKey: state.sessionKey,
        nickName: field === 'nick' ? value : '',
        avatarPath: field === 'avatar' ? value : ''
      }
      Promise.resolve().then(() => data.saveMyProfilePromise(options)).then(res => {
        if (!res || res.code !== 0) {
          const err = new Error((res && res.message) || '请重试')
          err.profileMessage = true
          throw err
        }
        item.saved = value
        item.failed = false
        item.message = ''
        if (field === 'nick' && this._autoSave === state) this.setData({ hasNick: true })
      }).catch(err => {
        // 已经选了新值时继续保存新值，不让旧请求的失败盖住它。
        item.failed = item.desired === value
        item.message = item.failed ? (err && err.profileMessage ? err.message : '网络不太稳定，请重试') : ''
      }).then(() => {
        item.running = false
        if (this._autoSave !== state) return
        this._pumpAutoSave(state, field)
      })
    },

    _syncAutoSave(state) {
      if (this._autoSave !== state) return
      const failed = ['nick', 'avatar'].filter(field => state[field].failed)
      const names = { nick: '昵称', avatar: '头像' }
      const error = failed.map(field => names[field] + '保存失败：' + state[field].message).join('；')
      this.setData({ saving: state.nick.running || state.avatar.running, error })
    },

    onRetrySave() {
      const state = this._autoSave
      if (!state) return
      for (const field of ['nick', 'avatar']) {
        if (!state[field].failed) continue
        state[field].failed = false
        state[field].message = ''
        this._pumpAutoSave(state, field)
      }
    },

    // 实际聚焦昵称输入框时记一笔；这不代表顾客已选择微信昵称。
    onNickTap() {
      this._showWait()
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
        const page = pages && pages.length ? pages[pages.length - 1] : null
        if (this.data.visible && this._sessionKey && typeof data.logNicknameClick === 'function') {
          data.logNicknameClick(this._sessionKey, (page && page.route) || '')
        }
      } catch (e) { /* 行为记录不能影响输入昵称 */ }
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

    // 弹层出来时的操作提示（只有「知道了」）
    _showHint(needNick, needAvatar) {
      const content = profileAuth.hintText({ needNick: needNick, needAvatar: needAvatar })
      if (!content || typeof wx === 'undefined' || typeof wx.showModal !== 'function') return
      wx.showModal({ title: '请授权昵称和头像', content: content, showCancel: false, confirmText: '知道了' })
    },

    onSave() {
      if (!this.data.canSave || this.data.saving || this.data.error) return
      const app = currentApp()
      const sessionKey = this._sessionKey || (app && app.globalData && app.globalData.sessionKey)
      profileAuth.markDone(app && app.globalData, sessionKey)
      this._finish()
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

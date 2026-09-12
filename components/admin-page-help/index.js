const data = require('../../utils/data.js')
const adminAssistant = require('../../utils/adminAssistant.js')

function ownerFromApp(app) {
  var globalData = app && app.globalData ? app.globalData : {}
  var staff = globalData.staff
  return {
    staffId: staff && staff.id != null ? String(staff.id) : null,
    sessionKey: globalData.sessionKey == null ? null : String(globalData.sessionKey)
  }
}

function sameOwner(left, right) {
  return !!left && !!right && left.staffId === right.staffId &&
    left.sessionKey === right.sessionKey && left.generation === right.generation
}

function samePendingRequest(pending, owner, token) {
  return !!pending && pending.token === token && sameOwner(pending.owner, owner)
}

Component({
  data: {
    visible: false,
    fabStyle: '',
    fabMoved: false,
    loading: false,
    pageKey: '',
    pageHelp: null,
    messages: [],
    queryHint: false,
    input: '',
    error: '',
    retryable: false,
    stopped: false,
    traceId: '',
    failureType: '',
    lastQuestion: '',
    lastAppendUserMessage: false,
    lastErrorMessage: ''
  },

  lifetimes: {
    attached() {
      var pages = getCurrentPages()
      var current = pages[pages.length - 1]
      this.setData({ pageKey: current && current.route ? current.route : '' })
    }
  },

  methods: {
    onOpen() {
      if (this._suppressFabTap) {
        return
      }
      this.syncUiOwner(getApp())
      this.setData({ visible: true })
      if (!this.data.pageHelp && !this.data.loading) this.loadPageHelp()
    },

    onFabTouchStart(event) {
      var touch = event.touches[0]
      var query = this.createSelectorQuery()
      query.select('.help-fab').boundingClientRect((rect) => {
        if (!rect) return
        var windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
        this._dragState = {
          moved: false,
          startX: touch.clientX,
          startY: touch.clientY,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          windowWidth: windowInfo.windowWidth,
          windowHeight: windowInfo.windowHeight
        }
      }).exec()
    },

    onFabTouchMove(event) {
      var state = this._dragState
      if (!state || !event.touches.length) return
      var touch = event.touches[0]
      var deltaX = touch.clientX - state.startX
      var deltaY = touch.clientY - state.startY
      if (!state.moved && Math.abs(deltaX) + Math.abs(deltaY) < 8) return
      state.moved = true
      var margin = 8
      var left = Math.max(margin, Math.min(state.windowWidth - state.width - margin, state.left + deltaX))
      var top = Math.max(margin, Math.min(state.windowHeight - state.height - margin, state.top + deltaY))
      this.setData({
        fabStyle: 'left: ' + left + 'px; top: ' + top + 'px;',
        fabMoved: true
      })
    },

    onFabTouchEnd() {
      if (!this._dragState) return
      if (this._dragState.moved) {
        this._suppressFabTap = true
        setTimeout(() => {
          this._suppressFabTap = false
        }, 120)
      }
      this._dragState = null
    },

    onClose() {
      this.setData({ visible: false })
    },

    onInput(event) {
      this.setData({ input: event.detail.value })
    },

    onQueryMode() {
      this.setData({ queryHint: true, error: '' })
    },

    stopRequest() {
      if (!this.data.loading) return
      var task = this._pendingTask
      this._pendingTask = null
      this._pendingRequest = null
      if (task && typeof task.abort === 'function') {
        try {
          task.abort()
        } catch (error) {
          // 请求已经结束时 abort 可能抛错，停止本身仍然算完成
        }
      }
      this.setData({
        loading: false, stopped: true, error: '', retryable: !!this.data.lastQuestion
      })
    },

    async onRetry() {
      var prepared = await this.prepareUiOwner()
      if (!this.isCurrentUiOwner(prepared.owner)) return
      if (!this.data.retryable || this.data.loading || !this.data.lastQuestion) return
      return this.requestAnswer(
        this.data.lastQuestion,
        this.data.lastAppendUserMessage,
        this.data.lastErrorMessage,
        prepared
      )
    },

    async loadPageHelp() {
      var prepared = await this.prepareUiOwner()
      if (!this.isCurrentUiOwner(prepared.owner)) return
      if (!this.data.pageKey) return
      return this.requestAnswer(
        '请说明当前页面的用途、标准操作步骤、关键限制和常见错误。',
        false,
        '暂时无法获取页面说明',
        prepared
      )
    },

    async sendQuestion() {
      var prepared = await this.prepareUiOwner()
      if (!this.isCurrentUiOwner(prepared.owner)) return
      var question = (this.data.input || '').trim()
      if (!question || this.data.loading) return
      if (question.length > 2000) {
        this.setData({ error: '问题不能超过 2000 个字符', retryable: false, lastQuestion: '' })
        return
      }
      return this.requestAnswer(question, true, '暂时无法获得回答', prepared)
    },

    async requestAnswer(question, appendUserMessage, errorMessage, prepared) {
      if (!this.isCurrentUiOwner(prepared.owner)) return
      var requestToken = (this._nextRequestToken || 0) + 1
      this._nextRequestToken = requestToken
      this._pendingRequest = { owner: prepared.owner, token: requestToken }
      this.setData({
        input: '', loading: true, error: '', retryable: false, stopped: false, traceId: '', failureType: '',
        lastQuestion: question, lastAppendUserMessage: appendUserMessage,
        lastErrorMessage: errorMessage
      })
      try {
        await this.ask(question, appendUserMessage, prepared, requestToken)
      } catch (error) {
        // 停止是用户主动行为，stopRequest 已经收好界面状态，这里不再报错
        if (typeof data.isAdminAssistantAbortError === 'function' &&
            data.isAdminAssistantAbortError(error)) return
        if (typeof data.isAdminAssistantStaleSessionError === 'function' &&
            data.isAdminAssistantStaleSessionError(error)) {
          if (this.isCurrentUiOwner(prepared.owner) &&
              samePendingRequest(this._pendingRequest, prepared.owner, requestToken)) {
            this._pendingRequest = null
            this._pendingTask = null
            this.setData({ loading: false })
          }
          return
        }
        if (!this.isCurrentUiOwner(prepared.owner) ||
            !samePendingRequest(this._pendingRequest, prepared.owner, requestToken)) return
        this._pendingRequest = null
        this._pendingTask = null
        this.setData({ loading: false, error: errorMessage, retryable: true })
      }
    },

    async ask(question, appendUserMessage, prepared, requestToken) {
      var app = prepared.app
      var conversation = this.data.messages
      var request = adminAssistant.buildRequest(this.data.pageKey, question, conversation, app.globalData.staff)
      var result = await data.askAdminAssistantPromise(request, app.globalData.sessionKey, task => {
        if (samePendingRequest(this._pendingRequest, prepared.owner, requestToken)) this._pendingTask = task
      })
      if (!this.isCurrentUiOwner(prepared.owner) ||
          !samePendingRequest(this._pendingRequest, prepared.owner, requestToken)) return
      this._pendingRequest = null
      this._pendingTask = null
      var failure = typeof data.getAdminAssistantFailure === 'function'
        ? data.getAdminAssistantFailure(result) : null
      if (!failure) adminAssistant.acceptContext(app.globalData.staff, result.context)
      var next = appendUserMessage ? conversation.concat([{ role: 'user', content: question }]) : conversation.slice()
      if (appendUserMessage) {
        next.push({ role: 'assistant', content: result.reply.text, citations: result.reply.citations || [] })
        this.setData({
          messages: next, input: '', loading: false,
          traceId: result.trace_id,
          failureType: failure ? failure.type : '',
          retryable: failure ? failure.retryable : false,
          lastQuestion: failure && failure.retryable ? question : ''
        })
      } else {
        this.setData({
          pageHelp: result.reply, input: '', loading: false,
          traceId: result.trace_id,
          failureType: failure ? failure.type : '',
          retryable: failure ? failure.retryable : false,
          lastQuestion: failure && failure.retryable ? question : ''
        })
      }
      if (failure) return
      if (!this.isCurrentUiOwner(prepared.owner)) return
      this._pendingActionOwner = prepared.owner
      var navigated = false
      try {
        adminAssistant.executeActions(result.actions, url => {
          if (!this.isCurrentUiOwner(prepared.owner) || !sameOwner(this._pendingActionOwner, prepared.owner)) return
          navigated = true
          wx.navigateTo({
            url,
            success: () => {
              if (sameOwner(this._pendingActionOwner, prepared.owner)) this._pendingActionOwner = null
            },
            fail: () => {
              if (!this.isCurrentUiOwner(prepared.owner) || !sameOwner(this._pendingActionOwner, prepared.owner)) return
              this._pendingActionOwner = null
              this.setData({
                error: '当前版本暂不支持此操作，请升级后重试', retryable: false, lastQuestion: ''
              })
            }
          })
        })
        if (!navigated) this._pendingActionOwner = null
      } catch (error) {
        if (!this.isCurrentUiOwner(prepared.owner) || !sameOwner(this._pendingActionOwner, prepared.owner)) return
        this._pendingActionOwner = null
        this.setData({ error: '当前版本暂不支持此操作，请升级后重试', retryable: false, lastQuestion: '' })
      }
    },

    async prepareUiOwner() {
      var app = getApp()
      await app.loginPromiseNew
      return { app: app, owner: this.syncUiOwner(app) }
    },

    syncUiOwner(app) {
      var next = ownerFromApp(app)
      if (!this._uiOwner) {
        next.generation = 1
        this._uiOwner = next
        return next
      }
      if (this._uiOwner && this._uiOwner.staffId === next.staffId && this._uiOwner.sessionKey === next.sessionKey) {
        return this._uiOwner
      }
      next.generation = this._uiOwner.generation + 1
      this._uiOwner = next
      this._pendingRequest = null
      this._pendingTask = null
      this._pendingActionOwner = null
      this.setData({
        pageHelp: null, messages: [], queryHint: false, input: '', loading: false,
        error: '', retryable: false, stopped: false, traceId: '', failureType: '', lastQuestion: '',
        lastAppendUserMessage: false, lastErrorMessage: ''
      })
      return next
    },

    isCurrentUiOwner(owner) {
      var current = ownerFromApp(getApp())
      if (!this._uiOwner || this._uiOwner.staffId !== current.staffId || this._uiOwner.sessionKey !== current.sessionKey) {
        this.syncUiOwner(getApp())
        return false
      }
      return sameOwner(this._uiOwner, owner)
    }
  }
})

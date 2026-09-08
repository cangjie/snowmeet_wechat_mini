const data = require('../../utils/data.js')

Component({
  data: {
    visible: false,
    fabStyle: '',
    fabMoved: false,
    loading: false,
    pageKey: '',
    pageHelp: null,
    messages: [],
    queryMode: false,
    input: '',
    error: ''
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
      this.setData({ queryMode: true, error: '' })
    },

    onRetry() {
      this.setData({ error: '' })
      if (this.data.pageHelp) this.sendQuestion()
      else this.loadPageHelp()
    },

    async loadPageHelp() {
      if (!this.data.pageKey) return
      this.setData({ loading: true, error: '' })
      try {
        var app = getApp()
        await app.loginPromiseNew
        var result = await data.getAdminPageHelpPromise(this.data.pageKey, app.globalData.sessionKey)
        this.setData({ pageHelp: result.result, loading: false })
      } catch (error) {
        this.setData({ loading: false, error: '暂时无法获取页面说明' })
      }
    },

    async sendQuestion() {
      var question = (this.data.input || '').trim()
      if (!question || this.data.loading) return
      if (this.data.queryMode) {
        this.queryRentOrders(question)
        return
      }
      var nextMessages = this.data.messages.concat([{ role: 'user', content: question }])
      this.setData({ messages: nextMessages, input: '', loading: true, error: '' })
      try {
        var app = getApp()
        await app.loginPromiseNew
        var result = await data.askAdminPageHelpPromise(this.data.pageKey, question, app.globalData.sessionKey, {
          conversation: this.data.messages
        })
        nextMessages.push({ role: 'assistant', content: result.result.answer, citations: result.result.citations || [] })
        this.setData({ messages: nextMessages, loading: false })
      } catch (error) {
        this.setData({ loading: false, error: '暂时无法获得回答' })
      }
    },

    async queryRentOrders(question) {
      this.setData({ loading: true, error: '' })
      try {
        var app = getApp()
        await app.loginPromiseNew
        var result = await data.queryRentOrdersByNaturalLanguagePromise(question, app.globalData.sessionKey)
        if (result.status && result.status !== 'ready') {
          this.setData({ messages: this.data.messages.concat([{ role: 'assistant', content: result.clarification || '请补充查询条件后再试。' }]), loading: false })
          return
        }
        var summary = result.summary || {}
        var parts = ['已按条件查询 ' + (summary.total || 0) + ' 单租赁订单。']
        if (summary.chargeTotal != null) parts.push('应收合计 ¥' + Number(summary.chargeTotal).toFixed(2) + '；实收 ¥' + Number(summary.paidTotal || 0).toFixed(2) + '；退款 ¥' + Number(summary.refundTotal || 0).toFixed(2) + '。')
        if (summary.unpaidCount > 0) parts.push('其中有 ' + summary.unpaidCount + ' 单尚未完成支付，建议优先核对。')
        if (summary.note) parts.push(summary.note)
        this.setData({
          messages: this.data.messages.concat([{ role: 'user', content: question }, { role: 'assistant', content: parts.join('\n') }]),
          input: '', queryMode: false, loading: false
        })
      } catch (error) {
        this.setData({ loading: false, error: '暂时无法完成数据查询' })
      }
    }
  }
})
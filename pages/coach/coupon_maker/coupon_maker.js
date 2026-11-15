// 机构「制作优惠券」：按管理员设的底价（和会员卡共用）生成一批自己的优惠券，放进自己的券包，
// 再到「我的优惠券」转发给顾客。券价不能低于底价；每张券限用一次，只用于该店单项 / 双项养护，加急加价、维修费照收。
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/coach-view.js')

Page({
  data: {
    blocked: '', loading: true, canMake: false, reason: '', name: '', validUntil: '',
    cells: [], recent: [], outstanding: 0, maxOutstanding: 0,
    sel: -1, selHint: '', selModes: [], mode: '', valueText: '', countText: '10', submitting: false
  },

  onLoad() { base.boot(this, 'coach').then(() => this.load()).catch(() => {}) },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh()) },

  apply(d) {
    this.setData({
      loading: false, blocked: '', canMake: !!d.canMake, reason: d.reason || '', name: d.name || '',
      validUntil: view.dayText(d.validUntil), cells: view.couponCells(d.cells), recent: d.recent || [],
      outstanding: d.outstanding || 0, maxOutstanding: d.maxOutstanding || 0
    })
  },

  load() {
    return api.getMyCouponMaker().then(d => this.apply(d)).catch(err => {
      this.setData({ loading: false })
      if (err && err.code === 3) this.setData({ blocked: '你还不是教练或机构' })
      else base.fail(err)
    })
  },

  // 表单变了就换一个请求编号：同一份表单重试（网络不好）用同一个编号，服务端不会重复生成
  touch() { this._requestId = '' },

  onCell(e) {
    if (!this.data.canMake) return
    const i = Number(e.currentTarget.dataset.i)
    const cell = this.data.cells[i]
    if (!cell.available) { wx.showToast({ title: cell.hint, icon: 'none' }); return }
    this.touch()
    this.setData({ sel: i, selHint: cell.hint, selModes: cell.modes, mode: cell.modes.length === 1 ? cell.modes[0].key : '', valueText: '' })
  },
  onMode(e) { this.touch(); this.setData({ mode: e.currentTarget.dataset.mode, valueText: '' }) },
  onValue(e) { this.touch(); this.setData({ valueText: e.detail.value }) },
  onCount(e) { this.touch(); this.setData({ countText: e.detail.value }) },

  onSubmit() {
    if (!this.data.canMake || this.data.submitting) return
    const cell = this.data.sel >= 0 ? this.data.cells[this.data.sel] : null
    const r = view.couponPayload(cell, this.data.mode, this.data.valueText, this.data.countText)
    if (r.error) { wx.showToast({ title: r.error, icon: 'none', duration: 2800 }); return }
    if (!this._requestId) this._requestId = 'c' + Date.now() + Math.floor(Math.random() * 1000000)
    this.setData({ submitting: true })
    api.makeMyCoupons(Object.assign({ requestId: this._requestId }, r)).then(res => {
      this._requestId = ''
      this.apply(res.maker)
      this.setData({ submitting: false })
      base.done(res.made.repeated ? '这批券之前已经生成过了' : '已生成 ' + res.made.created + ' 张，放进了你的券包')
    }).catch(err => {
      this.setData({ submitting: false })
      base.fail(err)
    })
  },

  onGoCoupons() { wx.navigateTo({ url: '/pages/coach/home/home?tab=coupons' }) }
})

// 学员订单明细（教练）：自领卡/接券当天起的全部已付消费，用了学员卡优惠的订单打标记
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/coach-view.js')

Page({
  data: { blocked: '', loading: true, student: null, orders: [] },

  onLoad(options) {
    this.memberId = Number(options.id)
    base.boot(this, 'coach').then(() => this.load()).catch(() => {})
  },

  load() {
    return api.getStudentOrders(this.memberId).then(d => {
      const s = d.student
      this.setData({
        loading: false,
        student: Object.assign({}, s, {
          sourceText: s.sources.map(x => (x === 'card' ? '学员卡' : '优惠券')).join(' · '), since: view.dayText(s.since)
        }),
        orders: d.orders.map(o => Object.assign({}, o, { day: view.dayText(o.date) }))
      })
      wx.setNavigationBarTitle({ title: s.name })
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  }
})

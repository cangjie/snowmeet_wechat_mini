const api = require('../../../../utils/introducer_api.js')

Page({
  data: { blocked: '', code: '', orderId: 0, orderLabel: '', loading: false },
  onLoad(options) {
    return Promise.resolve(getApp().loginPromiseNew).then(() => {
      const staff = getApp().globalData.staff
      if (!(staff && staff.valid === 1 && staff.title_level >= 200)) {
        this.setData({ blocked: '只有店长以上可以查看订单分账' })
        return
      }
      const orderId = Number(options && options.orderId) || 0
      if (orderId) this.setData({ orderId, orderLabel: '订单编号 ' + orderId })
    }).catch(api.fail)
  },
  onCode(e) { this.setData({ code: e.detail.value }) },
  onFind() {
    if (this.data.loading) return Promise.resolve()
    const code = (this.data.code || '').trim()
    if (!code) { wx.showToast({ title: '请填写完整订单号', icon: 'none' }); return Promise.resolve() }
    this.setData({ loading: true, orderId: 0, orderLabel: '' })
    return api.findShareOrder(code).then(order => {
      this.setData({ loading: false, orderId: order.orderId, orderLabel: order.orderCode + ' · ' + order.orderType })
    }).catch(err => { this.setData({ loading: false }); api.fail(err) })
  }
})

// pages/payment/rent_settle/index.js
// 租赁结算页：根据 orderId 渲染订单卡片 + 支付组件。
Page({
  data: {
    orderId: 0
  },
  onLoad(query) {
    var orderId = parseInt(query && query.orderId, 10) || 0
    this.setData({ orderId: orderId })
  },
  onPaid(e) {
    // TODO: 支付成功后的后续处理（跳转、刷新等）待后续讨论
    console.log('rent_settle paid', e.detail)
  },
  onBack() {
    wx.navigateBack({ delta: 1 })
  }
})

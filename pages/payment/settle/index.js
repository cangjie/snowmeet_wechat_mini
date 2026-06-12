// pages/payment/settle/index.js
// 通用结算页：根据 orderId 渲染订单卡片 + 支付组件，
// 租赁 / 养护 / 零售等业务通用，调用方带 orderId 跳入即可。
Page({
  data: {
    orderId: 0
  },
  onLoad(query) {
    var orderId = parseInt(query && query.orderId, 10) || 0
    this.setData({ orderId: orderId })
  },
  onPaid(e) {
    // 顾客支付成功后，提示店员选择下一步：查看订单详情 / 继续开下一单。
    // paid 事件 detail = { orderId, payMethod, order }
    var that = this
    var detail = e.detail || {}
    var orderId = detail.orderId || that.data.orderId
    var payMethod = detail.payMethod || ''
    console.log('settle paid', detail)
    wx.showModal({
      title: '收款成功',
      content: payMethod ? ('已通过「' + payMethod + '」完成收款') : '订单已完成收款',
      confirmText: '查看订单',   // wx.showModal 按钮文案上限 4 字
      cancelText: '继续开单',
      success: function (res) {
        if (res.confirm) {
          // 查看订单详情：用 redirectTo 替换已完成的结算页（当前迭代仅租赁，详情页为 rent_details）
          wx.redirectTo({ url: '/pages/admin/rent/rent_details?id=' + orderId })
        } else if (res.cancel) {
          // 继续开下一单：reLaunch 回开单入口，重置整条栈（与 reception-tabbar「开单」一致）
          wx.reLaunch({ url: '/pages/admin/reception/recept_entry' })
        }
      }
    })
  },
  onBack() {
    wx.navigateBack({ delta: 1 })
  }
})

// pages/payment/settle/index.js
// 通用结算页：根据 orderId 渲染订单卡片 + 支付组件，
// 租赁 / 养护 / 零售等业务通用，调用方带 orderId 跳入即可。
const careCards = require('../../../utils/careCardSale.js')
Page({
  data: {
    orderId: 0,
    careOrderId: 0,
    cardPreview: null,
    cardCompletionBusy: false,
    cardCompletionError: ''
  },
  onLoad(query) {
    var orderId = parseInt(query && query.orderId, 10) || 0
    var careOrderId = parseInt(query && query.careOrderId, 10) || 0
    this.setData({ orderId: orderId, careOrderId: careOrderId })
    if (careOrderId) getApp().loginPromiseNew.then(() => this.loadCardPreview())
  },
  onPaid(e) {
    var detail = e.detail || {}
    var linked = detail.order && detail.order.careCardSale
    var careOrderId = this.data.careOrderId || (linked && linked.careOrderId)
    if (careOrderId) {
      this.setData({ careOrderId: careOrderId })
      this._cardPaidEvent = e
      return this.onCardCompletionRetry()
    }
    this._showPaidResult(e)
  },
  async loadCardPreview() {
    try {
      var draft = await careCards.request('GetDraft', null, this.data.careOrderId)
      this.setData({ cardPreview: careCards.displayPreview(draft.preview, []) })
    } catch (e) { console.warn('load card summary failed', e) }
  },
  async onCardCompletionRetry() {
    if (this.data.cardCompletionBusy || this._cardCompletedShown) return
    this.setData({ cardCompletionBusy: true, cardCompletionError: '' })
    try {
      await careCards.request('RetryCompletion', {}, this.data.careOrderId)
      this._cardCompletedShown = true
      await this.loadCardPreview()
      var detail = (this._cardPaidEvent && this._cardPaidEvent.detail) || {}
      this._showPaidResult({ detail: Object.assign({}, detail, { orderId: this.data.careOrderId,
        order: Object.assign({}, detail.order || {}, { type: '养护' }) }) })
    } catch (e) {
      this.setData({ cardCompletionError: '款已收到，发卡或养护核销尚未完成，请重试处理。请勿再次收款。' })
    } finally { this.setData({ cardCompletionBusy: false }) }
  },
  _showPaidResult(e) {
    // 顾客支付成功后，提示店员选择下一步：查看订单详情 / 继续开下一单。
    // paid 事件 detail = { orderId, payMethod, order }
    var that = this
    var detail = e.detail || {}
    var orderId = detail.orderId || that.data.orderId
    var payMethod = detail.payMethod || ''
    var orderType = ((detail.order && detail.order.type) || '').trim()
    console.log('settle paid', detail)
    wx.showModal({
      title: '收款成功',
      content: that.data.careOrderId ? '购卡收款完成，卡已发放，本次养护已自动扣次生效。'
        : (payMethod ? ('已通过「' + payMethod + '」完成收款') : '订单已完成收款'),
      confirmText: '查看订单',   // wx.showModal 按钮文案上限 4 字
      cancelText: '继续开单',
      success: function (res) {
        if (res.confirm) {
          // 查看订单详情：按 order.type 路由（养护 / 零售各自的详情页，其余默认租赁详情页）
          var detailUrl = '/pages/admin/rent/rent_order_detail/rent_order_detail?id=' + orderId
          if (orderType === '养护') {
            detailUrl = '/pages/admin/care/care_order_detail/care_order_detail?id=' + orderId
          } else if (orderType === '零售') {
            detailUrl = '/pages/admin/retail/retail_order_detail?id=' + orderId
          }
          wx.redirectTo({ url: detailUrl })
        } else if (res.cancel) {
          // 继续开下一单：reLaunch 回开单入口，重置整条栈（与 reception-tabbar「开单」一致）
          wx.reLaunch({ url: '/pages/admin/reception/recept_scan' })
        }
      }
    })
  },
  onBack() {
    wx.navigateBack({ delta: 1 })
  }
})

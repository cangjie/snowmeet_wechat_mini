// pages/punchcard/punchcard_confirm.js
// 顾客自助购买次卡·确认支付页：下单后先让顾客核对「买了什么 / 几张 / 多少钱 / 使用规则」，
// 确认无误再在本页直接调起微信支付。
//
// ⚠️ 顾客自助**不走** /pages/payment/settle —— 那是店员开单收银页（生成二维码给顾客扫，
// 还带现金/挂账/支付宝等店员才用得到的收款方式）。小程序内顾客只能微信支付，所以这里
// 是一条独立的、只有微信支付的链路：
//   Rent/StartMyPunchCardPayment（建待支付单，顾客会话可用）
//   → Order/WechatPayByOrderPayment（换预支付参数）
//   → wx.requestPayment
// 支付成功后由后端 DealSuccessPaidOrder 的「零售」分支在 punch_card 表建卡，本页不管发卡。
var app = getApp()
var util = require('../../utils/util.js')
var data = require('../../utils/data.js')

Page({
  data: {
    orderId: 0,
    info: null,
    amountStr: '',
    unitPriceStr: '',
    loading: true,
    paying: false,
    paidDone: false      // 本次支付成功后置位，页面切成结果态
  },

  onLoad(options) {
    var orderId = parseInt(options.orderId, 10) || 0
    this.setData({ orderId: orderId })
    var that = this
    app.loginPromiseNew.then(function () {
      that.getData()
    })
  },

  getData() {
    var that = this
    if (!that.data.orderId) {
      that.setData({ loading: false })
      return
    }
    data.getMyPunchCardOrderPromise(that.data.orderId, app.globalData.sessionKey).then(function (info) {
      info = info || {}
      var product = info.product || {}
      // 季卡不限次数，「约 ¥x/次」对它没有意义
      var unitPriceStr = ''
      if (!product.isSeason && product.punch_total > 0 && info.quantity > 0) {
        unitPriceStr = util.showAmount(info.amount / (product.punch_total * info.quantity))
      }
      that.setData({
        info: info,
        amountStr: util.showAmount(info.amount),
        unitPriceStr: unitPriceStr,
        loading: false
      })
    }).catch(function () {
      wx.showToast({ title: '订单加载失败', icon: 'none' })
      that.setData({ loading: false })
    })
  },

  onPay() {
    var that = this
    if (that.data.paying || !that.data.orderId) { return }
    var info = that.data.info
    if (!info || info.paid || info.closed) { return }
    that.setData({ paying: true })
    wx.showLoading({ title: '正在发起支付', mask: true })
    var sessionKey = app.globalData.sessionKey
    data.startMyPunchCardPaymentPromise(that.data.orderId, sessionKey).then(function (res) {
      var paymentId = res && res.paymentId
      if (!paymentId) { return Promise.reject('no payment') }
      // 换预支付参数：复用顾客扫码支付落地页同一个接口（它本来就是按会员 openid 申请 prepay 的）
      var url = app.globalData.requestPrefix + 'Order/WechatPayByOrderPayment/' + paymentId + '?sessionKey=' + sessionKey
      return util.performWebRequest(url, null)
    }).then(function (payParams) {
      wx.hideLoading()
      // 参数形状与 pages/order/payment_entry 的 _doWepay 保持一致：
      // package 要自己拼 'prepay_id='，signType 用 MD5（那条链路是线上跑通的顾客支付路径）
      if (!payParams || !payParams.prepay_id) { return Promise.reject('no prepay') }
      wx.requestPayment({
        timeStamp: payParams.timestamp,
        nonceStr: payParams.nonce,
        package: 'prepay_id=' + payParams.prepay_id,
        signType: 'MD5',
        paySign: payParams.sign,
        success: function () {
          that.setData({ paying: false, paidDone: true })
          // 微信回调到后端有延迟，这里只提示成功；卡由后端支付回调创建
          wx.showToast({ title: '支付成功', icon: 'success' })
        },
        fail: function (err) {
          that.setData({ paying: false })
          // 用户主动取消不算失败，不弹错误提示
          var msg = (err && err.errMsg) || ''
          if (msg.indexOf('cancel') < 0) {
            wx.showToast({ title: '支付未完成', icon: 'none' })
          }
        }
      })
    }).catch(function (err) {
      wx.hideLoading()
      that.setData({ paying: false })
      console.error('次卡支付发起失败', err)
      wx.showToast({ title: '发起支付失败', icon: 'none' })
    })
  },

  onViewMyCards() {
    // 支付回调可能还没落库，这里 redirect 过去由「我的次卡」自己 onShow 拉最新数据
    wx.redirectTo({ url: '/pages/mine/my_punchcards' })
  },

  onImageError() {
    this.setData({ 'info.product.imageUrl': '' })
  }
})

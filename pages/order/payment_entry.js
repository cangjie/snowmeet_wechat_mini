// pages/order/payment_entry.js
const app = getApp()
const data = require('../../utils/data.js')
const util = require('../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    paying: false,
    paymentId: 0,
    scannerId: '',
    identity: null   // CheckPayerIdentityResult；status 决定渲染哪段 UI
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var paymentId = options.paymentId
    var that = this
    that.setData({paymentId})
    if (options.q != undefined){
      var url = decodeURIComponent(options.q)
      console.log('scan url', url)
      var urlArr = url.split('?')
      var queryStr = urlArr[urlArr.length - 1]
      paymentId = parseInt(queryStr.replace('paymentId=', ''))
      that.setData({paymentId})
    }
  },
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {
    var that = this
    app.loginPromiseNew.then(function (resolve){
      // 从 globalData 取扫码方 openid（登录后由 MemberLogin 写入 app.globalData.member）
      var member = app.globalData.member || {}
      that.setData({ scannerId: member.wechatMiniOpenId || '' })
      data.getOrderFromPaymentByCustomer(that.data.paymentId, app.globalData.sessionKey).then(function (order){
        that.renderData(order)
        that._refreshIdentity()
      })
    })
  },

  // 拉 PaymentIdentity/CheckPayerIdentity，结果写到 data.identity 驱动 UI
  // scannerId 拿不到时不报错 — 后端会用 sessionKey 反查 mini_session 兜底
  _refreshIdentity() {
    var that = this
    if (!that.data.paymentId) {
      that.setData({ identity: { status: 'error', errorCode: 'no_payment_id', errorMessage: '支付参数缺失' } })
      return
    }
    data.checkPayerIdentityPromise(that.data.paymentId, 'wechat', that.data.scannerId || '', app.globalData.sessionKey)
      .then(function (result) {
        that.setData({ identity: result })
      })
      .catch(function () {
        // performWebRequest 已 toast；这里补一个 inline 提示
        that.setData({ identity: { status: 'error', errorCode: 'check_failed', errorMessage: '身份验证查询失败，请重试' } })
      })
  },

  // 子组件 ConfirmPayIdentity 落库后回调，刷新本地 identity
  // status 转 direct 时自动重拉订单后调起微信支付，让顾客「一次点击完成支付」
  onIdentityRefreshed(e) {
    var that = this
    var result = e && e.detail && e.detail.result
    if (!result) return
    if (result.status === 'direct') {
      that.setData({ identity: result })
      data.getOrderFromPaymentByCustomer(that.data.paymentId, app.globalData.sessionKey).then(function (order){
        that.renderData(order)
        that.pay()
      }).catch(function () {
        // 拉单失败不卡死用户：identity 已是 direct，wxml 会显示「敬请支付」让用户手动点重试
      })
      return
    }
    that.setData({ identity: result })
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  },
  renderData(order){
    var that = this
    order.paying_amountStr = util.showAmount(order.paying_amount)
    order.paidAmountStr = util.showAmount(order.paidAmount)
    order.total_amountStr = util.showAmount(order.total_amount)
    order.dataStr = util.formatDate(new Date(order.biz_date))
    order.timeStr = util.formatTimeStr(new Date(order.biz_date))
    var payment = null
    for (var i = 0; order.payments && i < order.payments.length; i++){
      if (order.payments[i].valid == 1 && order.payments[i].pay_method == '微信支付' && order.payments[i].status == '待支付'){
        payment = order.payments[i]
      }
    }
    if (order.type == '租赁' && order.rentals && order.rentals.length){
      for (var r = 0; r < order.rentals.length; r++){
        var rental = order.rentals[r]
        if (!rental.rentItems){
          rental.rentItems = []
        }
        var firstItemName = rental.rentItems[0] ? rental.rentItems[0].name : ''
        rental.displayName = rental.name || firstItemName || '租赁'
        rental.guarantyStr = util.showAmount(rental.guaranty || 0)
        rental.totalRentalAmountStr = util.showAmount(rental.totalRentalAmount || 0)
        rental.expanded = false
        for (var k = 0; k < rental.rentItems.length; k++){
          var item = rental.rentItems[k]
          item.categoryName = (item.category && item.category.name) || item.class_name || '-'
        }
      }
    }
    that.setData({order, payment})
  },
  toggleRental(e){
    var idx = e.currentTarget.dataset.index
    var key = 'order.rentals[' + idx + '].expanded'
    this.setData({ [key]: !this.data.order.rentals[idx].expanded })
  },
  pay(){
    var that = this
    // 身份验证未通过前不可发起支付（防止 wxml 漏判 / 用户手动触发）
    var identity = that.data.identity
    if (!identity || identity.status !== 'direct') {
      wx.showToast({ title: '请先完成支付身份确认', icon: 'none' })
      return
    }
    var payment = that.data.payment
    if (!payment) {
      wx.showToast({ title: '支付状态已变更，请刷新', icon: 'none' })
      return
    }
    if (payment.pay_method != '微信支付' || payment.status != '待支付'){
      wx.showToast({ title: '不可支付', icon: 'error' })
      return
    }
    that.setData({paying: true})
    var payUrl = app.globalData.requestPrefix + 'Order/WechatPayByOrderPayment/' + payment.id + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(payUrl, null).then(function (payParams){
      wx.requestPayment({
        nonceStr: payParams.nonce,
        package: 'prepay_id=' + payParams.prepay_id,
        paySign: payParams.sign,
        timeStamp: payParams.timestamp,
        signType: 'MD5',
        success: (res) => {
          wx.showToast({ title: '支付成功', icon: 'success' })
          data.getOrderFromPaymentByCustomer(that.data.paymentId, app.globalData.sessionKey).then(function (order){
            that.renderData(order)
            that.setData({paying: false})
          }).catch(function () {
            that.setData({paying: false})
          })
        },
        fail: (res) => {
          console.log('payment fail', res)
          that.setData({paying: false})
        }
      })
    }).catch(function () {
      // performWebRequest 内已 toast，这里复位 paying 让用户重试
      that.setData({paying: false})
    })
  }
})
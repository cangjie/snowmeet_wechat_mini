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
    identity: null,        // CheckPayerIdentityResult；status 决定渲染哪段 UI
    orderLoadFailed: false // GetOrderFromPaymentByCustomer 失败时为 true，wxml 走 fallback 视图(最小订单卡 + 继续支付)
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
      console.log('[payment_entry] globalData.member', { id: member.id, cell: member.cell, wechatMiniOpenId: member.wechatMiniOpenId })
      that.setData({ scannerId: member.wechatMiniOpenId || '' })
      data.getOrderFromPaymentByCustomer(that.data.paymentId, app.globalData.sessionKey).then(function (order){
        that.setData({ orderLoadFailed: false })
        that.renderData(order)
        that._refreshIdentity()
      }).catch(function (err){
        // 散客 / sessionKey 失效 / 后端 code!=0 → 不卡死页面,走 fallback 视图让用户仍能继续支付
        // _refreshIdentity 不依赖 order,仍要拉以驱动支付按钮 + 软授权
        console.warn('getOrderFromPaymentByCustomer failed', err)
        that.setData({ orderLoadFailed: true, order: null, payment: null })
        that._refreshIdentity()
      })
    }).catch(function (err){
      // loginPromiseNew 失败极少见,兜底防整页 stall
      console.warn('loginPromiseNew failed', err)
      that.setData({ orderLoadFailed: true })
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
        console.log('[CheckPayerIdentity]', {
          status: result.status,
          scannerMemberId: result.scannerMemberId,
          scannerHasCell: result.scannerHasCell,
          scannerMaskedCell: result.scannerMaskedCell,
          orderMemberId: result.orderMemberId,
          orderMemberMaskedCell: result.orderMemberMaskedCell,
          orderMemberName: result.orderMemberName
        })
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
  // 「敬请支付」入口:status=direct 时显示,直接调起微信支付。
  // 手机号授权环节在 pay-identity-confirm 的「确认并继续」按钮(getPhoneNumber)里已处理过,
  // 走到这里时身份决策已落定,scanner 已与 order 归属一致,无需再弹任何授权 UI。
  pay(){
    var that = this
    var identity = that.data.identity
    if (!identity || identity.status !== 'direct') {
      wx.showToast({ title: '请先完成支付身份确认', icon: 'none' })
      return
    }
    var payment = that.data.payment
    // payment 拿到了 → 校验 method/status;没拿到(fallback 路径,order 加载失败) → 跳过校验,直接交给后端 paymentId
    if (payment) {
      if (payment.pay_method != '微信支付' || payment.status != '待支付'){
        wx.showToast({ title: '不可支付', icon: 'error' })
        return
      }
    }
    that._doWepay()
  },

  // 实际调起微信支付的逻辑(单一入口:pay() 唯一调用方)。
  // 拆出来保留是为了 onIdentityRefreshed 收到 status=direct 时也能自动 pay 不重复 wxml 校验。
  _doWepay(){
    var that = this
    var payment = that.data.payment
    // fallback 路径(order 加载失败) payment 为 null,直接用 data.paymentId 兜底
    var pid = (payment && payment.id) || that.data.paymentId
    if (!pid) {
      wx.showToast({ title: '支付参数缺失', icon: 'none' })
      return
    }
    that.setData({paying: true})
    var payUrl = app.globalData.requestPrefix + 'Order/WechatPayByOrderPayment/' + pid + '?sessionKey=' + app.globalData.sessionKey
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
      that.setData({paying: false})
    })
  },

})
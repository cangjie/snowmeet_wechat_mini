// pages/admin/fd/fd_order_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    showMemo: false,
    editingOrderMemo: false,
    showCharge: false,
    customerPayType: '整单支付',
    refundType: '全额退款',
    paylistValid: false,
    payList: [
      { amount: null, payMethod: null, OrderStatus: '待生成' },
      { amount: null, payMethod: null, OrderStatus: '待生成' }
    ],
    paying: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var orderId = options.orderId
    that.setData({ orderId })
  },
  onReady() {

  },
  onShow() {
    var that = this
    app.loginPromiseNew.then(function (resolve) {
      that.getOrderPromise(that.data.orderId).then(function (resolve) {
        that.renderOrder(resolve)
      })
      /*
      that.getOrderStatusLogPromise(that.data.orderId).then(function (resolve) {
        console.log('get logs', resolve)
        that.renderOrderStatusLog(resolve)
      })
      */
      that.getLogsPromise('order', 'orderstate', that.data.orderId).then(function (resolve) {
        console.log('get logs', resolve)
        that.renderOrderStatusLog(resolve)
      })
      /*
      that.getOrderMemoLogPromise(that.data.orderId).then(function (resolve) {
        that.renderOrderMemoLog(resolve)
      })
      */
      that.getLogsPromise('order', 'memo', that.data.orderId).then(function (resolve) {
        console.log('get logs', resolve)
        that.renderOrderMemoLog(resolve)
      })

    })
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
  displayMemo() {
    var that = this
    that.setData({ showMemo: true })
  },
  closeMemo() {
    var that = this
    that.setData({ showMemo: false, showOrderStatusLog: false, showOrderMemoLog: false, showFdMemoLog: false })
  },
  getOrderPromise(id) {
    var that = this
    return new Promise(function (resolve, reject) {
      var getUrl = app.globalData.requestPrefix + 'Order/GetOrderByStaff/' + id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      util.performWebRequest(getUrl, null).then(function (order) {
        resolve(order)
      }).catch(function (reject) { })
    })
  },
  renderOrder(order) {
    var that = this
    var bizDate = new Date(order.biz_date)
    order.dateStr = util.formatDate(bizDate)
    order.timeStr = util.formatTimeStr(bizDate)
    order.is_testStr = order.is_test == 1 ? '测试' : '营业'
    order.haveEnterainStr = order.haveEnterain ? '是' : '否'
    order.is_packageStr = order.is_package == 1 ? '是' : '否'
    order.creditInfo = order.haveOnCredit ? '是' : '否'
    order.haveDiscountStr = order.haveDiscount ? '包含' : '不含'
    order.total_amountStr = util.showAmount(order.total_amount)
    order.entrainAmountStr = util.showAmount(order.entrainAmount)
    order.itemDiscountAmountStr = util.showAmount(order.itemDiscountAmount)
    order.orderDiscountAmountStr = util.showAmount(order.orderDiscountAmount)
    order.discountAmountStr = util.showAmount(order.discountAmount)
    order.totalChargeStr = util.showAmount(order.totalCharge)
    order.paidAmountStr = util.showAmount(order.paidAmount)
    order.refundAmountStr = util.showAmount(order.refundAmount)
    order.remainingsum = order.paidAmount - order.refundAmount
    order.remainingsumStr = util.showAmount(order.remainingsum)
    order.unpaidAmount = order.totalCharge - order.paidAmount
    order.unpaidAmountStr = util.showAmount(order.unpaidAmount)
    order.currentPaidAmount = 0
    order.currentPaidAmountStr = util.showAmount(order.currentPaidAmount)
    order.remainUnPaidAmount = order.unpaidAmount - order.currentPaidAmount
    order.remainUnPaidAmountStr = util.showAmount(order.remainUnPaidAmount)
    for (var i = 0; i < order.fdOrders.length; i++) {
      var fdOrder = order.fdOrders[i]
      fdOrder.unit_priceStr = util.showAmount(parseFloat(fdOrder.unit_price))
      fdOrder.discountAmountStr = util.showAmount(fdOrder.discountAmount)
      fdOrder.summary = fdOrder.unit_price * fdOrder.count - fdOrder.discountAmount
      fdOrder.summaryStr = util.showAmount(fdOrder.summary)
      if (fdOrder.editing == undefined) {
        fdOrder.editing = false
      }
      fdOrder.inputedMemo = null
      that.getLogsPromise('fdorder', 'memo', fdOrder.id).then(function (resolve) {
        var logs = that.renderLog(resolve)
        fdOrder.logs = logs
        that.setData({ order })
      }).catch(function (reject) {
        reject(reject)
      })
    }
    for (var i = 0; i < order.availablePayments.length; i++) {
      var payment = order.availablePayments[i]
      if (payment.paid_date == null) {
        payment.paid_date = payment.create_date
      }
      var paidDate = new Date(payment.paid_date)
      payment.paid_dateDate = util.formatDate(paidDate)
      payment.paid_dateTime = util.formatTimeStr(paidDate)
      payment.amountStr = util.showAmount(payment.amount)
      var balances = []
      for (var i = 0; i < order.availablePayments.length; i++) {
        var payment = order.availablePayments[i]
        var balance = {
          type: '收款',
          date: new Date(payment.paid_date ? payment.paid_date : payment.create_date),
          amount: payment.amount,
          amountStr: util.showAmount(payment.amount),
          payMethod: payment.pay_method
        }
        balance.dateStr = util.formatDate(balance.date)
        balance.timeStr = util.formatTimeStr(balance.date)
        balances.push(balance)
      }
      for (var i = 0; i < order.refunds.length; i++) {
        var refund = order.refunds[i]
        var balance = {
          type: '退款',
          date: new Date(refund.create_date),
          amount: refund.amount,
          amountStr: util.showAmount(refund.amount),
          payMethod: '——'
        }
        balance.dateStr = util.formatDate(balance.date)
        balance.timeStr = util.formatTimeStr(balance.date)
        balances.push(balance)
      }
      order.balances = balances.sort((a, b) => (b.date - a.date))
    }
    that.setData({ order })
  },
  getLogsPromise(tableName, fieldName, key) {
    var getUrl = app.globalData.requestPrefix + 'Order/LoadLogs/' + key.toString() + '?tableName=' + tableName + '&fieldName=' + fieldName
    return new Promise(function (resolve, reject) {
      util.performWebRequest(getUrl, null).then(function (logs) {
        resolve(logs)
      }).catch(function (reject) {
        reject(reject)
      })
    })
  },
  renderLog(logs) {
    var that = this
    for (var i = 0; i < logs.length; i++) {
      var log = logs[i]
      var date = new Date(log.create_date)
      log.dateStr = util.formatDate(date)
      log.timeStr = util.formatTimeStr(date)
      log.staffName = log.staff ? log.staff.name : ' ——'
    }
    return logs
  },
  renderOrderStatusLog(logs) {
    var that = this
    that.setData({ orderStatusLog: that.renderLog(logs) })
  },
  renderOrderMemoLog(logs) {
    var that = this
    var logs = that.renderLog(logs)
    that.setData({ orderMemoLog: logs })
  },
  showLogs(e) {
    var that = this
    var id = e.currentTarget.id
    switch (id) {
      case 'orderStatus':
        that.setData({ showMemo: true, showOrderStatusLog: true, memoTitle: '订单状态历史' })
        break
      case 'orderMemo':
        that.setData({ showMemo: true, showOrderMemoLog: true, memoTitle: '订单备注历史' })
      default:
        if (!isNaN(id)) {
          var fdOrder = that.data.order.fdOrders[parseInt(id)]
          that.setData({ fdMemoLog: fdOrder.logs, showMemo: true, showFdMemoLog: true, memoTitle: '订单明细备注历史' })
        }
        break
    }
  },
  edit(e) {
    var that = this
    var id = e.currentTarget.id
    switch (id) {
      case 'orderMemo':
        that.setData({ editingOrderMemo: true })
        break
      default:
        if (!isNaN(id)) {
          var order = that.data.order
          var fdOrder = order.fdOrders[parseInt(id)]
          fdOrder.editing = true
          that.renderOrder(order)
        }
        break
    }
  },
  cancelMemo(e) {
    var that = this
    var id = e.currentTarget.id
    if (id == 'orderMemo') {
      var order = that.data.order
      order.inputedMemo = null
      that.setData({ editingOrderMemo: false })
    }
    else if (!isNaN(id)) {
      var order = that.data.order
      var fdOrder = order.fdOrders[parseInt(id)]
      fdOrder.editing = false
      that.renderOrder(order)
    }
  },
  inputMemo(e) {
    var that = this
    var value = e.detail.value
    var id = e.currentTarget.id
    var order = that.data.order
    if (id == 'orderMemo') {
      order.inputedMemo = value
    }
    else if (!isNaN(id)) {
      var fdOrder = order.fdOrders[parseInt(id)]
      fdOrder.inputedMemo = value
    }
  },
  confirmMemo(e) {
    var that = this
    var id = e.currentTarget.id
    var order = that.data.order
    if (id == 'orderMemo') {
      if (order.inputedMemo) {
        order.memo = order.inputedMemo
        that.updateOrderPromise(order, '修改订单备注').then(function (resolve) {
          that.cancelMemo(e)
          that.renderOrder(resolve)
          that.getLogsPromise('order', 'memo', order.id).then(function (logs) {
            that.renderOrderMemoLog(logs)
          })
        })
      }
    }
    else if (!isNaN(id)) {
      var fdOrder = order.fdOrders[parseInt(id)]
      fdOrder.memo = fdOrder.inputedMemo
      that.updateFdOrderPromise(fdOrder, '修改订单明细备注').then(function (fdOrder) {
        that.cancelMemo(e)
        that.getLogsPromise('fdorder', 'memo', fdOrder.id).then(function (resolve) {
          fdOrder.logs = that.renderLog(resolve)
          that.setData({ order })
        })
      }).catch(function (reject) { })
    }
  },
  updateOrderPromise(order, scene) {
    var updateUrl = app.globalData.requestPrefix + 'Order/UpdateOrderByStaff?scene=' + encodeURIComponent(scene) + '&sessionKey=' + app.globalData.sessionKey
    return new Promise(function (resolve, reject) {
      util.performWebRequest(updateUrl, order).then(function (order) {
        resolve(order)
      }).catch(function (reject) {
        reject(reject)
      })
    })
  },
  updateFdOrderPromise(fdOrder, scene) {
    var updateUrl = app.globalData.requestPrefix + 'Order/UpdateFdOrderByStaff?scene=' + encodeURIComponent(scene) + '&sessionKey=' + app.globalData.sessionKey
    return new Promise(function (resolve, reject) {
      util.performWebRequest(updateUrl, fdOrder).then(function (fdOrder) {
        resolve(fdOrder)
      }).catch(function (obj) {
        reject(obj)
      })
    })
  },
  showCharge() {
    var that = this
    that.setData({ showCharge: true })
  },
  closeCharge() {
    var that = this
    that.setData({ showCharge: false })
  },
  setPayType(e) {
    var that = this
    that.setData({ customerPayType: e.detail.value })
  },
  showRefund() {
    var that = this
    that.setData({ showRefund: true })
  },
  closeRefund() {
    var that = this
    that.setData({ showRefund: false })
  },
  changeRefundType(e) {
    var that = this
    that.setData({ refundType: e.detail.value })
  },
  showBalance() {
    var that = this
    that.setData({ showBalance: true })
  },
  closeBalance() {
    var that = this
    that.setData({ showBalance: false })
  },
  setPayListAmount(e){
    var that = this
    var amount =  isNaN(e.detail.value)? null : parseFloat(e.detail.value)
    var id = parseInt(e.currentTarget.id)
    var payList = that.data.payList
    var pay = payList[id]
    if (amount != null){
      pay.amount = amount
      that.renderPayList()
    }
  },
  renderPayList(){
    var that = this
    var payList = that.data.payList
    var order = that.data.order
    var unpaidAmount = order.unpaidAmount
    var currentPaidAmount = 0
    var inValid = false
    for(var i = 0; i < payList.length; i++){
      var pay = payList[i]
      if (pay.amount){
        pay.amountStr = util.showAmount(pay.amount)
        
        if (i < payList.length - 1){
          currentPaidAmount += parseFloat(pay.amount)
        }
        
       //currentPaidAmount += parseFloat(pay.amount)
      }
      else{
        inValid = true
      }
      if (pay.payMethod == null){
        inValid = true
      }

    }
    payList[payList.length - 1].amount = 
      payList[payList.length - 2].amount == null ? null : unpaidAmount - currentPaidAmount
    payList[payList.length - 1].amountStr = util.showAmount(payList[payList.length - 1].amount)
    order.currentPaidAmount = unpaidAmount
    var sum = 0
    for(var i = 0; i < payList.length; i++){
      var pay = payList[i]
      sum += pay.amount > 0? pay.amount : 0
    }
    order.remainUnPaidAmount = unpaidAmount - sum
    order.currentPaidAmountStr = util.showAmount(order.currentPaidAmount)
    
    order.remainUnPaidAmountStr = util.showAmount(order.remainUnPaidAmount)
    that.setData({payList, order, paylistValid: !inValid})
  },
  addNewPayList(){
    var that = this
    var payList = that.data.payList
    payList[payList.length - 1].amount = null
    payList.push( { amount: null, payMethod: null, OrderStatus: '待生成' })
    that.renderPayList()
    //that.setData({payList})
  },
  setPayMethodList(e){
    var that = this
    var value = e.detail.value
    var id = parseInt(e.currentTarget.id)
    var payList = that.data.payList
    var pay = payList[id]
    pay.payMethod = value
    that.renderPayList()
  },
  confirmPayList(){
    var that = this
    var payList = that.data.payList
    for(var i = 0; i < payList.length; i++){
      payList[i].OrderStatus = '待支付'
    }
    that.setData({paying: true})
    that.renderPayList()
  },
  cancelPayList(){
    var that = this
    var payList = that.data.payList
    for(var i = 0; i < payList.length; i++){
      payList[i].OrderStatus = '待生成'
    }
    that.setData({paying: false})
    that.renderPayList()
  },
  delPayList(e){
    var that = this
    var id = parseInt(e.currentTarget.id)
    var payList = that.data.payList
    var newPayList = []
    for(var i = 0; i < payList.length; i++){
      if (i != id){
        newPayList.push(payList[i])
      }
    }
    that.data.payList = newPayList
    that.renderPayList(newPayList)
  },
  addNew(){
    wx.navigateTo({
      url: 'fd_category_prod_list',
    })
  }

})
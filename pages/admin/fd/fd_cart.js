// pages/admin/fd/fd_cart.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({
  /**
   * Page initial data
   */
  data: {
    editing: false
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var orderId = options.orderId
    that.setData({ orderId })
  },
  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },
  /**
   * Lifecycle function--Called when page show
   */
  onShow() {
    var that = this
    app.loginPromiseNew.then(function (resolve) {
      that.setData({ staff: app.globalData.staff })
      that.getData()
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
  renderOrder(order) {
    var that = this
    var totalCount = 0
    var totalSummary = 0
    var totalDiscount = 0
    var totalCharge = 0
    var editing = false
    for (var i = 0; i < order.fdOrders.length; i++) {
      var fdOrder = order.fdOrders[i]
      fdOrder.unit_priceStr = util.showAmount(fdOrder.unit_price)
      fdOrder.summary = fdOrder.order_type == '招待' ? 0 : fdOrder.unit_price * fdOrder.count - fdOrder.discountAmount
      fdOrder.summaryStr = util.showAmount(fdOrder.summary)
      totalCount += fdOrder.count
      totalSummary += fdOrder.order_type == '招待' ? 0 : fdOrder.unit_price * fdOrder.count 
      totalCharge += fdOrder.summary
      totalDiscount += fdOrder.discountAmount? fdOrder.discountAmount : 0
      editing = editing || (fdOrder.count_editing == undefined? false : fdOrder.count_editing)
      editing = editing || (fdOrder.discount_editing == undefined ? false : fdOrder.discount_editing)
      editing = editing || (fdOrder.memo_editing == undefined ? false : fdOrder.memo_editing )
    }
    that.setData({ order, totalCount, totalSummary, totalSummaryStr: util.showAmount(totalSummary), totalDiscountStr: util.showAmount(totalDiscount), totalChargeStr: util.showAmount(totalCharge), editing })
  },
  getData() {
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Order/GetOrderByStaff/' + that.data.orderId + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, null).then(function (resolve) {
      var order = resolve
      console.log('order', order)
      that.renderOrder(order)
    })
  },
  mod(e){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var value = e.detail.value
    var order = that.data.order
    var index = parseInt(idArr[1])
    var fdOrder = order.fdOrders[index]
    switch(idArr[0].trim()){
      case 'count':
        fdOrder.edited_count = value
        break
      case 'discount':
        fdOrder.edited_discount = value
        break
      case 'memo':
        fdOrder.edited_memo = value
        break
      default:
        break
    }
  },
  del(e) {
    console.log('del', e)
    var that = this
    var order = that.data.order
    var id = e.currentTarget.id
    var fdOrder = order.fdOrders[id]
    fdOrder.count = 0
    fdOrder.valid = 0
    var delUrl = app.globalData.requestPrefix + 'Order/UpdateFdOrderByStaff?scene=' + encodeURIComponent('修改购物车') + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(delUrl, fdOrder).then(function (resolve) {
      that.getData()
    })
  },
  placeOrder(e){
    var that = this
    var order = that.data.order
    for(var i = 0; i < order.fdOrders.length; i++){
      var fdOrder = order.fdOrders[i]
      if (fdOrder.discountAmount > 0){
        that.setDiscount(fdOrder)
      }
      if (fdOrder.edited){
        that.updateFdOrder(fdOrder)
      }
    }
    order.valid = 1
    order.total_amount = that.data.totalSummary
    var updateUrl = app.globalData.requestPrefix + 'Order/UpdateOrderByStaff?scene=' + encodeURIComponent('餐饮确认购物车') + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(updateUrl, order).then(function (resolve) {
      var order = resolve
      console.log('order', order)
      wx.navigateTo({
        url: 'fd_order_confirm?orderId=' + order.id.toString(),
      })
    })
    
  },
  updateFdOrder(fdOrder){
    var delUrl = app.globalData.requestPrefix + 'Order/UpdateFdOrderByStaff?scene=' + encodeURIComponent('确认订单') + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(delUrl, fdOrder).then(function (resolve) {
    })
  },
  setDiscount(fdOrder){
    var setUrl = app.globalData.requestPrefix + 'Order/SetDiscount/' + fdOrder.order_id + '?bizId=' + fdOrder.id.toString() + '&bizType=' + encodeURIComponent('餐饮') + '&discountAmount=' + fdOrder.discountAmount + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(setUrl, null).then(function(resolve){
      console.log('set discount', resolve)
    })
  },
  edit(e){
    var that = this
    that.changeCellEditStatus(e, true)
    
  },
  cancel(e){
    var that = this
    that.changeCellEditStatus(e, false)
  },
  changeCellEditStatus(e, status){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var id = parseInt(idArr[1])
    var order = that.data.order
    var fdOrder = order.fdOrders[id]
    switch(idArr[0].trim()){
      case 'count':
        fdOrder.count_editing = status
        break
      case 'discount':
        fdOrder.discount_editing = status
        break
      case 'memo':
        fdOrder.memo_editing = status
        break
      default:
        break
    }
    that.renderOrder(order)
  },
  confirmMod(e){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var id = parseInt(idArr[1])
    var order = that.data.order
    var fdOrder = order.fdOrders[id]
    var message = ''
    switch(idArr[0]){
      case 'count':
        if (isNaN(fdOrder.edited_count)){
          message = '必须是整数'
        }
        else{
          fdOrder.count = parseInt(fdOrder.edited_count)
          fdOrder.edited = true
        }
        break
      case 'discount':
        if (isNaN(fdOrder.edited_discount)){
          message = '必须是数字'
        }
        else{
          fdOrder.discountAmount = parseFloat(fdOrder.edited_discount)
          fdOrder.edited = true
        }
        break
      case 'memo':
        fdOrder.memo = fdOrder.edited_memo
        fdOrder.edited = true
        break
      default:
        break
    }
    if (message == ''){
      //that.setData({order})
      that.renderOrder(order)
    }
    else{
      wx.showToast({
        title: message,
        icon: 'error'
      })
    }
    that.cancel(e)
  }
})
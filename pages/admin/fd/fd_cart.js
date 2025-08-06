// pages/admin/fd/fd_cart.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {

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
    for (var i = 0; i < order.fdOrders.length; i++) {
      var fdOrder = order.fdOrders[i]
      fdOrder.unit_priceStr = util.showAmount(fdOrder.unit_price)
      fdOrder.summary = fdOrder.order_type == '招待' ? 0 : fdOrder.unit_price * fdOrder.count - fdOrder.discountAmount
      fdOrder.summaryStr = util.showAmount(fdOrder.summary)
    }
    that.setData({ order })
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
  mod(e) {
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var value = e.detail.value
    var order = that.data.order
    var index = parseInt(idArr[1])
    var fdOrder = order.fdOrders[index]
    switch (idArr[0]) {
      case 'memo':
        fdOrder.memo = value
        break
      case 'count':
        if (value == null || value == '' || isNaN(value)) {
          return
        }
        else {
          fdOrder.count = parseInt(value)
        }
        break
      case 'discount':
        if (value == null || value == '' || isNaN(value)) {
          return
        }
        else{
          var setUrl = app.globalData.requestPrefix + 'Order/SetDiscount/' + order.id + '?bizId=' + fdOrder.id.toString() + '&bizType=' + encodeURIComponent('餐饮') + '&discountAmount=' + value.toString() + '&sessionKey=' + app.globalData.sessionKey
          util.performWebRequest(setUrl, null).then(function (resolve){
            that.getData()
          })
          return
        }
        break
      default:
        break
    }
    if (fdOrder.count == 0) {
      wx.showModal({
        title: '确认从购物车中删除',
        content: '商品名称：' + fdOrder.product_name,
        complete: (res) => {
          if (res.cancel) {
            that.getData()
          }
          if (res.confirm) {
            fdOrder.valid = 0
            var delUrl = app.globalData.requestPrefix + 'Order/UpdateFdOrderByStaff?scene=' + encodeURIComponent('修改购物车') + '&sessionKey=' + app.globalData.sessionKey
            util.performWebRequest(delUrl, fdOrder).then(function (resolve) {
              that.getData()
            })
          }
        }
      })
      return
    }
    var updateUrl = app.globalData.requestPrefix + 'Order/UpdateFdOrderByStaff?scene=' + encodeURIComponent('修改购物车') + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(updateUrl, fdOrder).then(function (resolve) {
      that.getData()
    })
  }
})
// pages/admin/rent/rent_order_detail/rent_order_detail.js
var app = getApp()
var util = require('../../../utils/util.js')
var data = require('../../../utils/data.js')

Page({
  data: {
    id: null,
    order: null,
    shopObj: null,

    _orderInfoExpanded: true,
    _paymentExpanded: true,
    _refundExpanded: true,

    _rentalTab: 0,
    _expandedRentals: {},
    _expandedDetails: {},
    _expandedItems: {},

    allValid: false,
  },

  onLoad(options) {
    this.setData({ id: parseInt(options.id) })
  },

  onShow() {
    var that = this
    app.loginPromiseNew.then(function () {
      that.getData()
    })
  },

  getData() {
    wx.showLoading({ title: '加载中' })
    var that = this
    var sessionKey = app.globalData.sessionKey
    var id = that.data.id
    data.getOrderByStaffPromise(id, sessionKey).then(function (order) {
      if (!order) { wx.hideLoading(); return }
      var rentalPromises = []
      for (var i = 0; order.rentals && i < order.rentals.length; i++) {
        rentalPromises.push(data.getRentalPromise(order.rentals[i].id, sessionKey))
      }
      Promise.all(rentalPromises).then(function (rentals) {
        for (var i = 0; i < rentals.length; i++) {
          if (rentals[i]) order.rentals[i] = rentals[i]
        }
        order = that.renderOrder(order)
        wx.hideLoading()
        that.setData({ order })
      })
    }).catch(function () { wx.hideLoading() })
  },

  renderOrder(order) {
    // 实现见 Task 3
    return order
  },

  checkAppendingRentalValid() {
    // 实现见 Task 8
  },
})

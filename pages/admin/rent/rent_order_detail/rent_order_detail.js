// pages/admin/rent/rent_order_detail/rent_order_detail.js
var app = getApp()
var util = require('../../../../utils/util.js')
var data = require('../../../../utils/data.js')

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
    }).catch(function () {})
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
        var allValid = that.checkAppendingRentalValid(order)
        wx.hideLoading()
        that.setData({ order, allValid })
      }).catch(function () { wx.hideLoading() })
    }).catch(function () { wx.hideLoading() })
  },

  renderOrder(order) {
    var that = this
    var packages = []
    var rentals = []
    var packageNum = 0
    var unRelieveGuaranty = 0
    var relieveGuaranty = 0
    var allSettled = true

    for (var i = 0; order.rentals && i < order.rentals.length; i++) {
      var rental = order.rentals[i]
      rental.realGuaranty = rental.guaranty
      if (!isNaN(rental.guaranty_dicount)) {
        rental.realGuaranty = rental.guaranty - parseFloat(rental.guaranty_dicount)
      }
      rental.realGuaranty = parseFloat(rental.realGuaranty.toFixed(2))
      if (rental.settled != 1) allSettled = false
      if (rental.guarantyRelieve != 1) {
        unRelieveGuaranty += rental.realGuaranty
      } else {
        relieveGuaranty += rental.realGuaranty
      }

      if (rental.realEndDate == null) {
        rental.realEndDateStr = '--'
      } else {
        rental.realEndDateStr = util.formatDate(new Date(rental.realEndDate))
      }
      if (rental.realStartDate == null) {
        rental.realStartDateStr = '--'
      } else {
        rental.realStartDateStr = util.formatDate(new Date(rental.realStartDate))
      }

      if (rental.isPackage) {
        packages.push(rental)
        packageNum++
        rental._isPackage = true
      } else {
        rentals.push(rental)
        rental._isPackage = false
      }

      if (rental.noGuaranty == true) {
        rental.guarantyAmountStr = '免押金'
      } else {
        rental.guarantyAmountStr = util.showAmount(rental.totalPaidGuarantyAmount)
      }

      if (rental.start_date) {
        var startDate = new Date(rental.start_date)
        rental.start_dateDateStr = util.formatDate(startDate)
        rental.start_dateTimeStr = util.formatTimeStr(startDate)
      } else {
        rental.start_dateDateStr = '——'
        rental.start_dateTimeStr = '——'
      }
      if (rental.end_date) {
        var endDate = new Date(rental.end_date)
        rental.end_dateDateStr = util.formatDate(endDate)
        rental.end_dateTimeStr = util.formatTimeStr(endDate)
      } else {
        rental.end_dateDateStr = '——'
        rental.end_dateTimeStr = '——'
      }

      // 租赁物明细
      for (var j = 0; rental.rentItems && j < rental.rentItems.length; j++) {
        var rentItem = rental.rentItems[j]
        if (rentItem.noNeed) {
          rentItem._statusLabel = '不需要'
          rentItem._statusClass = 'chip--status-noneed'
        } else if (rentItem.status == '未发放') {
          rentItem._statusLabel = '未发放'
          rentItem._statusClass = 'chip--status-unreturned'
        } else if (rentItem.status == '已发放') {
          rentItem._statusLabel = '已发放'
          rentItem._statusClass = 'chip--status-issued'
        } else if (rentItem.status == '已归还') {
          rentItem._statusLabel = '已归还'
          rentItem._statusClass = 'chip--status-returned'
        } else {
          rentItem._statusLabel = rentItem.status || '—'
          rentItem._statusClass = 'chip--status-noneed'
        }
        rentItem.totalRepairationAmountStr = util.showAmount(rentItem.totalRepairationAmount)
        if (rentItem.pickDate == null) {
          rentItem.pickDateStr = '--'
          rentItem.pickTimeStr = '--'
        } else {
          rentItem.pickDateStr = util.formatDate(new Date(rentItem.pickDate))
          rentItem.pickTimeStr = util.formatTimeStr(new Date(rentItem.pickDate))
        }
        if (rentItem.returnDate == null) {
          rentItem.returnDateStr = '--'
          rentItem.returnTimeStr = '--'
        } else {
          rentItem.returnDateStr = util.formatDate(new Date(rentItem.returnDate))
          rentItem.returnTimeStr = util.formatTimeStr(new Date(rentItem.returnDate))
        }
      }

      // 租金明细
      for (var j = 0; rental.details && j < rental.details.length; j++) {
        var detail = rental.details[j]
        var rDate = new Date(detail.rental_date)
        detail.rental_dateDateStr = util.formatDate(rDate)
        detail.amount = parseFloat(detail.amount).toFixed(2)
        detail.othersDiscountAmount = parseFloat(detail.othersDiscountAmount).toFixed(2)
        detail.summary = (parseFloat(detail.amount) - parseFloat(detail.othersDiscountAmount)).toFixed(2)
        detail.summaryStr = util.showAmount(parseFloat(detail.summary))
      }
    }

    // appendingRentals 处理（追加中的租赁）
    for (var i = 0; order.appendingRentals && i < order.appendingRentals.length; i++) {
      var rental = order.appendingRentals[i]
      rental.realGuaranty = rental.guaranty
      if (!isNaN(rental.guaranty_dicount)) {
        rental.realGuaranty = rental.guaranty - parseFloat(rental.guaranty_dicount)
      }
      if (rental.noGuaranty) {
        rental.realGuaranty = 0
        rental.guaranty_dicount = 0
      }
      rental.realGuaranty = parseFloat(rental.realGuaranty.toFixed(2))
      rental.realDepositStr = util.showAmount(rental.realGuaranty)
      rental.startDate = util.formatDate(new Date(rental.start_date))
      var totalRentalAmount = 0
      for (var j = 0; rental.pricePresets && j < rental.pricePresets.length; j++) {
        rental.pricePresets[j].priceStr = util.showAmount(rental.pricePresets[j].price)
        totalRentalAmount += rental.pricePresets[j].price
      }
      rental.totalRentalAmount = totalRentalAmount
      rental.totalDiscountAmountStr = util.showAmount(totalRentalAmount)
    }

    // 支付明细
    for (var i = 0; order.availablePayments && i < order.availablePayments.length; i++) {
      var payment = order.availablePayments[i]
      var paidDate = new Date(payment.paid_date)
      payment.paid_dateDateStr = util.formatDate(paidDate)
      payment.paid_dateTimeStr = util.formatTimeStr(paidDate)
      payment.amountStr = util.showAmount(payment.amount)
      payment.remainAmount = payment.amount
      if (!isNaN(payment.refundedAmount)) {
        payment.remainAmount = payment.remainAmount - payment.refundedAmount
      }
      payment.remainAmountStr = util.showAmount(payment.remainAmount)
    }

    // 关单时间
    if (order.closed == 1) {
      var closeDate = new Date(order.close_date)
      order.close_dateDateStr = util.formatDate(closeDate)
      order.close_dateTimeStr = util.formatTimeStr(closeDate)
    } else {
      order.close_dateDateStr = '--'
      order.close_dateTimeStr = '--'
    }

    // 会员类型
    order._memberTypeLabel = (order.member && order.member.following_wechat == 1) ? '会员' : '散客'
    order._memberTypeClass = (order.member && order.member.following_wechat == 1) ? 'chip--member' : 'chip--guest'

    // 汇总字段
    order.packageNum = packageNum
    order.categoryNum = order.rentals ? order.rentals.length - packageNum : 0
    order.paidAmountStr = util.showAmount(order.paidAmount)
    order.refundAmountStr = util.showAmount(order.refundAmount)
    order.unRelieveGuaranty = unRelieveGuaranty
    order.unRelieveGuarantyStr = util.showAmount(unRelieveGuaranty)
    order.relieveGuarantyStr = util.showAmount(relieveGuaranty)
    order.totalGuarantyAmountStr = util.showAmount(order.totalGuarantyAmount)
    order.totalRentSummaryAmountStr = util.showAmount(order.totalRentSummaryAmount)
    order.totalRentNeedToRefundAmountStr = util.showAmount(order.totalRentNeedToRefundAmount)
    order.totalRentOverTimeAmountStr = util.showAmount(order.totalRentOverTimeAmount)
    order.totalRentRepairationAmountStr = util.showAmount(order.totalRentRepairAmount)
    if (order.rentProperties) {
      order.rentProperties.totalPaidGuarantyAmountStr = util.showAmount(order.rentProperties.totalPaidGuarantyAmount)
      order.rentProperties.relieveGuarantyAmountStr = util.showAmount(order.rentProperties.relieveGuarantyAmount)
    }
    order.totalRentUnRefund = parseFloat(order.totalRentUnRefund.toFixed(2))
    if (order.totalRentUnRefund < 0 && order.totalRentUnRefund > -0.001) {
      order.totalRentUnRefund = 0
    }
    order.totalRentUnRefundStr = util.showAmount(order.totalRentUnRefund)

    // 按租赁物 flat list
    var allRentItems = []
    for (var i = 0; order.rentals && i < order.rentals.length; i++) {
      var r = order.rentals[i]
      for (var j = 0; r.rentItems && j < r.rentItems.length; j++) {
        var it = Object.assign({}, r.rentItems[j])
        it._rentalName = r.name
        allRentItems.push(it)
      }
    }
    order._allRentItems = allRentItems

    return order
  },

  onToggleOrderInfo() {
    this.setData({ _orderInfoExpanded: !this.data._orderInfoExpanded })
  },
  onTogglePayment() {
    this.setData({ _paymentExpanded: !this.data._paymentExpanded })
  },
  onToggleRefund() {
    this.setData({ _refundExpanded: !this.data._refundExpanded })
  },
  onRentalTabChange(e) {
    this.setData({ _rentalTab: parseInt(e.currentTarget.dataset.tab) })
  },
  onToggleRental(e) {
    var ridx = e.currentTarget.dataset.ridx
    var key = '_expandedRentals.' + ridx
    this.setData({ [key]: !this.data._expandedRentals[ridx] })
  },
  onToggleDetails(e) {
    var ridx = e.currentTarget.dataset.ridx
    var key = '_expandedDetails.' + ridx
    this.setData({ [key]: !this.data._expandedDetails[ridx] })
  },
  onToggleItems(e) {
    var ridx = e.currentTarget.dataset.ridx
    var key = '_expandedItems.' + ridx
    this.setData({ [key]: !this.data._expandedItems[ridx] })
  },

  onCall() {
    var cell = this.data.order && this.data.order.member && this.data.order.member.cell
    if (!cell) return
    wx.setClipboardData({
      data: cell,
      success: function () {
        wx.makePhoneCall({ phoneNumber: cell })
      }
    })
  },

  onRefund() {
    var that = this
    var order = that.data.order
    var refundAmount = order.totalRentUnRefund
    if (!refundAmount || isNaN(refundAmount) || refundAmount <= 0) {
      wx.showToast({ title: '无需退款', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认退款',
      content: '实际应退 ' + util.showAmount(refundAmount),
      complete: (res) => {
        if (!res.confirm) return
        var payment = null
        for (var i = 0; order.availablePayments && i < order.availablePayments.length; i++) {
          var p = order.availablePayments[i]
          var unRefund = parseFloat((p.remainAmount || 0).toString())
          if (p.status == '支付成功'
            && parseFloat(unRefund.toFixed(2)) >= parseFloat(refundAmount.toFixed(2))) {
            payment = p
            break
          }
        }
        if (!payment) {
          wx.showToast({ title: '无可退款支付记录', icon: 'error' })
          return
        }
        var refunds = [{
          payment_id: payment.id,
          amount: parseFloat(refundAmount.toFixed(2)),
          reason: '租赁退押金'
        }]
        data.refundPromise(order.id, refunds, app.globalData.sessionKey).then(function () {
          wx.showToast({ title: '退款成功', icon: 'success' })
          that.getData()
        }).catch(function () {
          wx.showToast({ title: '退款失败', icon: 'error' })
        })
      }
    })
  },

  onModMemo(e) {
    var that = this
    var ridx = e.currentTarget.dataset.ridx
    var rental = that.data.order.rentals[ridx]
    wx.showModal({
      title: '修改备注',
      content: rental.memo || '',
      editable: true,
      complete: (res) => {
        if (!res.confirm) return
        var newMemo = res.content || ''
        rental.memo = newMemo
        data.updateRentalPromise(rental, '租赁订单详细页修改备注', app.globalData.sessionKey)
          .then(function () {
            that.setData({ ['order.rentals[' + ridx + '].memo']: newMemo })
            wx.showToast({ title: '备注已保存', icon: 'success' })
          }).catch(function () {
            wx.showToast({ title: '保存失败', icon: 'error' })
          })
      }
    })
  },

  checkAppendingRentalValid(order) {
    var that = this
    if (!order) order = that.data.order
    if (!order || !order.appendingRentals) return
    var allValid = true
    var rentals = order.appendingRentals
    for (var i = 0; i < rentals.length; i++) {
      var rentalWellformed = true
      var rentItems = rentals[i].rentItems
      for (var j = 0; rentItems && j < rentItems.length; j++) {
        var rentItem = rentItems[j]
        if (rentItem.noNeed) {
          rentItem.wellFormed = true
        } else if (rentItem.noCode) {
          rentItem.wellFormed = !!(rentItem.name && rentItem.name != '')
          if (!rentItem.wellFormed) { rentalWellformed = false; allValid = false }
        } else {
          rentItem.wellFormed = !!(rentItem.code && rentItem.code != '')
          if (!rentItem.wellFormed) { rentalWellformed = false; allValid = false }
        }
      }
      rentals[i].wellFormed = rentalWellformed
    }
    return allValid
  },

  onAddPackage() {
    var that = this
    var order = that.data.order
    wx.navigateTo({
      url: '/pages/admin/reception/recept_package?orderId=' + order.id
        + '&shop=' + encodeURIComponent(order.shop),
      events: {
        selectPackage: function (pkg) {
          var appendUrl = app.globalData.requestPrefix
            + 'Rent/AppendRental/' + order.id.toString()
            + '?packageId=' + pkg.id
            + '&sessionKey=' + app.globalData.sessionKey
          util.performWebRequest(appendUrl, null).then(function (updatedOrder) {
            updatedOrder = that.renderOrder(updatedOrder)
            var allValid = that.checkAppendingRentalValid(updatedOrder)
            that.setData({ allValid, order: updatedOrder })
          }).catch(function () {
            wx.showToast({ title: '添加失败', icon: 'error' })
          })
        }
      }
    })
  },
  onAddItem() {
    var that = this
    var order = that.data.order
    wx.navigateTo({
      url: '/pages/admin/rent/search_fuzzy?orderId=' + order.id,
      events: {
        selectCategory: function (category) {
          var appendUrl = app.globalData.requestPrefix
            + 'Rent/AppendRental/' + order.id.toString()
            + '?categoryId=' + category.id
            + '&sessionKey=' + app.globalData.sessionKey
          util.performWebRequest(appendUrl, null).then(function (updatedOrder) {
            updatedOrder = that.renderOrder(updatedOrder)
            var allValid = that.checkAppendingRentalValid(updatedOrder)
            that.setData({ allValid, order: updatedOrder })
          }).catch(function () {
            wx.showToast({ title: '添加失败', icon: 'error' })
          })
        }
      }
    })
  },
  onConfirmAppend() {
    var that = this
    var order = that.data.order
    if (!order.appendingRentals || order.appendingRentals.length == 0) return
    var appUrl = app.globalData.requestPrefix
      + 'Rent/SaveAppendings/' + order.id.toString()
      + '?sessionKey=' + app.globalData.sessionKey
    wx.showLoading({ title: '追加中' })
    util.performWebRequest(appUrl, order.appendingRentals).then(function (updatedOrder) {
      wx.hideLoading()
      if (updatedOrder.paying_amount > 0) {
        var renderedOrder = that.renderOrder(updatedOrder)
        var allValid = that.checkAppendingRentalValid(renderedOrder)
        that.setData({ allValid, order: renderedOrder })
        wx.navigateTo({ url: '/pages/payment/settle/index?orderId=' + updatedOrder.id })
      } else {
        that.getData()
        wx.showToast({ title: '追加成功', icon: 'success' })
      }
    }).catch(function () {
      wx.hideLoading()
      wx.showToast({ title: '追加失败', icon: 'error' })
    })
  },
  onDelAppendingRental(e) {
    var that = this
    var id = e.currentTarget.dataset.id
    var order = that.data.order
    var rental = null
    for (var i = 0; order.appendingRentals && i < order.appendingRentals.length; i++) {
      if (order.appendingRentals[i].id == id) { rental = order.appendingRentals[i]; break }
    }
    if (!rental) return
    wx.showModal({
      title: '确认删除',
      content: '正在添加的租赁商品：' + rental.name + ' 即将删除。',
      complete: (res) => {
        if (!res.confirm) return
        var delUrl = app.globalData.requestPrefix
          + 'Rent/RemoveAppendingRental/' + id.toString()
          + '?sessionKey=' + app.globalData.sessionKey
        util.performWebRequest(delUrl, null).then(function (updatedOrder) {
          updatedOrder = that.renderOrder(updatedOrder)
          var allValid = that.checkAppendingRentalValid(updatedOrder)
          that.setData({ allValid, order: updatedOrder })
        }).catch(function () {
          wx.showToast({ title: '删除失败', icon: 'error' })
        })
      }
    })
  },
})

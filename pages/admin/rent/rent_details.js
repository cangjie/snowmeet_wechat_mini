// pages/admin/rent/rent_details.js
const app = getApp()
const data = require('../../../utils/data.js')
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    activeTabIndex: 0,
    currentRentalId: null,
    backDropType: 'null',
    showBackdrop: false,
    refunding: false,
    payWithDeposit: false,
    showSelectPackagePopUp: false,
    showAppendPay: false,
    showBalance: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.data.id = options.id
    //that.setData({ id: options.id })
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
    app.loginPromiseNew.then(function (resovle) {
      that.getData()
    }).catch(function (exp) {
      console.log('promise error', exp)
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
    var bizDate = new Date(order.biz_date)
    var packages = []
    var rentals = []
    order.bizDateStr = util.formatDate(bizDate)
    order.bizTimeStr = util.formatTimeStr(bizDate)
    var unRelieveGuaranty = 0
    var relieveGuaranty = 0
    var packageNum = 0
    var allSettled = true
    var totalGuarantyAmount = 0
    var totalSummary = 0
    for (var i = 0; i < order.rentals.length; i++) {
      var rental = order.rentals[i]
      if (allSettled && rental.settled == 0) {
        allSettled = false
      }
      for (var j = 0; j < rental.guaranties.length; j++) {
        totalGuarantyAmount += rental.guaranties[j].amount
        if (rental.guaranties[j].relieve == 0) {
          unRelieveGuaranty += rental.guaranties[j].amount
        }
        else {
          relieveGuaranty += rental.guaranties[j].amount
        }
      }

      rental.realGuaranty = rental.guaranty - rental.guaranty_dicount
      rental.realDepositStr = util.showAmount(rental.realGuaranty)
      rental.deposit = rental.guaranty

      rental.titleName = rental.package_id ? ('套餐-' + rental.name) : ('单品-' + rental.name)
      rental.totalRentalAmountStr = util.showAmount(rental.totalRentalAmount)
      rental.totalRepairationAmountStr = util.showAmount(rental.totalRepairationAmount)
      rental.totalOvertimeAmountStr = util.showAmount(rental.totalOvertimeAmount)
      rental.totalDiscountAmountStr = util.showAmount(rental.totalDiscountAmount)
      rental.summary = rental.totalRentalAmount + rental.totalRepairationAmount + rental.totalOvertimeAmount
        - rental.ticketDiscountAmount - rental.othersDiscountAmount
      totalSummary += rental.summary
      rental.totalSummaryStr = util.showAmount(rental.totalSummary)
      rental.startDate = new Date(rental.start_date)
      if (rental.realStartDate == null) {
        rental.realStartDateStr = '--'
      }
      else {
        rental.realStartDateStr = util.formatDate(new Date(rental.realStartDate))
      }
      if (rental.realEndDate == null) {
        rental.realEndDateStr = '--'
      }
      else {
        rental.realEndDateStr = util.formatDate(new Date(rental.realEndDate))
      }
      if (rental.isPackage) {
        packages.push(rental)
        packageNum++
      }
      else {
        rentals.push(rental)
      }
      if (rental.noGuaranty == true) {
        rental.guarantyAmountStr = '免押金'
      }
      else {
        rental.guarantyAmountStr = util.showAmount(rental.totalPaidGuarantyAmount)
      }
      if (rental.start_date) {
        var startDate = new Date(rental.start_date)
        rental.start_dateDateStr = util.formatDate(startDate)
        rental.start_dateTimeStr = util.formatTimeStr(startDate)
      }
      else {
        rental.start_dateDateStr = '——'
        rental.start_dateDateStr = '——'
      }
      if (rental.end_date) {
        var endDate = new Date(rental.end_date)
        rental.end_dateDateStr = util.formatDate(endDate)
        rental.end_dateTimeStr = util.formatTimeStr(endDate)
      }
      for (var j = 0; j < rental.rentItems.length; j++) {
        var rentItem = rental.rentItems[j]
        rentItem.totalRepairationAmountStr = util.showAmount(rentItem.totalRepairationAmount)
        if (rentItem.pickDate == null) {
          rentItem.pickDateStr = '--'
          rentItem.pickTimeStr = '--'
        }
        else {
          rentItem.pickDateStr = util.formatDate(new Date(rentItem.pickDate))
          rentItem.pickTimeStr = util.formatTimeStr(new Date(rentItem.pickDate))
        }
        if (rentItem.returnDate == null) {
          rentItem.returnDateStr = '--'
          rentItem.returnTimeStr = '--'
        }
        else {
          rentItem.returnDateStr = util.formatDate(new Date(rentItem.returnDate))
          rentItem.returnTimeStr = util.formatTimeStr(new Date(rentItem.returnDate))
        }
        if (rentItem.changeDate == null) {
          rentItem.changeDateStr = '--'
          rentItem.changeTimeStr = '--'
        }
        else {
          rentItem.changeDateStr = util.formatDate(new Date(rentItem.changeDate))
          rentItem.changeTimeStr = util.formatTimeStr(new Date(rentItem.changeDate))
        }
      }
      for(var j = 0; rental.details && j < rental.details.length; j++){
        var detail = rental.details[j]
        var rDate = new Date(detail.rental_date)
        detail.rental_dateDateStr = util.formatDate(rDate)
        detail.amount = parseFloat(detail.amount).toFixed(2)
        detail.othersDiscountAmount = parseFloat(detail.othersDiscountAmount).toFixed(2)
        
        detail.summary = (parseFloat(detail.amount) - parseFloat(detail.othersDiscountAmount)).toFixed(2)
        detail.summaryStr = util.showAmount(parseFloat(detail.summary))
      }
    }
    for (var i = 0; order.appendingRentals && i < order.appendingRentals.length; i++) {
      var rental = order.appendingRentals[i]
      rental.realGuaranty = rental.guaranty
      rental.deposit = rental.guaranty
      if (!isNaN(rental.guaranty_discount)) {
        rental.realGuaranty = rental.guaranty - parseFloat(rental.guaranty_discount)
      }
      rental.realDepositStr = util.showAmount(rental.realGuaranty)
      if (rental.noGuaranty) {
        rental.realGuaranty = 0
        rental.guaranty_dicount = 0
        rental.realDepositStr = util.showAmount(rental.realGuaranty)
      }
      rental.startDate = util.formatDate(new Date(rental.start_date))
      var totalRentalAmount = 0
      for (var j = 0; rental.pricePresets && j < rental.pricePresets.length; j++) {
        var rentDate = new Date(rental.pricePresets[j].rent_date)
        rental.pricePresets[j].date = rentDate
        rental.pricePresets[j].priceStr = util.showAmount(rental.pricePresets[j].price)
        totalRentalAmount += rental.pricePresets[j].price
      }
      rental.totalRentalAmount = totalRentalAmount
      rental.totalDiscountAmountStr = util.showAmount(totalRentalAmount)
    }
    for (var i = 0; order.availablePayments && i < order.availablePayments.length; i++) {
      var payment = order.availablePayments[i]
      var paidDate = new Date(payment.paid_date)
      payment.paid_dateDateStr = util.formatDate(paidDate)
      payment.paid_dateTimeStr = util.formatTimeStr(paidDate)
      payment.amountStr = util.showAmount(payment.amount)
      payment.remainAmount = payment.amount;
      if (!isNaN(payment.refundedAmount)) {
        payment.remainAmount = payment.remainAmount - payment.refundedAmount
      }
      payment.remainAmountStr = util.showAmount(payment.remainAmount)
    }
    
    if (order.appendingRentals && order.appendingRentals.length > 0) {
      that.checkAppendingRentalValid()
    }
    if (order.closed == 1) {
      var closeDate = new Date(order.close_date)
      order.close_dateDateStr = util.formatDate(closeDate)
      order.close_dateTimeStr = util.formatTimeStr(closeDate)
    }
    else {
      order.close_dateDateStr = '--'
      order.close_dateTimeStr = '--'
    }
    order.packageNum = packageNum
    order.categoryNum = order.rentals.length - packageNum
    order.paidAmountStr = util.showAmount(order.paidAmount)
    order.refundAmountStr = util.showAmount(order.refundAmount)
    order.unRelieveGuaranty = unRelieveGuaranty
    order.unRelieveGuarantyStr = util.showAmount(unRelieveGuaranty)
    order.relieveGuarantyStr = util.showAmount(relieveGuaranty)
    order.totalGuarantyAmountStr = util.showAmount(order.totalGuarantyAmount)
    order.totalRentSummaryAmountStr = util.showAmount(order.totalRentSummaryAmount)
    order.totalRentNeedToRefundAmountStr = util.showAmount(order.totalRentNeedToRefundAmount)
    order.totalRentUnRefund = parseFloat(order.totalRentUnRefund.toFixed(2))
    order.totalRentOverTimeAmountStr = util.showAmount(order.totalRentOverTimeAmount)
    order.totalRentRepairationAmountStr = util.showAmount(order.totalRentRepairAmount)
    order.rentProperties.totalPaidGuarantyAmountStr = util.showAmount(order.rentProperties.totalPaidGuarantyAmount)
    order.rentProperties.relieveGuarantyAmountStr = util.showAmount(order.rentProperties.relieveGuarantyAmount)
    if (order.totalRentUnRefund < 0 && order.totalRentUnRefund > -0.001) {
      order.totalRentUnRefund = 0.001.toFixed(2) * -1
    }
    order.totalRentUnRefundStr = util.showAmount(order.totalRentUnRefund)
    if (order.member && order.member.availableDeposit) {
      order.member.availableDepositStr = util.showAmount(order.member.availableDeposit)
    }
    if (!isNaN(order.paying_amount)) {
      order.paying_amountStr = util.showAmount(parseFloat(order.paying_amount))
    }
    that.setData({
      allSettled, totalGuarantyAmount, totalSummary,
      totalSummaryStr: util.showAmount(totalSummary),
      totalGuarantyAmountStr: util.showAmount(totalGuarantyAmount),
      needToRefund: totalGuarantyAmount - totalSummary,
      needToRefundStr: util.showAmount(totalGuarantyAmount - totalSummary),
      payWithDeposit: order.depositPaidAmount == 0 ? false : true
    })
    return order
  },
  getData() {
    var that = this
    var id = that.data.id
    var getUrl = app.globalData.requestPrefix + 'Order/GetOrderByStaff/' + id + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, undefined).then(function (order) {
      console.log('get order', order)
      data.getShopByNamePromise(order.shop).then(function (shopObj) {
        that.setData({ shopObj })
      })
      for (var i = 0; order.rentals && i < order.rentals.length; i++) {
        if (order.rentals[i].id == 0) {
          continue
        }
        data.getRentalPromise(order.rentals[i].id, app.globalData.sessionKey).then(function (newRental) {
          for (var j = 0; j < order.rentals.length; j++) {
            if (order.rentals[j].id == newRental.id) {
              order.rentals[j] = newRental
              //var member = null
              if (!order.member_id) {
                order = that.renderOrder(order)
                that.setData({ order })
                that.checkAppendingRentalValid()
                that.setData({ order })
              }
              else {
                data.getMemberPromise(order.member_id, app.globalData.sessionKey).then(function (member) {
                  order.member = member
                  order = that.renderOrder(order)
                  that.setData({ order })
                  that.checkAppendingRentalValid()
                  that.setData({ order })
                })
              }
              break
            }
          }

        }).catch(function (exp) {

        })
      }
      //order = that.renderOrder(order)
      //that.setData({ order })
    }).catch(function () {

    })
  },
  onTabChange(e) {
    console.log('tab changed', e)
    var that = this
    that.setData({ activeTabIndex: e.detail.index })

  },
  showRentItem(e) {
    var that = this
    var id = e.currentTarget.id
    that.setData({ activeTabIndex: 1, currentRentalId: id })
  },
  showAllRentItem(e) {
    var that = this
    that.setData({ currentRentalId: null })
  },
  setPick(e) {
    var that = this
    var id = e.currentTarget.id
    wx.showModal({
      title: '确认发放',
      content: '',
      complete: (res) => {
        if (res.cancel) {

        }

        if (res.confirm) {
          data.setRentItemStatsPromise(id, '已发放', app.globalData.sessionKey).then(function (newRental) {
            that.refreshStatus(newRental)
          })
        }
      }
    })
  },
  setReturn(e) {
    var that = this
    var id = e.currentTarget.id
    var allReturned = true
    var order = that.data.order
    var message = ''
    var currentRental = null
    var currentItem = null
    for (var i = 0; order && order.rentals && i < order.rentals.length; i++) {
      for (var j = 0; order.rentals[i].rentItems && j < order.rentals[i].rentItems.length; j++) {
        if (order.rentals[i].rentItems[j].id == id) {
          currentRental = order.rentals[i]
          currentItem = order.rentals[i].rentItems[j]
          break
        }
      }
    }
    for (var i = 0; currentRental && i < currentRental.rentItems.length; i++) {
      if (currentRental.rentItems[i].status != '已归还'
        && currentRental.rentItems[i].status != '未发放'
        && currentRental.rentItems[i].status != '已更换'
        && currentRental.rentItems[i].id != id) {
        allReturned = false
      }
    }
    if (allReturned) {
      if (currentRental.package_id) {
        message = '套餐【' + currentRental.name + '】中的租赁物，即将全部归还，归还后套餐租金自动结算，此操作不可逆。'
      }
      else {
        message = '即将归还【' + currentRental.name + '】，租金自动结算，此操作不可逆。'
      }
    }
    else {
      message = '此操作不可逆。'
    }
    wx.showModal({
      title: '确认归还',
      content: message,
      complete: (res) => {
        if (res.cancel) {

        }

        if (res.confirm) {
          data.setRentItemStatsPromise(id, '已归还', app.globalData.sessionKey).then(function (newRental) {
            that.refreshStatus(newRental)
          })
        }
      }
    })
  },
  setUnReturn(e) {
    var that = this
    var id = e.currentTarget.id
    var allReturned = true
    var order = that.data.order
    var message = ''
    var currentRental = null
    var currentItem = null
    wx.showModal({
      title: '确认再次发放？',
      content: '发放后，该租赁商品的已结算状态会自动取消。',
      complete: (res) => {
        if (res.cancel) {

        }
        if (res.confirm) {
          data.setRentItemStatsPromise(id, '已发放', app.globalData.sessionKey).then(function (newRental) {
            that.refreshStatus(newRental)
          })
        }
      }
    })
  },
  setStore(e) {
    var that = this
    var id = e.currentTarget.id
    wx.showModal({
      title: '确认暂存',
      content: '',
      complete: (res) => {
        if (res.cancel) {

        }
        if (res.confirm) {
          data.setRentItemStatsPromise(id, '已暂存', app.globalData.sessionKey).then(function (newRental) {
            that.refreshStatus(newRental)
          })
        }
      }
    })
  },
  refreshStatus(rental) {
    var that = this
    var order = that.data.order
    var rentalIndex = util.getRentalIndexFromOder(rental.id, order)
    order.rentals[rentalIndex] = rental
    that.renderOrder(order)
    that.setData({ order })
  },
  showRentalDetail(e) {
    var that = this
    var id = e.currentTarget.id
    that.setData({ currentRentalId: id })
    that.setData({ showBackdrop: true, backDropType: 'confirm_rental' })
  },
  closeBackdrop(e) {
    var that = this
    if (e.detail) {
      console.log('close back drop', e)
      if (e.detail.rental) {
        var newRental = e.detail.rental
        var order = that.data.order
        var index = util.getRentalIndexFromOder(newRental.id, order)
        order.rentals[index] = newRental
        that.getData()
        //that.renderOrder(order)
        //that.setData({order})

      }
    }
    that.setData({ backDropType: null, currentRentalId: null, showBackdrop: false })
  },
  setRefundAmount(e) {
    var that = this
    var value = e.detail.value
    if (!isNaN(value)) {
      that.setData({ refundAmount: value })
    }
  },

  refund(e) {
    var that = this
    if (that.data.payWithDeposit == true) {
      that.refundWithDeposit(e)
      return;
    }
    if (!that.data.refundAmount) {
      var order = that.data.order
      that.data.refundAmount = order.totalRentUnRefund
    }
    if (!that.data.refundAmount || isNaN(that.data.refundAmount) || that.data.refundAmount == 0) {
      wx.showToast({
        title: '退款金额必填',
        icon: 'error'
      })
      return
    }

    wx.showModal({
      title: '确认退款',
      content: '退款金额：' + util.showAmount(that.data.refundAmount),
      complete: (res) => {
        if (res.cancel) {

        }
        if (res.confirm) {
          that.setData({ refunding: true })
          var payment = null
          var order = that.data.order
          var refundAmount = parseFloat(that.data.refundAmount)
          for (var i = 0; order && order.availablePayments && i < order.availablePayments.length; i++) {
            var paymentUnRefund = parseFloat(order.availablePayments[i].unRefundedAmount.toString())
            if (order.availablePayments[i].status == '支付成功'
              && parseFloat(paymentUnRefund.toFixed(2)) >= parseFloat(refundAmount.toFixed(2))) {
              payment = order.availablePayments[i]
              break
            }
          }
          if (payment == null) {
            wx.showToast({
              title: '无可退款支付记录',
              icon: 'error'
            })
            return
          }
          var refunds = [{
            payment_id: payment.id,
            amount: parseFloat(refundAmount.toFixed(2)),
            reason: '租赁退押金'
          }]
          data.refundPromise(order.id, refunds, app.globalData.sessionKey).then(function (order) {
            that.getData()
            wx.showToast({
              title: '退款成功',
              icon: 'success'
            })
          })
        }
      }
    })
  },
  refundWithDeposit(e) {
    var that = this
    var order = that.data.order
    var title = '储值支付确认'
    var payAmount = order.totalRentSummaryAmount
    var refundAmount = order.totalRentUnRefund
    var content = '储值支付租金' + util.showAmount(payAmount) + '，应退押金：' + util.showAmount(refundAmount)
    wx.showModal({
      title: title,
      content: content,
      complete: (res) => {
        if (res.cancel) {

        }

        if (res.confirm) {
          that.setData({ refunding: true })
          data.payWithDepositPromise(order.id, app.globalData.sessionKey).then(function (paidOrder) {
            if (paidOrder == null) {
              return
            }
            console.log('paid order', paidOrder)
            var refundAmount = paidOrder.totalRentUnRefund
            var payment = null
            for (var i = 0; order && order.availablePayments && i < order.availablePayments.length; i++) {
              var paymentUnRefund = parseFloat(order.availablePayments[i].unRefundedAmount.toString())
              if (order.availablePayments[i].status == '支付成功'
                && parseFloat(paymentUnRefund.toFixed(2)) >= parseFloat(refundAmount.toFixed(2))) {
                payment = order.availablePayments[i]
                break
              }
            }
            if (payment == null) {
              wx.showToast({
                title: '无可退款支付记录',
                icon: 'error'
              })
              return
            }
            var refunds = [{
              payment_id: payment.id,
              amount: parseFloat(refundAmount.toFixed(2)),
              reason: '租赁退押金'
            }]
            data.refundPromise(order.id, refunds, app.globalData.sessionKey).then(function (order) {
              that.getData()
              wx.showToast({
                title: '退款成功',
                icon: 'success'
              })
            })

          })
        }
      }
    })
  },
  modMemo(e) {
    var that = this
    var index = e.currentTarget.id
    var order = that.data.order
    var rental = order.rentals[index]
    rental.moddingMemo = true;
    that.setData({ order })
  },
  modMemoCancel(e) {
    var that = this
    var index = e.currentTarget.id
    var order = that.data.order
    var rental = order.rentals[index]
    rental.moddingMemo = false;
    that.setData({ order })
    that.getData()
  },
  setMemo(e) {
    var that = this
    var index = e.currentTarget.id
    var order = that.data.order
    var rental = order.rentals[index]
    rental.memo = e.detail.value
  },
  modMemoConfirm(e) {
    var that = this
    var index = e.currentTarget.id
    var order = that.data.order
    var rental = order.rentals[index]
    data.updateRentalPromise(rental, '租赁订单详细页修改备注', app.globalData.sessionKey)
      .then(function (newRental) {
        wx.showToast({
          title: '修改成功',
          icon: 'success'
        })
        newRental.moddingMemo = false
        order.rentals[index] = newRental
        that.renderOrder(order)
        that.setData({ order })
      })
  },
  setRepair(e) {
    var that = this
    var order = that.data.order
    var rentals = order.rentals
    var rentItem = null
    var id = e.currentTarget.id
    for (var i = 0; rentals && rentItem == null && i < rentals.length; i++) {
      var rentItemIndex = util.getRentItemIndexFromRental(id, rentals[i])
      if (rentItemIndex != null) {
        rentItem = rentals[i].rentItems[rentItemIndex]
      }
    }
    if (rentItem == null) {
      return
    }
    rentItem.setRepairing = true
    that.setData({ order })
  },
  setRepairCancel(e) {
    var that = this
    var order = that.data.order
    var rentals = order.rentals
    var rentItem = null
    var id = e.currentTarget.id
    for (var i = 0; rentals && rentItem == null && i < rentals.length; i++) {
      var rentItemIndex = util.getRentItemIndexFromRental(id, rentals[i])
      if (rentItemIndex != null) {
        rentItem = rentals[i].rentItems[rentItemIndex]
      }
    }
    if (rentItem == null) {
      return
    }
    rentItem.setRepairing = false
    that.setData({ order })
  },
  setRepairAmount(e) {
    var value = e.detail.value
    if (isNaN(value)) {
      return
    }
    var that = this
    var order = that.data.order
    var rentals = order.rentals
    var rentItem = null
    var id = e.currentTarget.id
    var currentRental = null
    for (var i = 0; rentals && rentItem == null && i < rentals.length; i++) {
      var rentItemIndex = util.getRentItemIndexFromRental(id, rentals[i])
      if (rentItemIndex != null) {
        rentItem = rentals[i].rentItems[rentItemIndex]
        currentRental = rentals[i]
      }
    }
    if (rentItem == null) {
      return
    }
    rentItem.totalRepairationAmount = parseFloat(value)


  },
  setRepairConfirm(e) {
    var that = this
    var order = that.data.order
    var rentals = order.rentals
    var rentItem = null
    var id = e.currentTarget.id
    var currentRental = null
    for (var i = 0; rentals && rentItem == null && i < rentals.length; i++) {
      var rentItemIndex = util.getRentItemIndexFromRental(id, rentals[i])
      if (rentItemIndex != null) {
        rentItem = rentals[i].rentItems[rentItemIndex]
        currentRental = rentals[i]
      }
    }
    if (rentItem == null) {
      return
    }
    var setUrl = app.globalData.requestPrefix + 'Rent/SetRentItemRepairAmount/' + rentItem.id.toString() + '?amount=' + rentItem.totalRepairationAmount.toString() + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(setUrl, null).then(function (newRental) {
      //currentRental = newRental
      that.getData()
      //that.renderOrder(order)
      //that.setData({ order })
      that.setRepairCancel(e)
    })
  },
  call(e) {
    var cell = e.currentTarget.id
    wx.setClipboardData({
      data:cell,
      success:(res)=>{
        wx.showToast({
          icon: 'success',
          message: '手机号码已复制'
        })
      },
      fail:(res)=>{
        console.log('复制失败', res)
      }
    })
    wx.makePhoneCall({
      phoneNumber: cell,
    })
  },
  setPayWithDeposit(e) {
    var that = this
    var payWithDeposit = e.detail.value.length == 1 ? true : false
    var order = that.data.order
    if (payWithDeposit) {
      order.totalRentUnRefund = order.totalRentUnRefund + order.totalRentSummaryAmount
    }
    else {
      order.totalRentUnRefund = order.totalRentUnRefund - order.totalRentSummaryAmount
    }
    order.totalRentUnRefund = parseFloat(order.totalRentUnRefund.toFixed(2))
    that.renderOrder(order)
    that.setData({ order, payWithDeposit })
  },
  gotoChange(e) {
    var that = this
    var rentItemId = e.currentTarget.id
    wx.navigateTo({
      url: 'rent_item_change?orderId=' + that.data.order.id.toString() + '&rentItemId=' + rentItemId.toString()
    })
  },
  addNewPackage(e) {
    var that = this
    that.setData({ showSelectPackagePopUp: true })
  },
  cancelPackagePopUp(e) {
    var that = this
    that.setData({ showSelectPackagePopUp: false })
  },
  cancelCategoryPopUp(e) {
    var that = this
    that.setData({ showSelectCategoryPopUp: false })
  },
  addNewCategory(e) {
    var that = this
    that.setData({ showSelectCategoryPopUp: true })
  },
  selectPackageConfirm(e) {
    console.log('select package', e)
    var that = this
    var order = that.data.order
    var appendUrl = app.globalData.requestPrefix + 'Rent/AppendRental/' + order.id.toString()
      + '?packageId=' + e.detail.id.toString() + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(appendUrl, null).then(function (order) {
      console.log('append order', order)
      that.renderOrder(order)
      that.setData({ order })
    })
    that.cancelPackagePopUp()
  },
  confirmCategory(e) {
    console.log('select category', e)
    var that = this
    var order = that.data.order
    var appendUrl = app.globalData.requestPrefix + 'Rent/AppendRental/' + order.id.toString()
      + '?categoryId=' + e.detail.id.toString() + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(appendUrl, null).then(function (order) {
      console.log('append order', order)
      that.renderOrder(order)
      that.setData({ order })
    })
    that.cancelCategoryPopUp()
  },
  showItem(e) {
    var that = this
    var id = e.currentTarget.id
    var order = that.data.order
    var currentRental = order.appendingRentals[parseInt(id)]
    that.setData({ currentRental, showBackdrop: true, action: 'item' })
  },
  showPackage(e) {
    var that = this
    var id = e.currentTarget.id
    var order = that.data.order
    var currentRental = order.appendingRentals[parseInt(id)]
    if (currentRental != null) {
      that.setData({ currentRental, showBackdrop: true, action: 'package' })
    }
  },
  cancelBackdrop(e) {
    var that = this
    that.data.modAppendingRental = null
    that.setData({ showBackdrop: false, action: null, currentRental: null, currentItem: null, unSavedRental: null })
  },
  delAppeningRental(e) {
    var that = this
    var id = e.currentTarget.id
    var order = that.data.order
    var rental = order.appendingRentals[parseInt(id)]
    wx.showModal({
      title: '确认删除',
      content: '正在添加的租赁商品：' + rental.name + ' 即将删除。',
      complete: (res) => {
        if (res.cancel) {
        }
        if (res.confirm) {
          var delUrl = app.globalData.requestPrefix + 'Rent/RemoveAppendingRental/' + rental.id.toString() + '?sessionKey=' + app.globalData.sessionKey
          util.performWebRequest(delUrl, null).then(function (order) {
            that.renderOrder(order)
            that.setData({ order })
            that.checkAppendingRentalValid()
            that.setData({ order })
          })
        }
      }
    })
  },
  showPriceList(e) {
    var that = this
    var id = parseInt(e.currentTarget.id)
    var order = that.data.order
    var shop = order.shop
    var rental = order.appendingRentals[id]
    var targetId = rental.package_id ? rental.package_id : rental.category_id
    var isWeekend = util.isWeekend(new Date(rental.start_date))
    that.setData({
      showBackdrop: true, action: 'priceList',
      dayType: isWeekend ? '周末' : '平日',
      type: rental.package_id ? '套餐' : '分类', shop, targetId
    })
  },
  getAppendingRentItem(id) {
    var that = this
    var order = that.data.order
    var appendingRentals = order.appendingRentals
    var item = null
    for (var i = 0; item == null && appendingRentals && i < appendingRentals.length; i++) {
      var rental = appendingRentals[i]
      for (var j = 0; item == null && rental.rentItems && j < rental.rentItems.length; j++) {
        if (id == rental.rentItems[j].id) {
          item = rental.rentItems[j]
        }
      }
    }
    return item
  },
  getAppendingRental(id) {
    var that = this
    var order = that.data.order
    var appendingRentals = order.appendingRentals
    var rental = null
    for (var i = 0; rental == null && appendingRentals && i < appendingRentals.length; i++) {
      if (appendingRentals[i].id == id) {
        rental = appendingRentals[i]
      }
    }
    return rental
  },
  setNoCode(e) {
    var that = this
    var noCode = e.detail.value.length == 1
    var id = e.currentTarget.id
    var item = that.getAppendingRentItem(parseInt(id))
    item.noCode = noCode
    var order = that.data.order
    order = that.renderOrder(order)
    that.setData({ order })
  },
  setCode(e) {
    var that = this
    var code = e.detail.value
    var id = e.currentTarget.id
    var item = that.getAppendingRentItem(parseInt(id))
    item.code = code
    var order = that.data.order
    order = that.renderOrder(order)
    that.setData({ order })
  },
  setName(e) {
    var that = this
    var name = e.detail.value
    var id = e.currentTarget.id
    var item = that.getAppendingRentItem(parseInt(id))
    item.name = name
    var order = that.data.order
    order = that.renderOrder(order)
    that.setData({ order })
  },
  setAppendingItemMemo(e) {
    var that = this
    var memo = e.detail.value
    var id = e.currentTarget.id
    var item = that.getAppendingRentItem(parseInt(id))
    item.memo = memo
  },
  setAppendingRentalMemo(e) {
    var that = this
    var memo = e.detail.value
    var id = e.currentTarget.id
    var item = that.getAppendingRental(parseInt(id))
    item.memo = memo
  },
  setNoNeed(e) {
    var that = this
    var noNeed = e.detail.value.length == 1
    var id = e.currentTarget.id
    var item = that.getAppendingRentItem(parseInt(id))
    item.noNeed = noNeed
    var order = that.data.order
    order = that.renderOrder(order)
    that.checkAppendingRentalValid()
    that.setData({ order })
  },
  setStartDate(e) {
    var that = this
    var startDate = e.detail.value
    var id = e.currentTarget.id
    var rental = that.getAppendingRental(parseInt(id))
    rental.start_date = new Date(startDate)
    rental.startDate = util.formatDate(rental.start_date)
    var order = that.data.order
    order = that.renderOrder(order)
    that.setData({ order })
  },
  setNoGuaranty(e) {
    var that = this
    var noGuaranty = e.detail.value.length == 1
    var id = e.currentTarget.id
    var rental = that.getAppendingRental(parseInt(id))
    rental.noGuaranty = noGuaranty
    var order = that.data.order
    order = that.renderOrder(order)
    that.setData({ order })
  },
  onRentalChange(e) {
    console.log('appending changed', e)
    var that = this
    var rental = e.detail
    that.data.modAppendingRental = rental
  },
  saveUpdatedRental(e) {
    var that = this
    var modAppendingRental = that.data.modAppendingRental
    var appendingRentals = that.data.order.appendingRentals
    if (!modAppendingRental) {
      return
    }
    for (var j = 0; appendingRentals && j < appendingRentals.length; j++) {
      if (appendingRentals[j].id == modAppendingRental.id) {
        appendingRentals[j] = modAppendingRental
      }
    }

    var order = that.data.order
    order = that.renderOrder(order)
    that.setData({ order })
    that.cancelBackdrop(e)
  },
  checkAppendingRentalValid() {
    var that = this
    var allValid = true
    var order = that.data.order
    if (!order) {
      return
    }
    var rentals = that.data.order.appendingRentals
    if (!rentals) {
      return
    }
    for (var i = 0; rentals && i < rentals.length; i++) {
      var rentalWellformed = true
      var rentItems = rentals[i].rentItems
      for (var j = 0; rentItems && j < rentItems.length; j++) {
        var rentItem = rentItems[j]
        if (rentItem.noNeed) {
          rentItem.wellFormed = true
        }
        else if (rentItem.noCode) {
          if (rentItem.name && rentItem.name != '') {
            rentItem.wellFormed = true
          }
          else {
            rentItem.wellFormed = false
            rentalWellformed = false
            allValid = false
          }
        }
        else {
          if (rentItem.code && rentItem.code != '') {
            rentItem.wellFormed = true
          }
          else {
            rentItem.wellFormed = false
            rentalWellformed = false
            allValid = false
          }
        }

      }
      rentals[i].wellFormed = rentalWellformed
    }
    that.setData({ allValid })
  },
  saveAppendings(e) {
    var that = this
    var order = that.data.order
    var appendings = order.appendingRentals
    var appUrl = app.globalData.requestPrefix + 'Rent/SaveAppendings/' + order.id.toString() + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(appUrl, appendings).then(function (order) {
      console.log('append', order)
      if (order.paying_amount > 0) {
        order = that.renderOrder(order)
        that.data.order = order
        that.checkAppendingRentalValid()
        that.setData({ order, showAppendPay: true })
      }
      else {
        that.getData()
        //order = that.renderOrder(order)
        //that.setData({ order })
      }
    })
  },
  closeAppendPay(e) {
    var that = this
    that.setData({ showAppendPay: false })
  },
  orderStatusChanged() {
    var that = this
    that.getData()
  },
  dealPaidResult(e) {
    var that = this
    var orderId = e.detail.id
    data.getOrderByStaffPromise(orderId, app.globalData.sessionKey).then(function (order) {
      var paid = util.orderPaid(order)
      if (paid) {
        wx.showToast({
          title: '支付成功',
          icon: 'success'
        })
        that.setData({ showAppendPay: false })
        that.getData()
      }
    })
  },
  showBalance(e) {
    var that = this
    that.setData({ showBalance: true })
  },
  closeBalance(e) {
    var that = this
    that.setData({ showBalance: false })
  },
  setRefund(e) {
    var that = this
    var value = e.detail.value
    console.log('set refund', value)
    var order = that.data.order
    var payments = order.availablePayments
    for (var i = 0; payments && i < payments.length; i++) {
      var payment = payments[i]
      payment.needToRefund = false
      for (var j = 0; value && j < value.length; j++) {
        var id = parseInt(value[j])
        if (id == i) {
          payment.needToRefund = true
        }
      }
    }
    that.checkRefundValid()
    that.setData({ order })
  },
  setRefundAmount(e) {
    var that = this
    var value = e.detail.value
    if (isNaN(value)) {
      return
    }
    var id = parseInt(e.currentTarget.id)
    var order = that.data.order
    var payment = order.availablePayments[id]
    var refundAmount = parseFloat(parseFloat(value).toFixed(2))
    payment.remainAmount = parseFloat(payment.remainAmount.toFixed(2))
    if (payment.remainAmount < refundAmount) {
      wx.showToast({
        title: '可退金额不足',
        icon: 'error'
      })
      return
    }
    payment.needToRefundAmount = refundAmount
    that.checkRefundValid()
    that.setData({ order })
  },
  checkRefundValid() {
    var that = this
    var refundValid = true
    var order = that.data.order
    var payments = order.availablePayments
    var filledTotalRefund = 0
    for (var i = 0; payments && i < payments.length; i++) {
      var payment = payments[i]
      if (payment.needToRefund == true) {
        if (isNaN(payment.needToRefundAmount)) {
          refundValid = false
        }
        else if (payment.remainAmount < payment.needToRefundAmount) {
          refundValid = false
        }
        else {
          filledTotalRefund += parseFloat(payment.needToRefundAmount.toFixed(2))
        }
      }
    }
    that.setData({ filledTotalRefund, filledTotalRefundStr: util.showAmount(filledTotalRefund), refundValid })
  },
  refundBatch(e) {
    var that = this
   
    if (that.data.payWithDeposit == true) {
      that.refundBatchWithDeposit(e)
      return;
    }
    var order = that.data.order
    var payments = order.availablePayments
    var refunds = []
    var refundCount = 0
    var refundAmount = 0
    for (var i = 0; payments && i < payments.length; i++) {
      var payment = payments[i]
      if (payment.needToRefund == true) {
        var refund = {
          payment_id: payment.id,
          amount: parseFloat(payment.needToRefundAmount.toFixed(2)),
          reason: '批量退款'
        }
        refundCount++
        refundAmount += refund.amount
        refunds.push(refund)
      }
    }
    wx.showModal({
      title: '确认批量退款',
      content: '批量退款' + refundCount + '笔，总退款金额：' + util.showAmount(refundAmount),
      complete: (res) => {
        if (res.cancel) {
          that.setData({ refunding: false })
        }

        if (res.confirm) {
          that.setData({ refunding: true })
          data.refundPromise(order.id, refunds, app.globalData.sessionKey).then(function (order) {
            that.getData()
            that.setData({ refunding: false })
            wx.showToast({
              title: '退款成功',
              icon: 'success'
            })
          })
        }
      }
    })
  },
  refundBatchWithDeposit(e){
    var that = this
    var order = that.data.order
    var title = '储值支付确认'
    var payAmount = order.totalRentSummaryAmount
    var refundAmount = order.totalRentUnRefund
    var content = '储值支付租金' + util.showAmount(payAmount) + '，应退押金：' + util.showAmount(refundAmount)
    wx.showModal({
      title: title,
      content: content,
      complete: (res) => {
        if (res.cancel) {

        }

        if (res.confirm) {
          that.setData({ refunding: true })
          data.payWithDepositPromise(order.id, app.globalData.sessionKey).then(function (paidOrder) {
            if (paidOrder == null) {
              return
            }
            console.log('paid order', paidOrder)
            //var order = paidOrder
            var payments = order.availablePayments
            var refunds = []
            var refundCount = 0
            var refundAmount = 0
            for (var i = 0; payments && i < payments.length; i++) {
              var payment = payments[i]
              if (payment.needToRefund == true) {
                var refund = {
                  payment_id: payment.id,
                  amount: parseFloat(payment.needToRefundAmount.toFixed(2)),
                  reason: '批量退款'
                }
                refundCount++
                refundAmount += refund.amount
                refunds.push(refund)
              }
            }
            data.refundPromise(order.id, refunds, app.globalData.sessionKey).then(function (order) {
              that.getData()
              that.setData({ refunding: false })
              wx.showToast({
                title: '退款成功',
                icon: 'success'
              })
            })
          })
        }
      }
    })
  },
  orderStatusChanged() {
    var that = this
    that.getData()
  },
  dealPaidResult(e) {
    var that = this
    var orderId = e.detail.id
    data.getOrderByStaffPromise(orderId, app.globalData.sessionKey).then(function (order) {
      var paid = util.orderPaid(order)
      if (paid) {
        wx.showToast({
          title: '支付成功',
          icon: 'success'
        })
        that.getData()
      }
      
    })
  },
  expandOrderInfo(e){
    var that = this
    that.setData({orderInfoExpand: e.detail})
  },
  expandPayInfo(e){
    var that = this
    that.setData({payInfoExpand: e.detail, showBalance: true})
  },
  expandRental(e){
    var that = this
    that.setData({expandRentals: e.detail})
    console.log('expand rental', e)
  },
  expandRentalDetail(e){
    var that = this
    that.setData({acrtiveRentalDetails: e.detail})
  },
  expandRentalItem(e){
    var that = this
    that.setData({acrtiveRentalItems: e.detail})
  },
  modItemMemo(e){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var order = that.data.order
    var rental = order.rentals[parseInt(idArr[0])]
    var item = rental.rentItems[parseInt(idArr[1])]
    item.moddingMemo = true
    that.setData({order})
  },
  setItemMemo(e){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var order = that.data.order
    var rental = order.rentals[parseInt(idArr[0])]
    var item = rental.rentItems[parseInt(idArr[1])]
    item.memo = e.detail.value
  },
  modItemMemoConfirm(e){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var order = that.data.order
    var rental = order.rentals[parseInt(idArr[0])]
    var item = rental.rentItems[parseInt(idArr[1])]
    data.updateRentItemPromise(item, '租赁订单详细页修改备注', app.globalData.sessionKey)
      .then(function (newItem) {
        wx.showToast({
          title: '修改成功',
          icon: 'success'
        })
        item.moddingMemo = false
        order.rentals[parseInt(idArr[0])].rentItems[parseInt(idArr[1])] = newItem
        that.renderOrder(order)
        that.setData({ order })
      })
  },
  modItemMemoCancel(e){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var order = that.data.order
    var rental = order.rentals[parseInt(idArr[0])]
    var item = rental.rentItems[parseInt(idArr[1])]
    item.moddingMemo = false
    that.setData({order})
  },
  setModRentalDetail(e){
    var that = this
    var order = that.data.order
    var id = parseInt(e.currentTarget.id)
    var rental = order.rentals[id]
    rental.moddingRentalDetail = true
    that.setData({order})
  },
  cancelModRenrtalDetail(e){
    var that = this
    var order = that.data.order
    var id = parseInt(e.currentTarget.id)
    var rental = order.rentals[id]
    data.getRentalPromise(rental.id, app.globalData.sessionKey).then(function(newRental){
      order.rentals[id] = newRental
      that.renderOrder(order)
      that.setData({order})
    })
  },
  addModRenrtalDetail(e){
    var that = this
    var order = that.data.order
    var id = parseInt(e.currentTarget.id)
    var rental = order.rentals[id]
    var details = rental.details
    var detail = {
      id: 0,
      rental_date: util.formatDate(new Date()),
      charge_type: '租金',
      amount: parseFloat(details[details.length - 1].amount).toFixed(2),
      othersDiscountAmount: '0.00',
      summaryStr: util.showAmount(parseFloat(details[details.length - 1].amount)),
      valid: 1
    }
    details.push(detail)
    that.renderOrder(order)
    that.setData({order})
  },
  showCalendar(e){
    var that = this
    var calenderId = e.currentTarget.id
    that.setData({showCalendar: true, calenderId})
  },
  onCloseCalendar(e){
    var that = this
    that.setData({showCalendar: false, calenderId: null})
  },
  onConfirmCalendar(e){
    var resDate = new Date(e.detail)
    var that = this
    var idArr = that.data.calenderId.split('_')
    var order = that.data.order
    var rental = order.rentals[parseInt(idArr[0])]
    var detail = rental.details[parseInt(idArr[1])]
    detail.rental_dateStr = util.formatDate(resDate)
    detail.rental_date = util.formatDate(resDate)
    that.renderOrder(order)
    that.setData({order, calenderId: null, showCalendar: false})
  },
  checkRentalValid(e){
    var that = this
    var id = parseInt(e.currentTarget.id)
    var order = that.data.order
    var rental = order.rentals[id]
    for(var i = 0; i < rental.details.length; i++){
      rental.details[i].valid = 1
    }
    for(var i = 0; i < e.detail.value.length; i++){
      rental.details[parseInt(e.detail.value[i])].valid = 0
    }
    that.renderOrder(order)
    that.setData({order})
  },
  setRentalDetailAmount(e){
    var value = e.detail.value
    if (!value || isNaN(value)){
      return
    }
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var order = that.data.order
    var rental = order.rentals[parseInt(idArr[0])]
    var detail = rental.details[parseInt(idArr[1])]
    detail.amount = parseFloat(value).toFixed(2)
    that.renderOrder(order)
    that.setData({order})
  },
  setRentalDetailDiscount(e){
    var value = e.detail.value
    if (!value || isNaN(value)){
      return
    }
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var order = that.data.order
    var rental = order.rentals[parseInt(idArr[0])]
    var detail = rental.details[parseInt(idArr[1])]
    detail.othersDiscountAmount = parseFloat(value).toFixed(2)
    detail._filledDiscountAmount = parseFloat(detail.othersDiscountAmount)
    that.renderOrder(order)
    that.setData({order})
  },
  confirmModRenrtalDetail(e){
    var id = parseInt(e.currentTarget.id)
    var that = this
    var order = that.data.order
    var rental = order.rentals[id]
    var updateUrl = app.globalData.requestPrefix + 'Rent/UpdateRentalDetailsByStaff/' + rental.id.toString() + '?scene=' + encodeURIComponent('租赁详情页修改租金') + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(updateUrl, rental.details).then(function(newRental){
      order.rentals[id] = newRental
      that.renderOrder(order)
      that.setData({order})
    })
  },
  expandRentalItemChange(e){
    var that = this
    var showChanges = e.detail
    if (showChanges.length == 0){
      that.setData({showChanges})
      return
    }
    var idArr = e.detail[0].split('_')
    var order = that.data.order
    var rental = order.rentals[parseInt(idArr[0])]
    var rentItem = rental.rentItems[parseInt(idArr[1])]
    
    var getChangesUrl = app.globalData.requestPrefix + 'Rent/GetRentItemChanges/' + rentItem.id.toString() + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getChangesUrl, null).then(function (changesLog){
      for(var i = 0; changesLog && i < changesLog.length; i++){
        var changeDate = new Date(changesLog[i].changeDate)
        changesLog[i].changeDateStr = util.formatDate(changeDate)
        changesLog[i].changeTimeStr = util.formatTimeStr(changeDate)
      }
      rentItem.changesLog = changesLog
      that.setData({order, showChanges})
    })
  },
  openAppending(e){
    var that = this
    that.setData({appendingOpenIndex: e.detail})
  }
})
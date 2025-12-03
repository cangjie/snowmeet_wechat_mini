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
    payWithDeposit: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({ id: options.id })
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
      rental.titleName = rental.package_id ? ('套餐-' + rental.name) : ('单品-' + rental.name)
      rental.totalRentalAmountStr = util.showAmount(rental.totalRentalAmount)
      rental.totalRepairationAmountStr = util.showAmount(rental.totalRepairationAmount)
      rental.totalOvertimeAmountStr = util.showAmount(rental.totalOvertimeAmount)
      rental.totalDiscountAmountStr = util.showAmount(rental.totalDiscountAmount)
      rental.summary = rental.totalRentalAmount + rental.totalRepairationAmount + rental.totalOvertimeAmount
        - rental.ticketDiscountAmount - rental.othersDiscountAmount
      totalSummary += rental.summary
      rental.totalSummaryStr = util.showAmount(rental.totalSummary)
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
      }

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
    if (order.member && order.member.availableDeposit){
      order.member.availableDepositStr = util.showAmount(order.member.availableDeposit)
    }
    that.setData({
      allSettled, totalGuarantyAmount, totalSummary,
      totalSummaryStr: util.showAmount(totalSummary),
      totalGuarantyAmountStr: util.showAmount(totalGuarantyAmount),
      needToRefund: totalGuarantyAmount - totalSummary,
      needToRefundStr: util.showAmount(totalGuarantyAmount - totalSummary)
    })
    return order
  },
  getData() {
    var that = this
    var id = that.data.id
    var getUrl = app.globalData.requestPrefix + 'Order/GetOrderByStaff/' + id + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, undefined).then(function (order) {
      console.log('get order', order)
      
      for (var i = 0; order.rentals && i < order.rentals.length; i++) {
        if (order.rentals[i].id == 0) {
          continue
        }
        data.getRentalPromise(order.rentals[i].id, app.globalData.sessionKey).then(function (newRental) {
          for (var j = 0; j < order.rentals.length; j++) {
            if (order.rentals[j].id == newRental.id) {
              order.rentals[j] = newRental
              //var member = null
              if (!order.member_id){
                that.renderOrder(order)
                that.setData({ order })
              }
              else {
                data.getMemberPromise(order.member_id, app.globalData.sessionKey).then(function (member){
                  order.member = member
                  that.renderOrder(order)
                  that.setData({ order })
                })
              }
              break
            }
          }

        }).catch(function (exp) {

        })
      }
      order = that.renderOrder(order)
      that.setData({ order })
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
      if (currentRental.rentItems[i].status != '已归还' && currentRental.rentItems[i].status != '未发放'
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
    /*
    for(var i = 0; order && order.rentals && i < order.rentals.length; i++){
      for(var j = 0; order.rentals[i].rentItems && j < order.rentals[i].rentItems.length; j++){
        if (order.rentals[i].rentItems[j].id == id){
          currentRental = order.rentals[i]
          currentItem = order.rentals[i].rentItems[j]
          break
        }
      }
    }
    for(var i = 0; currentRental && i < currentRental.rentItems.length; i++){
      if (currentRental.rentItems[i].status != '已归还' && currentRental.rentItems[i].status != '未发放'
        && currentRental.rentItems[i].id != id){
        allReturned = false
      }
    }
    if (allReturned){
      if (currentRental.package_id){
        message = '套餐【' + currentRental.name + '】中的租赁物，即将全部归还，归还后套餐租金自动结算，此操作不可逆。'
      }
      else{
        message = '即将归还【' + currentRental.name + '】，租金自动结算，此操作不可逆。'
      }
    }
    else{
      message = '此操作不可逆。'
    }
    */
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
    if (that.data.payWithDeposit == true){
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
            //console.log('refund amount', order.availablePayments[i].unRefundedAmount)
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
  refundWithDeposit(e){
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
          data.payWithDepositPromise(order.id, app.globalData.sessionKey).then(function(order){
            
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
  call(e){
    var cell = e.currentTarget.id
    wx.makePhoneCall({
      phoneNumber: cell,
    })
  },
  setPayWithDeposit(e){
    var that = this
    var payWithDeposit = e.detail.value.length == 1? true: false
    //that.setData({payWithDeposit: e.detail.value.length == 1? true: false})
    var order = that.data.order
    if (payWithDeposit){
      order.totalRentUnRefund = order.totalRentUnRefund + order.totalRentSummaryAmount
    }
    else{
      order.totalRentUnRefund = order.totalRentUnRefund - order.totalRentSummaryAmount
    }
    order.totalRentUnRefund = parseFloat(order.totalRentUnRefund.toFixed(2))
    that.setData({order, payWithDeposit})
  }
})
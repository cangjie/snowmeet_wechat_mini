// pages/admin/rent/rent_order_detail/rent_order_detail.js
var app = getApp()
var util = require('../../../../utils/util.js')
var data = require('../../../../utils/data.js')

function formatDisplayOrderCode(rawCode) {
  var code = rawCode == null ? '' : String(rawCode)
  if (code.length <= 6) {
    return code || '—'
  }
  return '…' + code.slice(6)
}

Page({
  data: {
    id: null,
    order: null,
    shopObj: null,
    _compactScreen: false,

    _orderInfoExpanded: true,
    _paymentDetailExpanded: false,
    _refundExpanded: true,

    _rentalTab: 0,
    _expandedRentals: {},
    _expandedDetails: {},
    _expandedItems: {},
    _expandedItemLogs: {},
    _expandedItemChanges: {},

    allValid: false,

    // 租金明细按天编辑弹窗
    _dayChargeShow: false,
    _dayChargeRidx: null,
    _dayChargeDetailId: null,
    _dayChargeDate: '',
    _dayChargeRent: '',
    _dayChargeOvertime: '',
    _dayChargeDiscount: '',
    _dayChargeRentOrig: '',
    _dayChargeOvertimeOrig: '',
    _dayChargeDiscountOrig: '',
  },

  onLoad(options) {
    this.setData({ id: parseInt(options.id) })
  },

  onShow() {
    var that = this
    app.loginPromiseNew.then(function () {
      var uiProfile = app.globalData.uiProfile || {}
      that.setData({ _compactScreen: !!uiProfile.isCompact })
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

    order._displayCode = formatDisplayOrderCode(order.code || order.id)

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
        rentItem._picked = rentItem.pickDate != null
        rentItem._returned = rentItem.returnDate != null
      }

      // 租金明细（按天聚合：每天一行，含 租金 / 超时费 / 减免 / 小计；赔偿金按租赁物维度，不进此表）
      var feeDayMap = {}
      var feeRows = []
      for (var j = 0; rental.details && j < rental.details.length; j++) {
        var detail = rental.details[j]
        if (detail.valid != 1) continue
        var ct = (detail.charge_type || '').trim()
        if (ct != '租金' && ct != '超时费') continue
        var dayKey = util.formatDate(new Date(detail.rental_date))
        var row = feeDayMap[dayKey]
        if (!row) {
          row = { dateStr: dayKey, rentDetailId: null, rent: 0, overtime: 0, discount: 0 }
          feeDayMap[dayKey] = row
          feeRows.push(row)
        }
        if (ct == '租金') {
          row.rentDetailId = detail.id
          row.rent = parseFloat(detail.amount) || 0
          row.discount = parseFloat(detail.othersDiscountAmount) || 0
        } else {
          row.overtime += parseFloat(detail.amount) || 0
        }
      }
      for (var fi = 0; fi < feeRows.length; fi++) {
        var r0 = feeRows[fi]
        r0.subtotal = r0.rent + r0.overtime - r0.discount
        r0.rentStr = util.showAmount(r0.rent)
        r0.overtimeStr = util.showAmount(r0.overtime)
        r0.discountStr = util.showAmount(r0.discount)
        r0.subtotalStr = util.showAmount(r0.subtotal)
      }
      rental.feeRows = feeRows
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
  onTogglePaymentDetail() {
    this.setData({ _paymentDetailExpanded: !this.data._paymentDetailExpanded })
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

  // 点某天租金行 → 弹窗编辑 当天租金 / 超时费 / 减免
  onEditDayCharge(e) {
    var ridx = e.currentTarget.dataset.ridx
    var fidx = e.currentTarget.dataset.fidx
    var rental = this.data.order && this.data.order.rentals && this.data.order.rentals[ridx]
    if (!rental || !rental.feeRows || !rental.feeRows[fidx]) return
    var row = rental.feeRows[fidx]
    if (row.rentDetailId == null) {
      wx.showToast({ title: '该天无租金明细', icon: 'none' })
      return
    }
    this.setData({
      _dayChargeShow: true,
      _dayChargeRidx: ridx,
      _dayChargeDetailId: row.rentDetailId,
      _dayChargeDate: row.dateStr,
      _dayChargeRent: '',
      _dayChargeOvertime: '',
      _dayChargeDiscount: '',
      _dayChargeRentOrig: String(row.rent),
      _dayChargeOvertimeOrig: String(row.overtime),
      _dayChargeDiscountOrig: String(row.discount),
    })
  },
  onDayChargeInput(e) {
    var field = e.currentTarget.dataset.field
    this.setData({ ['_dayCharge' + field]: e.detail.value })
  },
  onDayChargeCancel() {
    this.setData({ _dayChargeShow: false })
  },
  noop() {},
  // 输入留空 → 回退到原值（点输入框后无需退格删原金额，直接输入即可）
  _resolveDayChargeVal(input, orig) {
    var s = String(input == null ? '' : input).trim()
    if (s === '') s = String(orig == null ? '' : orig).trim()
    var v = parseFloat(s)
    return isNaN(v) ? 0 : v
  },
  onDayChargeConfirm() {
    var that = this
    var ridx = that.data._dayChargeRidx
    var order = that.data.order
    if (!order || !order.rentals || !order.rentals[ridx]) {
      that.setData({ _dayChargeShow: false })
      return
    }
    var rentalId = order.rentals[ridx].id
    var detailId = that.data._dayChargeDetailId
    var rent = that._resolveDayChargeVal(that.data._dayChargeRent, that.data._dayChargeRentOrig)
    var overtime = that._resolveDayChargeVal(that.data._dayChargeOvertime, that.data._dayChargeOvertimeOrig)
    var discount = that._resolveDayChargeVal(that.data._dayChargeDiscount, that.data._dayChargeDiscountOrig)
    wx.showLoading({ title: '保存中' })
    data.updateRentalDayChargesPromise(rentalId, detailId, rent, overtime, discount,
      '租赁订单详细页修改租金明细', app.globalData.sessionKey)
      .then(function (updatedRental) {
        var od = that.data.order
        if (updatedRental) od.rentals[ridx] = updatedRental
        od = that.renderOrder(od)
        wx.hideLoading()
        that.setData({ order: od, _dayChargeShow: false })
        wx.showToast({ title: '已保存', icon: 'success' })
      }).catch(function () {
        wx.hideLoading()
        wx.showToast({ title: '保存失败', icon: 'error' })
      })
  },
  onToggleItems(e) {
    var ridx = e.currentTarget.dataset.ridx
    var key = '_expandedItems.' + ridx
    this.setData({ [key]: !this.data._expandedItems[ridx] })
  },

  _getItemRef(ridx, iidx) {
    var order = this.data.order
    if (!order || !order.rentals || !order.rentals[ridx] || !order.rentals[ridx].rentItems || !order.rentals[ridx].rentItems[iidx]) {
      return null
    }
    return {
      order: order,
      rental: order.rentals[ridx],
      item: order.rentals[ridx].rentItems[iidx],
    }
  },

  _toggleMapFlag(mapName, key) {
    var fullKey = mapName + '.' + key
    this.setData({ [fullKey]: !this.data[mapName][key] })
    return !this.data[mapName][key]
  },

  onItemPick(e) {
    var that = this
    var id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认发放',
      content: '',
      complete: (res) => {
        if (!res.confirm) return
        data.setRentItemStatsPromise(id, '已发放', app.globalData.sessionKey).then(function (newRental) {
          that.refreshStatus(newRental)
        })
      }
    })
  },

  onItemReturn(e) {
    var that = this
    var id = e.currentTarget.dataset.id
    var ridx = parseInt(e.currentTarget.dataset.ridx)
    var ref = that._getItemRef(ridx, parseInt(e.currentTarget.dataset.iidx))
    if (!ref) return
    var rental = ref.rental
    var allReturned = true
    for (var i = 0; i < rental.rentItems.length; i++) {
      var it = rental.rentItems[i]
      if (it.id == id) continue
      if (it.status != '已归还' && it.status != '未发放' && it.status != '已更换') {
        allReturned = false
      }
    }
    var msg = allReturned
      ? (rental.package_id
        ? '套餐【' + rental.name + '】中的租赁物，即将全部归还，归还后套餐租金自动结算，此操作不可逆。'
        : '即将归还【' + rental.name + '】，租金自动结算，此操作不可逆。')
      : '此操作不可逆。'
    wx.showModal({
      title: '确认归还',
      content: msg,
      complete: (res) => {
        if (!res.confirm) return
        data.setRentItemStatsPromise(id, '已归还', app.globalData.sessionKey).then(function (newRental) {
          that.refreshStatus(newRental)
        })
      }
    })
  },

  onItemUnReturn(e) {
    var that = this
    var id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认再次发放？',
      content: '发放后，该租赁商品的已结算状态会自动取消。',
      complete: (res) => {
        if (!res.confirm) return
        data.setRentItemStatsPromise(id, '已发放', app.globalData.sessionKey).then(function (newRental) {
          that.refreshStatus(newRental)
        })
      }
    })
  },

  onItemStore(e) {
    var that = this
    var id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认暂存',
      content: '',
      complete: (res) => {
        if (!res.confirm) return
        data.setRentItemStatsPromise(id, '已暂存', app.globalData.sessionKey).then(function (newRental) {
          that.refreshStatus(newRental)
        })
      }
    })
  },

  onItemChange(e) {
    var itemId = e.currentTarget.dataset.id
    var order = this.data.order
    if (!order || !itemId) return
    wx.navigateTo({
      url: '/pages/admin/rent/rent_item_change?orderId=' + order.id.toString() + '&rentItemId=' + itemId.toString()
    })
  },

  onItemRepairEdit(e) {
    var ridx = parseInt(e.currentTarget.dataset.ridx)
    var iidx = parseInt(e.currentTarget.dataset.iidx)
    var ref = this._getItemRef(ridx, iidx)
    if (!ref) return
    ref.item._repairEditing = true
    ref.item._repairDraft = ref.item.totalRepairationAmount != null ? String(ref.item.totalRepairationAmount) : '0'
    this.setData({ order: ref.order })
  },

  onItemRepairInput(e) {
    var ridx = parseInt(e.currentTarget.dataset.ridx)
    var iidx = parseInt(e.currentTarget.dataset.iidx)
    var ref = this._getItemRef(ridx, iidx)
    if (!ref) return
    ref.item._repairDraft = e.detail.value
    this.setData({ order: ref.order })
  },

  onItemRepairCancel(e) {
    var ridx = parseInt(e.currentTarget.dataset.ridx)
    var iidx = parseInt(e.currentTarget.dataset.iidx)
    var ref = this._getItemRef(ridx, iidx)
    if (!ref) return
    ref.item._repairEditing = false
    ref.item._repairDraft = ''
    this.setData({ order: ref.order })
  },

  onItemRepairConfirm(e) {
    var that = this
    var ridx = parseInt(e.currentTarget.dataset.ridx)
    var iidx = parseInt(e.currentTarget.dataset.iidx)
    var ref = that._getItemRef(ridx, iidx)
    if (!ref) return
    var amount = parseFloat((ref.item._repairDraft || '').trim())
    if (isNaN(amount) || amount < 0) {
      wx.showToast({ title: '请输入有效赔偿金额', icon: 'none' })
      return
    }
    var setUrl = app.globalData.requestPrefix + 'Rent/SetRentItemRepairAmount/' + ref.item.id + '?amount=' + amount + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(setUrl, null).then(function (newRental) {
      wx.showToast({ title: '赔偿已更新', icon: 'success' })
      if (newRental && newRental.id) {
        that.refreshStatus(newRental)
      } else {
        that.getData()
      }
    }).catch(function () {
      wx.showToast({ title: '更新失败', icon: 'error' })
    })
  },

  onItemMemoEdit(e) {
    var ridx = parseInt(e.currentTarget.dataset.ridx)
    var iidx = parseInt(e.currentTarget.dataset.iidx)
    var ref = this._getItemRef(ridx, iidx)
    if (!ref) return
    ref.item._memoEditing = true
    ref.item._memoDraft = ref.item.memo || ''
    this.setData({ order: ref.order })
  },

  onItemMemoInput(e) {
    var ridx = parseInt(e.currentTarget.dataset.ridx)
    var iidx = parseInt(e.currentTarget.dataset.iidx)
    var ref = this._getItemRef(ridx, iidx)
    if (!ref) return
    ref.item._memoDraft = e.detail.value
    this.setData({ order: ref.order })
  },

  onItemMemoCancel(e) {
    var ridx = parseInt(e.currentTarget.dataset.ridx)
    var iidx = parseInt(e.currentTarget.dataset.iidx)
    var ref = this._getItemRef(ridx, iidx)
    if (!ref) return
    ref.item._memoEditing = false
    ref.item._memoDraft = ''
    this.setData({ order: ref.order })
  },

  onItemMemoConfirm(e) {
    var that = this
    var ridx = parseInt(e.currentTarget.dataset.ridx)
    var iidx = parseInt(e.currentTarget.dataset.iidx)
    var ref = that._getItemRef(ridx, iidx)
    if (!ref) return
    ref.item.memo = ref.item._memoDraft || ''
    data.updateRentItemPromise(ref.item, '租赁订单详细页修改备注', app.globalData.sessionKey)
      .then(function (newItem) {
        newItem._memoEditing = false
        newItem._memoDraft = ''
        ref.order.rentals[ridx].rentItems[iidx] = newItem
        that.renderOrder(ref.order)
        that.setData({ order: ref.order })
        wx.showToast({ title: '备注已保存', icon: 'success' })
      }).catch(function () {
        wx.showToast({ title: '保存失败', icon: 'error' })
      })
  },

  onToggleItemLog(e) {
    var ridx = parseInt(e.currentTarget.dataset.ridx)
    var iidx = parseInt(e.currentTarget.dataset.iidx)
    var key = ridx + '_' + iidx
    var willOpen = this._toggleMapFlag('_expandedItemLogs', key)
    if (willOpen) {
      this.getRentItemLog(ridx, iidx)
    }
  },

  onToggleItemChange(e) {
    var ridx = parseInt(e.currentTarget.dataset.ridx)
    var iidx = parseInt(e.currentTarget.dataset.iidx)
    var key = ridx + '_' + iidx
    var willOpen = this._toggleMapFlag('_expandedItemChanges', key)
    if (willOpen) {
      this.getRentItemChange(ridx, iidx)
    }
  },

  getRentItemLog(ridx, iidx) {
    var ref = this._getItemRef(ridx, iidx)
    var that = this
    if (!ref || ref.item._logLoaded) return
    var getLogUrl = app.globalData.requestPrefix + 'Rent/GetRentItemLogByStaff/' + ref.item.id + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getLogUrl, null).then(function (logs) {
      for (var i = 0; logs && i < logs.length; i++) {
        var createDate = new Date(logs[i].create_date)
        logs[i].dateStr = (createDate.getMonth() + 1).toString().padStart(2, '0') + '-' + createDate.getDate().toString().padStart(2, '0')
        logs[i].timeStr = util.formatTimeStr(createDate)
      }
      ref.item.availableLog = logs || []
      ref.item._logLoaded = true
      that.setData({ order: ref.order })
    })
  },

  getRentItemChange(ridx, iidx) {
    var ref = this._getItemRef(ridx, iidx)
    var that = this
    if (!ref || ref.item._changesLoaded) return
    var getChangesUrl = app.globalData.requestPrefix + 'Rent/GetRentItemChanges/' + ref.item.id + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getChangesUrl, null).then(function (changesLog) {
      for (var i = 0; changesLog && i < changesLog.length; i++) {
        var d = new Date(changesLog[i].changeDate)
        changesLog[i].changeDateStr = util.formatDate(d)
        changesLog[i].changeTimeStr = util.formatTimeStr(d)
      }
      ref.item.changesLog = changesLog || []
      ref.item._changesLoaded = true
      that.setData({ order: ref.order })
    })
  },

  onReturnAllRental(e) {
    var that = this
    var ridx = parseInt(e.currentTarget.dataset.ridx)
    var order = that.data.order
    if (!order || !order.rentals || !order.rentals[ridx]) return
    var rental = order.rentals[ridx]
    var targetItems = []
    for (var i = 0; rental.rentItems && i < rental.rentItems.length; i++) {
      var it = rental.rentItems[i]
      if (it.noNeed) continue
      if (it.status == '已归还' || it.status == '已更换') continue
      targetItems.push(it)
    }
    if (targetItems.length == 0) {
      wx.showToast({ title: '没有可归还租赁物', icon: 'none' })
      return
    }
    var names = targetItems.slice(0, 4).map(function (x) { return x.name || x.code || x.id }).join('、')
    var suffix = targetItems.length > 4 ? ' 等' + targetItems.length + '件' : ''
    wx.showModal({
      title: '确认全部归还',
      content: '请核对已收回：' + names + suffix,
      complete: (res) => {
        if (!res.confirm) return
        var url = app.globalData.requestPrefix + 'Rent/ReturnAllRentItems/' + rental.id + '?sessionKey=' + app.globalData.sessionKey
        util.performWebRequest(url, null).then(function (newRental) {
          wx.showToast({ title: '归还成功', icon: 'success' })
          if (newRental && newRental.id) {
            that.refreshStatus(newRental)
          } else {
            that.getData()
          }
        })
      }
    })
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

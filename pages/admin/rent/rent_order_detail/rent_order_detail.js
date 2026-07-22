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

// 手机号脱敏：保留前 3 后 4，中间打码；空值返回 '—'
function maskCell(cell) {
  if (!cell && cell !== 0) return '—'
  var s = String(cell).trim()
  if (!s) return '—'
  if (/^\d{11}$/.test(s)) return s.substr(0, 3) + '****' + s.substr(7)
  if (s.length > 7) return s.substr(0, 3) + '****' + s.substr(s.length - 4)
  if (s.length > 4) return s.substr(0, s.length - 4) + '****'
  return '****'
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
    payWithDeposit: false,
    _verifyShow: false,
    _verifyQrUrl: '',
    _verifyTip: '',

    _rentalTab: 0,
    _expandedRentals: {},
    _expandedDetails: {},
    _expandedItems: {},
    _expandedItemLogs: {},
    _expandedItemChanges: {},

    allValid: false,

    // 逐笔退款弹窗（多笔支付 + 可退之和 > 应退时弹出，逐笔输入）
    refundModal: { show: false, need: 0, needStr: '', items: [], allocatedStr: '', remainToAllocStr: '', canConfirm: false },

    // 次卡消费选卡弹窗
    punchModal: { show: false, need: 0, cards: [], cardId: 0, punchCount: '', maxPunch: 0 },
    // 次卡消费预览（同储值：勾选只预览，核销在「申请退款」时）：选了哪张卡、抵几次、预览免除的雪板租金
    punchCardSelected: false,
    punchCardSelection: null,
    punchCardSelectedCount: 0,

    // 购买次卡（退押金推荐购买）：step 'pick'(选商品)｜'preview'(试算结果)。
    // 与「次卡消费」/「储值付租金」互斥——三者最终都要动同一批 rental_detail 天数行，同时跑会冲突。
    sellCardModal: { show: false, step: 'pick', products: [], productId: null, productName: '' },
    punchCardSalePreview: null,   // Rent/PreparePunchCardSale 的响应，纯试算不写库
    // 补差价·扫码结算（唯一真正跨请求异步的结算方式）：qrShow 控制二维码弹窗；payStage 跟 GetPaymentLiveStatus 一致
    shortfallSettle: { qrShow: false, qrCodeUrl: '', paymentId: null, retailId: null, payStage: 'waiting' },

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
    _dayChargeWaived: false,

    // 赔偿金额编辑弹窗（与租金明细弹窗同款）
    _repairShow: false,
    _repairItemId: null,
    _repairAmount: '',
    _repairAmountOrig: '',

    // 更换租赁物弹窗
    _chgShow: false,
    _chgItem: null,
    _chgCategories: [],
    _chgCategoryIdx: 0,
    _chgCategoryId: null,
    _chgCategoryName: '',
    _chgNoCode: false,
    _chgCode: '',
    _chgName: '',
    _chgMemo: '',
    _chgValid: false,
  },

  onLoad(options) {
    this.setData({ id: parseInt(options.id) })
    // 「未归还租赁物」列表深链：仅此入口会带 rentItemId，普通进入为 null（行为不变）
    this._targetRentItemId = (options && options.rentItemId != null && options.rentItemId !== '')
      ? parseInt(options.rentItemId) : null
    this._deepLinkApplied = false
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
        var finish = function () {
          order = that.renderOrder(order)
          var allValid = that.checkAppendingRentalValid(order)
          wx.hideLoading()
          that.setData({ order, allValid })
          that.applyDeepLinkExpand(order)
        }
        // 补拉完整会员（availableDeposit，「可用储值/储值付租金」用）+ 次卡信息（次卡消费用），并行后 finish。
        var emptyPunch = { cards: [], skiRentals: [], totalPunchNeed: 0, usedPunches: 0 }
        var memberP = order.member_id
          ? data.getMemberPromise(order.member_id, sessionKey).then(function (member) {
              if (member && order.member) order.member.availableDeposit = member.availableDeposit
            }).catch(function () {})
          : Promise.resolve()
        var punchP = order.member_id
          ? data.getRentalPunchCardInfoPromise(order.id, sessionKey).then(function (info) {
              order.punchCardInfo = info || emptyPunch
            }).catch(function () { order.punchCardInfo = emptyPunch })
          : Promise.resolve(order.punchCardInfo = emptyPunch)
        Promise.all([memberP, punchP]).then(function () { finish() })
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
    var allRentalsReturned = true   // 所有 rental 是否均已退租（退押金前提之一）

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
      // 退租时间在下方 rentItems 循环后按归还事件派生：rental.end_date 列在新租赁流程从不写入
      // （仅旧 RentOrder 模型会写），不能作为退租依据。改为「相关租赁物全部归还时取最晚归还时间」。

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
        // 已更换（被换下）的租赁物已不可用：隐藏赔偿按钮（更换完成说明租赁物无问题）+ 卡片置灰
        rentItem._replaced = rentItem.status == '已更换'

        // 发放记录每行补充展示用日期/时间：availableLog 来自订单 payload 的计算属性，
        // 原始行只有 status/staff/create_date，没有 dateStr/timeStr。展开「发放记录」时
        // 若不在此补全，日期/时间两列会空白（与 getRentItemLog 的补全口径保持一致）。
        for (var k = 0; rentItem.availableLog && k < rentItem.availableLog.length; k++) {
          var logEntry = rentItem.availableLog[k]
          if (logEntry && logEntry.create_date) {
            var logDate = new Date(logEntry.create_date)
            logEntry.dateStr = (logDate.getMonth() + 1).toString().padStart(2, '0') + '-' + logDate.getDate().toString().padStart(2, '0')
            logEntry.timeStr = util.formatTimeStr(logDate)
          } else {
            logEntry.dateStr = '--'
            logEntry.timeStr = '--'
          }
        }
      }

      // 件数不统计被换下（已更换）的租赁物（_replaced 在上面的 rentItems 循环里已逐项标好）
      rental._activeItemCount = (rental.rentItems || []).filter(function (it) { return !it._replaced }).length

      // 退租时间派生：相关租赁物（排除「不需要」与「已更换」）全部归还后，取最晚归还时间作为退租时间，
      // 否则显示「未退租」。依据归还事件（RentItemLog→returnDate），与是否结算（settled）无关——归还即视为退租。
      var _relevantItems = (rental.rentItems || []).filter(function (it) { return !it.noNeed && !it._replaced })
      var _allReturned = _relevantItems.length > 0 && _relevantItems.every(function (it) { return it._returned })
      rental._allReturned = _allReturned
      if (!_allReturned) allRentalsReturned = false
      if (_allReturned) {
        var _latestReturn = null
        for (var ri = 0; ri < _relevantItems.length; ri++) {
          var _rd = new Date(_relevantItems[ri].returnDate)
          if (_latestReturn == null || _rd > _latestReturn) _latestReturn = _rd
        }
        rental.end_dateDateStr = util.formatDate(_latestReturn)
        rental.end_dateTimeStr = util.formatTimeStr(_latestReturn)
      } else {
        rental.end_dateDateStr = '未退租'
        rental.end_dateTimeStr = ''
      }

      // 租金明细（按天聚合：每天一行；免除天连 valid=0 一起纳入并划线；赔偿金按租赁物维度不进此表）
      var feeDayMap = {}
      var feeRows = []
      for (var j = 0; rental.details && j < rental.details.length; j++) {
        var detail = rental.details[j]
        var ct = (detail.charge_type || '').trim()
        if (ct != '租金' && ct != '超时费') continue
        var dayKey = util.formatDate(new Date(detail.rental_date))
        var row = feeDayMap[dayKey]
        if (!row) {
          row = { dateStr: dayKey, rentDetailId: null, rent: 0, overtime: 0, discount: 0,
                  waived: false, _rentValid1: false, _otValidSum: 0, _otAllSum: 0 }
          feeDayMap[dayKey] = row
          feeRows.push(row)
        }
        if (ct == '租金') {
          var isV1 = (detail.valid == 1)
          // 优先取 valid=1 的租金明细；该天只有 valid=0 时标记免除（仍取原值供恢复/划线展示）
          if (isV1 || !row._rentValid1) {
            row.rentDetailId = detail.id
            row.rent = parseFloat(detail.amount) || 0
            // 当天非票券「日租金」减免（不论 valid，取原值——免除后 valid=0 仍能取到）
            var dsum = 0
            var dl = detail.discounts || []
            for (var di = 0; di < dl.length; di++) {
              var dd = dl[di]
              if (dd && (dd.ticket_code == null || dd.ticket_code === '')) dsum += parseFloat(dd.amount) || 0
            }
            row.discount = dsum
            row.waived = !isV1
            if (isV1) row._rentValid1 = true
          }
        } else { // 超时费
          var oamt = parseFloat(detail.amount) || 0
          row._otAllSum += oamt
          if (detail.valid == 1) row._otValidSum += oamt
        }
      }
      for (var fi = 0; fi < feeRows.length; fi++) {
        var r0 = feeRows[fi]
        // 免除天取全部超时费（含 valid=0 原值供恢复/划线）；正常天只取 valid=1
        r0.overtime = r0.waived ? r0._otAllSum : r0._otValidSum
        r0.subtotal = r0.rent + r0.overtime - r0.discount
        r0.rentStr = util.showAmount(r0.rent)
        r0.overtimeStr = util.showAmount(r0.overtime)
        r0.discountStr = util.showAmount(r0.discount)
        r0.subtotalStr = util.showAmount(r0.subtotal)
      }
      rental.feeRows = feeRows

      // 截止到当前的租金：累计 rental_date 不晚于今天的有效「租金」明细（毛额，招待也照常显示）
      var rentToNow = 0
      var todayEnd = new Date()
      todayEnd.setHours(23, 59, 59, 999)
      for (var di = 0; rental.details && di < rental.details.length; di++) {
        var rd = rental.details[di]
        if ((rd.charge_type || '').trim() == '租金' && rd.valid == 1 && new Date(rd.rental_date) <= todayEnd) {
          rentToNow += parseFloat(rd.amount) || 0
        }
      }
      rental._rentToNow = rentToNow
      rental._rentToNowStr = util.showAmount(rentToNow)
      // showcase 费用格/小计统一走 showAmount 格式化（四舍五入 2 位 + 自带 ¥），避免浮点尾数（如 0.06000000000000005）
      rental.totalDiscountAmountStr = util.showAmount(rental.totalDiscountAmount || 0)
      rental.totalRepairationAmountStr = util.showAmount(rental.totalRepairationAmount || 0)
      rental.totalOvertimeAmountStr = util.showAmount(rental.totalOvertimeAmount || 0)
      rental.totalSummaryStr = util.showAmount(rental.totalSummary || 0)
    }

    // appendingRentals 处理（追加中的租赁）：分两态
    //   _isDraft=true  草稿（appending=true，未确认，可删=放弃 / 可继续编辑）
    //   _isDraft=false 待支付（appending=false 且 append_commit_time=null，已确认未生效，靠顶部「去支付」收尾）
    order.draftRentals = []
    order.pendingRentals = []
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
      rental.totalRentalAmountStr = util.showAmount(totalRentalAmount)
      rental.totalDiscountAmountStr = util.showAmount(totalRentalAmount)
      rental._isDraft = (rental.appending === true || rental.appending === 1)
      if (rental._isDraft) order.draftRentals.push(rental)
      else order.pendingRentals.push(rental)
    }

    // 支付明细
    var paidAmountExcludeDeposit = 0
    for (var i = 0; order.availablePayments && i < order.availablePayments.length; i++) {
      var payment = order.availablePayments[i]
      // paid_date 为空时回退 create_date（历史储值支付未写 paid_date，否则显示 1970-01-01 08:00:00）
      var payDateSrc = payment.paid_date || payment.create_date
      var paidDate = new Date(payDateSrc)
      payment.paid_dateDateStr = util.formatDate(paidDate)
      payment.paid_dateTimeStr = util.formatTimeStr(paidDate)
      payment.amountStr = util.showAmount(payment.amount)
      payment.remainAmount = payment.amount
      if (!isNaN(payment.refundedAmount)) {
        payment.remainAmount = payment.remainAmount - payment.refundedAmount
      }
      payment.remainAmountStr = util.showAmount(payment.remainAmount)
      // 他人代付：条目标红 + 显示代付人脱敏手机号（无则 '—'）
      payment._isProxy = payment.is_proxy_pay === true || payment.is_proxy_pay === 1
      payment._proxyCellMasked = payment._isProxy ? maskCell(payment.cell) : ''
      if (payment.status == '支付成功' && payment.pay_method != '储值支付') {
        paidAmountExcludeDeposit += parseFloat(payment.amount) || 0
      }
    }

    // 退款明细：退款记录无 paid_date，用 create_date 作日期/时间；方式取原支付方式
    for (var i = 0; order.availableRefunds && i < order.availableRefunds.length; i++) {
      var refund = order.availableRefunds[i]
      var refundDate = new Date(refund.create_date)
      refund.paid_dateDateStr = util.formatDate(refundDate)
      refund.paid_dateTimeStr = util.formatTimeStr(refundDate)
      refund.amountStr = util.showAmount(refund.amount)
      if (!refund.pay_method && refund.payment) {
        refund.pay_method = refund.payment.pay_method
      }
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
    order.paidAmountStr = util.showAmount(paidAmountExcludeDeposit)
    order.refundAmountStr = util.showAmount(order.refundAmount)
    order._allRentalsReturned = allRentalsReturned
    order.unRelieveGuaranty = unRelieveGuaranty
    order.unRelieveGuarantyStr = util.showAmount(unRelieveGuaranty)
    order.relieveGuarantyStr = util.showAmount(relieveGuaranty)

    // 退款区订单级汇总：后端这几个是 [NotMapped] 计算属性，初次拉单时算好后随订单序列化下发；
    // 但 getData 会逐条用 GetRental 替换 order.rentals，且改赔偿/超时/租金后只 refreshStatus 局部替换
    // 单条 rental，这些订单级标量不会自动重算 → 结算金额（总计赔偿/实际应退）不更新。这里用最新 rentals
    // 重新累加，口径与后端 Order getter 完全一致（赔偿/超时/减免均已含在 rental.totalSummary 内）。
    var sumSummary = 0, sumOvertime = 0, sumRepair = 0
    for (var ri = 0; order.rentals && ri < order.rentals.length; ri++) {
      var rt = order.rentals[ri]
      sumOvertime += rt.totalOvertimeAmount || 0
      sumRepair += rt.totalRepairationAmount || 0
      if (!rt.experience && !rt.entertain) sumSummary += rt.totalSummary || 0
    }
    order.totalRentSummaryAmount = sumSummary
    order.totalRentOverTimeAmount = sumOvertime
    order.totalRentRepairAmount = sumRepair
    // 应退押金的押金基数用「总计押金」order.totalGuarantyAmount（与退款区展示的总计押金同源），
    // 不用 rentProperties.totalPaidGuarantyAmount —— 后者按 guaranty.payStatus 过滤，而订单级 guarantys
    // 的 payment 在 GetOrderByStaff 未 Include（OrderController.cs:195 注释掉了 ThenInclude payment），
    // payStatus 不可靠，会把已收押金误算成 0（order 71766：总计押金 0.01，应退押金却算成 0）。
    // 押金基数封顶到「实际已收押金」：totalGuarantyAmount 只是订单配置的应收押金，
    // 未支付订单（paidAmount=0）押金尚未收取，无可退；用 min(配置押金, 已付金额) 避免给未付订单算出应退（order 71796）。
    var totalGuaranty = Math.min(order.totalGuarantyAmount || 0, order.paidAmount || 0)
    order.totalRentNeedToRefundAmount = totalGuaranty - sumSummary + (order.depositPaidAmount || 0)
    order.totalRentUnRefund = order.totalRentNeedToRefundAmount - (order.refundAmount || 0)
    // 储值付租金 / 次卡消费都是「勾选预览」：把被它们覆盖的租金加回「实际应退」（核销在「申请退款」时才落库）。
    // 叠加口径：储值付租金覆盖全部租金 → 加 sumSummary（次卡只是把其中雪板那部分换成次卡支付，押金移走总额仍是 sumSummary）；
    // 仅次卡 → 只加被次卡免除的雪板租金 freedRent（非雪板租金仍从押金扣）。
    var pendingDeposit = that.data.payWithDeposit && !(order.depositPaidAmount > 0)
    var pendingPunch = !!(that.data.punchCardSelected && that.data.punchCardSelection)
    var addBack = 0
    if (pendingDeposit) {
      addBack = sumSummary
    } else if (pendingPunch) {
      addBack = that.data.punchCardSelection.freedRent || 0
    }
    order.totalRentUnRefund = order.totalRentUnRefund + addBack
    // 有待核销（储值/次卡勾选未落库）→ 即使应退为 0，「申请退款」按钮也应可点（变「确认核销」）
    order._pendingWriteoff = pendingDeposit || pendingPunch
    // 可用储值（会员储值余额，后端已随 order.member 下发）
    if (order.member && order.member.availableDeposit) {
      order.member.availableDepositStr = util.showAmount(order.member.availableDeposit)
    }
    // 次卡消费：会员租赁次卡总剩余次数（各卡 remaining 之和）；本次需扣 = punchCardInfo.totalPunchNeed
    if (order.punchCardInfo && order.punchCardInfo.cards) {
      var pcRemaining = 0
      for (var pci = 0; pci < order.punchCardInfo.cards.length; pci++) {
        pcRemaining += order.punchCardInfo.cards[pci].remaining || 0
      }
      order.punchCardInfo.totalRemaining = pcRemaining
    }

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

    // 「去支付」入口：未付清且订单开放（待生成/待支付/部分支付）才显示；
    // 已支付成功/订单关闭/退款/挂账/免费单(应付≤0)不显示。点击跳通用结算页（与开单流程同一页）。
    var payable = (order.paying_amount != null && order.paying_amount > 0)
      ? order.paying_amount
      : ((order.totalCharge || 0) - (order.paidAmount || 0))
    // 追加待支付项（pendingRentals）也需「去支付」入口：原租赁已付时订单聚合 orderStatus 会是「支付成功」，
    // 不能只靠它判定；有待支付追加项也放开顶部去支付按钮
    var hasPendingAppend = (order.pendingRentals && order.pendingRentals.length > 0)
    order.showGoPay = ((order.orderStatus == '待生成' || order.orderStatus == '待支付' || order.orderStatus == '部分支付') || hasPendingAppend) && payable > 0
    order.payableAmountStr = util.showAmount(payable > 0 ? payable : 0)

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

  // 点 showcase「招待」格 → 二次确认后设/撤招待（招待免该项租金，按现有招待计费规则计费）
  onToggleEntertain(e) {
    var that = this
    var ridx = e.currentTarget.dataset.ridx
    var order = that.data.order
    var rental = order && order.rentals && order.rentals[ridx]
    if (!rental) return
    var cur = !!rental.entertain
    var next = !cur
    wx.showModal({
      title: cur ? '取消招待' : '设为招待',
      content: cur ? '取消后该项恢复正常计费。' : '设为招待将免除该项租金（超时费/赔偿仍照常计）。',
      success: function (res) {
        if (!res.confirm) return
        wx.showLoading({ title: '保存中' })
        var rentalId = rental.id
        data.setRentalEntertainPromise(rentalId, next, '租赁订单详细页设置招待', app.globalData.sessionKey)
          .then(function (updatedRental) {
            var od = that.data.order
            if (updatedRental) od.rentals[ridx] = updatedRental
            od = that.renderOrder(od)
            wx.hideLoading()
            that.setData({ order: od })
            wx.showToast({ title: next ? '已设为招待' : '已取消招待', icon: 'success' })
          }).catch(function () {
            wx.hideLoading()
            wx.showToast({ title: '保存失败', icon: 'error' })
          })
      }
    })
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
      _dayChargeWaived: !!row.waived,
    })
  },
  onDayChargeInput(e) {
    var field = e.currentTarget.dataset.field
    this.setData({ ['_dayCharge' + field]: e.detail.value })
  },
  onDayChargeCancel() {
    this.setData({ _dayChargeShow: false })
  },
  onDayChargeWaivedToggle() {
    this.setData({ _dayChargeWaived: !this.data._dayChargeWaived })
  },
  noop() {},

  onHide() { this._stopVerifyPolling() },
  onUnload() { this._stopVerifyPolling() },
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
      '租赁订单详细页修改租金明细', app.globalData.sessionKey, that.data._dayChargeWaived)
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

  // 从「未归还租赁物」列表深链进入（URL 带 rentItemId）时：
  // 只展开目标租赁物所在 rental + 其租赁物列表，折叠订单信息/支付/退款及其余 rental，
  // best-effort 滚动到目标卡片。无 rentItemId（普通进入）直接返回，行为不变。
  // _deepLinkApplied 守卫：只在首次渲染生效，后续 onShow 不再覆盖用户手动展开。
  applyDeepLinkExpand(order) {
    if (this._deepLinkApplied || this._targetRentItemId == null) return
    if (!order || !order.rentals) return
    var ridx = -1
    for (var i = 0; i < order.rentals.length && ridx < 0; i++) {
      var items = (order.rentals[i] && order.rentals[i].rentItems) || []
      for (var j = 0; j < items.length; j++) {
        if (items[j] && items[j].id === this._targetRentItemId) { ridx = i; break }
      }
    }
    if (ridx < 0) return // 目标不在本订单（异常入参）→ 保持默认展开
    this._deepLinkApplied = true
    var expandedRentals = {}; expandedRentals[ridx] = true
    var expandedItems = {}; expandedItems[ridx] = true
    var that = this
    this.setData({
      _rentalTab: 0,
      _orderInfoExpanded: false,
      _paymentDetailExpanded: false,
      _refundExpanded: false,
      _expandedRentals: expandedRentals,
      _expandedItems: expandedItems,
      _expandedDetails: {}
    }, function () {
      // setData 回调：此时目标 rental 已展开、租赁物卡片已渲染，再查询定位
      try {
        wx.createSelectorQuery().in(that)
          .select('#rid-item-' + that._targetRentItemId).boundingClientRect()
          .selectViewport().scrollOffset()
          .exec(function (res) {
            var rect = res && res[0]
            var scroll = res && res[1]
            if (rect && scroll) {
              wx.pageScrollTo({ scrollTop: Math.max(0, scroll.scrollTop + rect.top - 80), duration: 200 })
            }
          })
      } catch (e) {}
    })
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

  refreshStatus(newRental) {
    var order = this.data.order
    if (!order || !order.rentals) { this.getData(); return }
    for (var i = 0; i < order.rentals.length; i++) {
      if (order.rentals[i].id == newRental.id) {
        order.rentals[i] = newRental
        break
      }
    }
    order = this.renderOrder(order)
    this.setData({ order })
  },

  onItemChange(e) {
    var that = this
    var itemId = e.currentTarget.dataset.id
    var order = that.data.order
    if (!order || !itemId) return

    var foundItem = null
    for (var ri = 0; order.rentals && ri < order.rentals.length; ri++) {
      var rental = order.rentals[ri]
      for (var ii = 0; rental.rentItems && ii < rental.rentItems.length; ii++) {
        if (rental.rentItems[ii].id == itemId) { foundItem = rental.rentItems[ii]; break }
      }
      if (foundItem) break
    }
    if (!foundItem) return

    wx.showLoading({ title: '加载中' })
    data.queryRentItemChangeCompatibleCategory(foundItem.category_id).then(function (categories) {
      var chgCategories = []
      for (var i = 0; categories && i < categories.length; i++) {
        chgCategories.push({ id: categories[i].id, name: categories[i].name })
      }
      var defaultIdx = 0
      for (var i = 0; i < chgCategories.length; i++) {
        if (chgCategories[i].id == foundItem.category_id) { defaultIdx = i; break }
      }
      wx.hideLoading()
      that.setData({
        _chgShow: true,
        _chgItem: foundItem,
        _chgCategories: chgCategories,
        _chgCategoryIdx: defaultIdx,
        _chgCategoryId: chgCategories.length > 0 ? chgCategories[defaultIdx].id : null,
        _chgCategoryName: chgCategories.length > 0 ? chgCategories[defaultIdx].name : '',
        _chgNoCode: false,
        _chgCode: '',
        _chgName: '',
        _chgMemo: '',
        _chgValid: false,
      })
    }).catch(function () {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'error' })
    })
  },

  onChgCancel() {
    this.setData({ _chgShow: false })
  },

  onChgNoCodeToggle() {
    var noCode = !this.data._chgNoCode
    this.setData({ _chgNoCode: noCode, _chgCode: '', _chgName: '', _chgValid: false })
  },

  onChgCodeInput(e) {
    var code = e.detail.value
    this.setData({ _chgCode: code, _chgValid: !!(code && code.trim()) })
  },

  onChgNameInput(e) {
    var name = e.detail.value
    this.setData({ _chgName: name, _chgValid: !!(name && name.trim()) })
  },

  onChgMemoInput(e) {
    this.setData({ _chgMemo: e.detail.value })
  },

  onChgCategoryChange(e) {
    var idx = parseInt(e.detail.value)
    var cats = this.data._chgCategories
    if (idx >= 0 && idx < cats.length) {
      this.setData({ _chgCategoryIdx: idx, _chgCategoryId: cats[idx].id, _chgCategoryName: cats[idx].name })
    }
  },

  onChgScan() {
    var that = this
    wx.scanCode({ onlyFromCamera: false, success: function (res) {
      var code = res.result
      that.setData({ _chgCode: code, _chgValid: !!(code && code.trim()) })
    } })
  },

  onChgConfirm() {
    var that = this
    if (!that.data._chgValid) return
    var rentItem = that.data._chgItem
    var newItem = {
      noCode: that.data._chgNoCode,
      code: that.data._chgNoCode ? '' : that.data._chgCode,
      name: that.data._chgName,
      category_id: that.data._chgCategoryId,
      class_name: that.data._chgCategoryName,
      memo: that.data._chgMemo,
    }
    var catName = that.data._chgCategoryName || ''
    var msg = rentItem.category_id == newItem.category_id
      ? catName + ' 同品类租赁物更换'
      : '更换为分类：' + catName
    wx.showModal({
      title: '确认更换',
      content: msg,
      complete: function (res) {
        if (!res.confirm) return
        var changeUrl = app.globalData.requestPrefix + 'Rent/ChangeRentItemByStaff/' + rentItem.id + '?sessionKey=' + app.globalData.sessionKey
        wx.showLoading({ title: '更换中' })
        util.performWebRequest(changeUrl, newItem).then(function (newRental) {
          wx.hideLoading()
          that.setData({ _chgShow: false })
          wx.showToast({ title: '更换成功', icon: 'success' })
          if (newRental && newRental.id) {
            that.refreshStatus(newRental)
          } else {
            that.getData()
          }
        }).catch(function () {
          wx.hideLoading()
          wx.showToast({ title: '更换失败', icon: 'error' })
        })
      }
    })
  },

  // 点「赔偿」→ 弹出金额输入弹窗（与租金明细弹窗同款）；点开自动清空，原值作 placeholder
  onItemRepairEdit(e) {
    var ridx = parseInt(e.currentTarget.dataset.ridx)
    var iidx = parseInt(e.currentTarget.dataset.iidx)
    var ref = this._getItemRef(ridx, iidx)
    if (!ref) return
    var cur = ref.item.totalRepairationAmount != null ? ref.item.totalRepairationAmount : 0
    this.setData({
      _repairShow: true,
      _repairItemId: ref.item.id,
      _repairAmount: '',
      _repairAmountOrig: String(cur),
    })
  },

  onRepairInput(e) {
    this.setData({ _repairAmount: e.detail.value })
  },

  onRepairCancel() {
    this.setData({ _repairShow: false })
  },

  onRepairConfirm() {
    var that = this
    var itemId = that.data._repairItemId
    if (itemId == null) { that.setData({ _repairShow: false }); return }
    // 留空 → 回退原值（与租金明细弹窗一致，点开无需退格删原金额）
    var amount = that._resolveDayChargeVal(that.data._repairAmount, that.data._repairAmountOrig)
    if (amount < 0) {
      wx.showToast({ title: '请输入有效赔偿金额', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中' })
    var setUrl = app.globalData.requestPrefix + 'Rent/SetRentItemRepairAmount/' + itemId + '?amount=' + amount + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(setUrl, null).then(function (newRental) {
      wx.hideLoading()
      that.setData({ _repairShow: false })
      wx.showToast({ title: '赔偿已更新', icon: 'success' })
      if (newRental && newRental.id) {
        that.refreshStatus(newRental)
      } else {
        that.getData()
      }
    }).catch(function () {
      wx.hideLoading()
      wx.showToast({ title: '更新失败', icon: 'error' })
    })
  },

  onItemMemoTap(e) {
    var that = this
    var ridx = parseInt(e.currentTarget.dataset.ridx)
    var iidx = parseInt(e.currentTarget.dataset.iidx)
    var ref = that._getItemRef(ridx, iidx)
    if (!ref) return
    wx.showModal({
      title: '修改备注',
      content: ref.item.memo || '',
      editable: true,
      complete: (res) => {
        if (!res.confirm) return
        ref.item.memo = res.content || ''
        data.updateRentItemPromise(ref.item, '租赁订单详细页修改备注', app.globalData.sessionKey)
          .then(function (newItem) {
            ref.order.rentals[ridx].rentItems[iidx] = newItem
            that.renderOrder(ref.order)
            that.setData({ order: ref.order })
            wx.showToast({ title: '备注已保存', icon: 'success' })
          }).catch(function () {
            wx.showToast({ title: '保存失败', icon: 'error' })
          })
      }
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

  // 「按租赁物」视图底部：归还本订单全部未归还租赁物（跨 rental 顺序调用）
  onReturnAllOrder() {
    var that = this
    var order = that.data.order
    if (!order || !order.rentals) return
    var targetRentals = []
    var totalCount = 0
    for (var r = 0; r < order.rentals.length; r++) {
      var rental = order.rentals[r]
      if (rental.valid != 1 || !rental.rentItems) continue
      var has = false
      for (var i = 0; i < rental.rentItems.length; i++) {
        var it = rental.rentItems[i]
        if (it.noNeed) continue
        if (it.status == '已归还' || it.status == '已更换') continue
        has = true
        totalCount++
      }
      if (has) targetRentals.push(rental)
    }
    if (totalCount == 0) {
      wx.showToast({ title: '没有可归还租赁物', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认全部归还',
      content: '将归还本订单全部未归还租赁物（共 ' + totalCount + ' 件），归还后租金自动结算，此操作不可逆。',
      complete: function (res) {
        if (!res.confirm) return
        var chain = Promise.resolve()
        targetRentals.forEach(function (rental) {
          chain = chain.then(function () {
            var url = app.globalData.requestPrefix + 'Rent/ReturnAllRentItems/' + rental.id + '?sessionKey=' + app.globalData.sessionKey
            return util.performWebRequest(url, null)
          })
        })
        chain.then(function () {
          wx.showToast({ title: '归还成功', icon: 'success' })
          that.getData()
        }).catch(function () {
          wx.showToast({ title: '归还失败', icon: 'none' })
          that.getData()
        })
      }
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

  onTogglePayWithDeposit() {
    var that = this
    var order = that.data.order
    if (!order || !order.member || !(order.member.availableDeposit > 0)) return
    if (order.depositPaidAmount > 0) return
    // 储值/次卡核销在退款时操作，需所有租赁物先归还
    if (!order._allRentalsReturned) { wx.showToast({ title: '所有租赁物归还后才能使用', icon: 'none' }); return }
    // 取消勾选：直接关
    if (that.data.payWithDeposit) {
      // renderOrder 读 this.data.payWithDeposit 决定是否把租金加回「实际应退」。实测 setData 之后
      // 紧接着读 this.data 仍是旧值，故不能依赖 setData 的「同步更新 this.data」，必须先显式赋值，
      // 否则「实际应退」会与勾选状态对不上（勾上仍按未勾算）。直接改对象属性是纯 JS 同步操作。
      that.data.payWithDeposit = false
      that.setData({ payWithDeposit: false, order: that.renderOrder(order) })
      return
    }
    // 勾上：储值是会员资产，需先通过微信身份核验（wechat_unverified==1 即已核验本人）
    if (order.wechat_unverified) {
      that.data.payWithDeposit = true
      that.setData({ payWithDeposit: true, order: that.renderOrder(order) })
      return
    }
    // 未核验 → 弹微信核验二维码 + 轮询，核验通过（扫码人=订单会员）才放行勾选
    that._openWechatVerify('deposit')
  },

  // ── 次卡消费 ──────────────────────────
  // 次卡是会员资产，做成复选框（同储值「勾选预览」）：勾选 → 微信身份核验 → 选卡弹窗记下「抵几次」并预览；
  // 真正核销（UseRentalPunchCard）在「申请退款」时随储值一起落库。已核销过（usedPunches>0）则勾选并锁定。
  onTogglePunchCard() {
    var that = this
    var order = that.data.order
    var info = order && order.punchCardInfo
    if (!info || !info.cards || info.cards.length === 0) return
    // 已核销 → 复选框勾选并锁定，不再操作
    if (info.usedPunches > 0) { wx.showToast({ title: '次卡已核销', icon: 'none' }); return }
    // 已勾选（预览中）→ 取消勾选，清掉预览
    if (that.data.punchCardSelected) {
      that.data.punchCardSelected = false
      that.data.punchCardSelection = null
      that.setData({ punchCardSelected: false, punchCardSelection: null, punchCardSelectedCount: 0, order: that.renderOrder(order) })
      return
    }
    if (!(info.totalPunchNeed > 0)) return
    // 储值/次卡核销在退款时操作，需所有租赁物先归还
    if (!order._allRentalsReturned) { wx.showToast({ title: '所有租赁物归还后才能使用', icon: 'none' }); return }
    // 次卡是会员资产，需先通过微信身份核验（wechat_unverified==1 即已核验本人）
    if (order.wechat_unverified) { that._openPunchModal(); return }
    // 未核验 → 弹微信核验二维码 + 轮询，核验通过后再弹选卡弹窗
    that._openWechatVerify('punch')
  },

  // 预览用：算被次卡免除的雪板租金 = 所有 skiRentals.rentalDates 合并按 date 升序前 n 天 amount 之和
  _calcPunchFreedRent(n) {
    var info = this.data.order && this.data.order.punchCardInfo
    if (!info || !info.skiRentals) return 0
    var allDates = []
    info.skiRentals.forEach(function (r) {
      (r.rentalDates || []).forEach(function (d) { allDates.push(d) })
    })
    allDates.sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0) })
    var freed = 0
    for (var i = 0; i < Math.min(n, allDates.length); i++) freed += (allDates[i].amount || 0)
    return parseFloat(freed.toFixed(2))
  },

  // 打开选卡弹窗：列会员租赁次卡（单选）+ 输入抵几次（默认 min(选中卡剩余, 本次需扣)）
  _openPunchModal() {
    var info = this.data.order && this.data.order.punchCardInfo
    if (!info || !info.cards || info.cards.length === 0 || !(info.totalPunchNeed > 0)) return
    var cards = info.cards.map(function (c) { return { id: c.id, card_name: c.card_name, remaining: c.remaining } })
    var first = cards[0]
    var max = Math.min(first.remaining, info.totalPunchNeed)
    this.setData({
      punchModal: { show: true, need: info.totalPunchNeed, cards: cards, cardId: first.id, punchCount: String(max), maxPunch: max }
    })
  },
  onPunchSelectCard(e) {
    var cardId = e.currentTarget.dataset.id
    var modal = this.data.punchModal
    var card = null
    for (var i = 0; i < modal.cards.length; i++) { if (modal.cards[i].id == cardId) { card = modal.cards[i]; break } }
    if (!card) return
    var max = Math.min(card.remaining, modal.need)
    this.setData({ 'punchModal.cardId': cardId, 'punchModal.maxPunch': max, 'punchModal.punchCount': String(max) })
  },
  onPunchCountInput(e) {
    this.setData({ 'punchModal.punchCount': e.detail.value })
  },
  onPunchModalCancel() {
    this.setData({ 'punchModal.show': false })
  },
  // 选卡确认：只记下「选哪张卡 + 抵几次」并预览（核销在「申请退款」时落库，不在此立即核销）
  onPunchModalConfirm() {
    var that = this
    var modal = that.data.punchModal
    var n = parseInt(modal.punchCount)
    if (isNaN(n) || n <= 0) { wx.showToast({ title: '请输入抵扣次数', icon: 'none' }); return }
    if (n > modal.maxPunch) { wx.showToast({ title: '超过可抵次数', icon: 'none' }); return }
    var freed = that._calcPunchFreedRent(n)
    that.data.punchCardSelected = true
    that.data.punchCardSelection = { card_id: modal.cardId, punch_count: n, freedRent: freed }
    that.setData({
      'punchModal.show': false,
      punchCardSelected: true,
      punchCardSelectedCount: n,
      order: that.renderOrder(that.data.order)
    })
    if (n < modal.need) {
      wx.showToast({ title: '不足部分租金仍从押金扣', icon: 'none' })
    }
  },

  // purpose: 'deposit'（储值付租金）| 'punch'（次卡消费）—— 核验通过后的后续动作不同
  _openWechatVerify(purpose) {
    var that = this
    var order = that.data.order
    that._verifyPurpose = purpose || 'deposit'
    var tip = that._verifyPurpose === 'punch'
      ? '请订单会员本人微信扫码，核验通过后才能用次卡消费'
      : '请订单会员本人微信扫码，核验通过后才能用储值付租金'
    // 专用扫码落地路径 order_verify（需在公众平台「扫普通链接二维码打开小程序」登记 → pages/order/identity_verify）
    var verifyUrl = 'https://mini.snowmeet.top/mapp/order_verify?verifyOrderId=' + order.id
    var qrCodeUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent(verifyUrl)
    that.setData({ _verifyShow: true, _verifyQrUrl: qrCodeUrl, _verifyTip: tip })
    that._startVerifyPolling()
  },

  _startVerifyPolling() {
    var that = this
    that._stopVerifyPolling()
    that._verifyTimer = setInterval(function () {
      var order = that.data.order
      if (!order) return
      data.getWechatVerifyStatusPromise(order.id, app.globalData.sessionKey).then(function (res) {
        if (res && res.verified) {
          that._stopVerifyPolling()
          order.wechat_unverified = true
          if (that._verifyPurpose === 'punch') {
            // 核验通过 → 关二维码、落 wechat_unverified，弹选卡弹窗（次卡核销即生效）
            that.setData({ _verifyShow: false, order: order })
            wx.showToast({ title: '核验成功', icon: 'success' })
            that._openPunchModal()
          } else {
            // 储值付租金：显式置位 payWithDeposit（不依赖 setData 同步），再 renderOrder
            that.data.payWithDeposit = true
            that.setData({ _verifyShow: false, payWithDeposit: true, order: that.renderOrder(order) })
            wx.showToast({ title: '核验成功', icon: 'success' })
          }
        }
      }).catch(function () { /* 轮询失败忽略，下个周期再试 */ })
    }, 2000)
  },

  _stopVerifyPolling() {
    if (this._verifyTimer) { clearInterval(this._verifyTimer); this._verifyTimer = null }
  },

  onWechatVerifyCancel() {
    this._stopVerifyPolling()
    this.setData({ _verifyShow: false })
  },

  // ── 购买次卡（退押金时推荐购买）──────────────
  // 三步：① 选商品 ② 试算（服务端算好应核销次数/免租金/应退押金/多退或需补） ③ 按结算方式确认。
  // 与「次卡消费」/「储值付租金」互斥（wxml 里已按 sellCardModal.show 隐藏那两行入口）。
  onOpenSellPunchCard() {
    var that = this
    var order = that.data.order
    if (!order || !order._allRentalsReturned) { wx.showToast({ title: '所有租赁物归还后才能操作', icon: 'none' }); return }
    wx.showLoading({ title: '加载中', mask: true })
    data.getPunchCardProductsPromise(order.shop, app.globalData.sessionKey).then(function (products) {
      wx.hideLoading()
      if (!products || products.length === 0) { wx.showToast({ title: '暂无可购买的次卡商品', icon: 'none' }); return }
      that.setData({ sellCardModal: { show: true, step: 'pick', products: products, productId: null, productName: '' } })
    }).catch(function () { wx.hideLoading() })
  },

  onPickPunchCardProduct(e) {
    var productId = parseInt(e.currentTarget.dataset.id, 10)
    var modal = this.data.sellCardModal
    var product = null
    for (var i = 0; i < modal.products.length; i++) { if (modal.products[i].id == productId) { product = modal.products[i]; break } }
    if (!product) return
    this.setData({ 'sellCardModal.productId': productId, 'sellCardModal.productName': product.name })
    this._previewPunchCardSale(productId)
  },

  _previewPunchCardSale(productId) {
    var that = this
    var order = that.data.order
    wx.showLoading({ title: '试算中', mask: true })
    data.preparePunchCardSalePromise(order.id, productId, app.globalData.sessionKey).then(function (preview) {
      wx.hideLoading()
      that.setData({ 'sellCardModal.step': 'preview', punchCardSalePreview: preview })
    }).catch(function () { wx.hideLoading() })
  },

  onSellCardModalCancel() {
    this._stopShortfallPolling()
    this.setData({
      sellCardModal: { show: false, step: 'pick', products: [], productId: null, productName: '' },
      punchCardSalePreview: null,
      shortfallSettle: { qrShow: false, qrCodeUrl: '', paymentId: null, retailId: null, payStage: 'waiting' }
    })
  },

  // 试算结果 priceDiff<=0（多退）：直接确认，走 refund 结算腿（退款+建卡+核销服务端一次原子完成）
  onConfirmSellPunchCard() {
    var that = this
    var preview = that.data.punchCardSalePreview
    if (!preview || preview.priceDiff > 0) return
    wx.showModal({
      title: '确认购买次卡',
      content: (preview.priceDiff < 0 ? ('将退还 ' + util.showAmount(-preview.priceDiff) + '，') : '') + '确认购买「' + preview.cardName + '」？',
      complete: function (res) {
        if (!res.confirm) return
        that._finalizeSale({ method: 'refund' })
      }
    })
  },

  // 试算结果 priceDiff>0（需补差价）：选结算方式
  onShortfallMethodChoose(e) {
    var that = this
    var method = e.currentTarget.dataset.method
    var preview = that.data.punchCardSalePreview
    if (!preview || !(preview.priceDiff > 0)) return
    if (method === 'cash') {
      wx.showModal({
        title: '确认收款',
        content: '确认已收到现金 ' + util.showAmount(preview.priceDiff) + '？',
        complete: function (res) {
          if (!res.confirm) return
          that._finalizeSale({ method: 'cash', payMethodLabel: '现金' })
        }
      })
    } else if (method === 'qr') {
      that._openShortfallQr()
    }
  },

  // 唯一真正跨请求异步的结算方式：先建 pending(valid=0) 零售行 + 待支付单，扫码支付成功后才 Finalize。
  // 如果顾客一直不扫/中途放弃，这个 pending 行和待支付单永久停留在无效/待支付状态，无需清理，
  // 订单其它状态（rentals/rental_detail/押金）完全不受影响。
  _openShortfallQr() {
    var that = this
    var order = that.data.order
    var productId = that.data.sellCardModal.productId
    wx.showLoading({ title: '生成二维码', mask: true })
    data.startPunchCardSaleQrPromise(order.id, productId, app.globalData.sessionKey).then(function (res) {
      var payUrl = app.globalData.requestPrefix + 'Order/GetWepayPayment/' + order.id.toString()
        + '?amount=' + res.priceDiff + '&sessionKey=' + app.globalData.sessionKey
      return util.performWebRequest(payUrl, null).then(function (payment) {
        wx.hideLoading()
        var qrText = 'https://mini.snowmeet.top/mapp/order_payment?paymentId=' + payment.id.toString()
        var qrCodeUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent(qrText)
        that.setData({
          shortfallSettle: { qrShow: true, qrCodeUrl: qrCodeUrl, paymentId: payment.id, retailId: res.retailId, payStage: 'waiting' }
        })
        that._startShortfallPolling()
      })
    }).catch(function () { wx.hideLoading() })
  },

  _startShortfallPolling() {
    var that = this
    that._stopShortfallPolling()
    that._shortfallTimer = setInterval(function () {
      var settle = that.data.shortfallSettle
      if (!settle || !settle.paymentId) return
      data.getPaymentLiveStatusPromise(settle.paymentId, app.globalData.sessionKey).then(function (res) {
        if (res && res.stage === 'paid') {
          that._stopShortfallPolling()
          that.setData({ 'shortfallSettle.qrShow': false, 'shortfallSettle.payStage': 'paid' })
          that._finalizeSale({ method: 'qr', retailId: settle.retailId, qrPaymentId: settle.paymentId })
        } else if (res && res.stage) {
          that.setData({ 'shortfallSettle.payStage': res.stage })
        }
      })
    }, 2000)
  },

  _stopShortfallPolling() {
    if (this._shortfallTimer) { clearInterval(this._shortfallTimer); this._shortfallTimer = null }
  },

  onShortfallQrCancel() {
    this._stopShortfallPolling()
    this.setData({ 'shortfallSettle.qrShow': false })
  },

  // 确认落地：服务端重新算一遍、钱落地后才建卡+核销，全部原子完成。
  _finalizeSale(settlement) {
    var that = this
    var order = that.data.order
    var productId = that.data.sellCardModal.productId
    wx.showLoading({ title: '处理中', mask: true })
    data.finalizePunchCardSalePromise(order.id, productId, settlement, app.globalData.sessionKey).then(function () {
      wx.hideLoading()
      wx.showToast({ title: '购买成功', icon: 'success' })
      that.onSellCardModalCancel()
      that.getData()
    }).catch(function () { wx.hideLoading() })
  },

  // 核销链：在「申请退款」时依次 ① 次卡核销(UseRentalPunchCard) ② 储值核销(PayWithDeposit) ③ 退押金(refund)。
  // refundAmount 用页面已可靠算好的预览值（基于 order.totalGuarantyAmount），不读后端返回的 totalRentUnRefund
  // （PayWithDeposit 经 GetOrder 返回、未加载订单级 order.guarantys，恒为 0 会误跳退款）。
  _runWriteoffAndRefund(doPunch, doDeposit, refundAmount) {
    var that = this
    var order = that.data.order
    wx.showLoading({ title: '处理中', mask: true })
    var chain = Promise.resolve()
    if (doPunch && that.data.punchCardSelection) {
      var sel = that.data.punchCardSelection
      chain = chain.then(function () {
        return data.useRentalPunchCardPromise(order.id, { card_id: sel.card_id, punch_count: sel.punch_count }, app.globalData.sessionKey)
      })
    }
    if (doDeposit) {
      chain = chain.then(function () {
        return data.payWithDepositPromise(order.id, app.globalData.sessionKey)
      })
    }
    chain.then(function () {
      var rAmount = parseFloat((refundAmount || 0).toFixed(2))
      if (rAmount <= 0) {
        // 仅核销、无需退款
        wx.hideLoading()
        wx.showToast({ title: '核销成功', icon: 'success' })
        that._clearWriteoffPreview()
        that.getData()
        return
      }
      var refunds = that._allocateRefund(rAmount)
      if (!refunds) {
        wx.hideLoading()
        wx.showToast({ title: '核销成功，但无可退款记录', icon: 'none' })
        that._clearWriteoffPreview()
        that.getData()
        return
      }
      data.refundPromise(order.id, refunds, app.globalData.sessionKey).then(function () {
        wx.hideLoading()
        wx.showToast({ title: '退款成功', icon: 'success' })
        that._clearWriteoffPreview()
        that.getData()
      }).catch(function () {
        wx.hideLoading(); wx.showToast({ title: '退款失败', icon: 'error' }); that._clearWriteoffPreview(); that.getData()
      })
    }).catch(function () {
      wx.hideLoading(); wx.showToast({ title: '核销失败', icon: 'none' }); that._clearWriteoffPreview(); that.getData()
    })
  },

  _clearWriteoffPreview() {
    this.data.payWithDeposit = false
    this.data.punchCardSelected = false
    this.data.punchCardSelection = null
    this.setData({ payWithDeposit: false, punchCardSelected: false, punchCardSelectedCount: 0 })
  },

  // 退押金分配：从可退款支付（排除储值支付）按顺序贪心填到应退额；凑不够返回 null
  _allocateRefund(rAmount) {
    var order = this.data.order
    var refunds = []
    var remaining = rAmount
    for (var i = 0; order.availablePayments && i < order.availablePayments.length && remaining > 0.001; i++) {
      var p = order.availablePayments[i]
      var avail = parseFloat((p.remainAmount || 0).toFixed(2))
      if (p.status == '支付成功' && p.pay_method != '储值支付' && avail > 0) {
        var take = parseFloat(Math.min(avail, remaining).toFixed(2))
        refunds.push({ payment_id: p.id, amount: take, reason: '租赁退押金' })
        remaining = parseFloat((remaining - take).toFixed(2))
      }
    }
    if (remaining > 0.001) return null
    return refunds.length ? refunds : null
  },

  onRefund() {
    var that = this
    var od = that.data.order || {}
    if (od.closed == 1) return
    // 防御性守卫：所有租赁物退租后才能退款/核销（与 wxml disabled 一致）
    if (!od._allRentalsReturned) {
      wx.showToast({ title: '所有租赁物退租后才能操作', icon: 'none' })
      return
    }
    var pendingDeposit = that.data.payWithDeposit && !(od.depositPaidAmount > 0)
    var pendingPunch = !!(that.data.punchCardSelected && that.data.punchCardSelection)
    var refundDue = parseFloat((od.totalRentUnRefund || 0).toFixed(2))
    // 有储值/次卡待核销 → 走核销链（含可能的退押金）。二次确认。
    if (pendingDeposit || pendingPunch) {
      var parts = []
      if (pendingPunch) parts.push('次卡抵 ' + that.data.punchCardSelection.punch_count + ' 次')
      if (pendingDeposit) parts.push('储值付租金 ' + util.showAmount(od.totalRentSummaryAmount))
      var content = parts.join('，') + (refundDue > 0 ? ('，并退押金 ' + util.showAmount(refundDue)) : '') + '。确认核销？'
      wx.showModal({
        title: refundDue > 0 ? '确认退款' : '确认核销',
        content: content,
        complete: function (res) {
          if (!res.confirm) return
          that._runWriteoffAndRefund(pendingPunch, pendingDeposit, refundDue)
        }
      })
      return
    }
    // 无核销 → 纯退押金（原逻辑：单笔/多笔/逐笔输入 modal）
    var order = that.data.order
    var need = refundDue
    if (!need || isNaN(need) || need <= 0) {
      wx.showToast({ title: '无需退款', icon: 'none' })
      return
    }
    // 收集可退款支付（支付成功 + 仍有可退余额）。
    // 退款退的是押金，储值支付付的是租金、不能用于押金，故排除储值支付，不参与退款。
    var payable = []
    var sum = 0
    for (var i = 0; order.availablePayments && i < order.availablePayments.length; i++) {
      var p = order.availablePayments[i]
      var remain = parseFloat((p.remainAmount || 0).toFixed(2))
      if (p.status == '支付成功' && p.pay_method != '储值支付' && remain > 0) {
        payable.push({ payment_id: p.id, method: p.pay_method || '支付', remain: remain, remainStr: util.showAmount(remain) })
        sum += remain
      }
    }
    sum = parseFloat(sum.toFixed(2))
    if (payable.length == 0) {
      wx.showToast({ title: '无可退款支付记录', icon: 'error' })
      return
    }
    if (sum < need - 0.001) {
      wx.showToast({ title: '可退金额不足应退', icon: 'none' })
      return
    }
    // 单笔：直接从这一笔退应退额
    if (payable.length == 1) {
      that._confirmAndRefund([{ payment_id: payable[0].payment_id, amount: need, reason: '租赁退押金' }], need)
      return
    }
    // 多笔 + 可退之和 == 应退：逐笔全额退（不弹输入）
    if (Math.abs(sum - need) < 0.01) {
      var refunds = payable.map(function (x) {
        return { payment_id: x.payment_id, amount: x.remain, reason: '租赁退押金' }
      })
      that._confirmAndRefund(refunds, need)
      return
    }
    // 多笔 + 可退之和 > 应退：弹逐笔输入 modal
    that._openRefundModal(payable, need)
  },

  // 二次确认后提交退款
  _confirmAndRefund(refunds, need) {
    var that = this
    wx.showModal({
      title: '确认退款',
      content: '实际应退 ' + util.showAmount(need),
      complete: function (res) {
        if (!res.confirm) return
        that._submitRefunds(refunds)
      }
    })
  },

  _submitRefunds(refunds) {
    var that = this
    var order = that.data.order
    wx.showLoading({ title: '退款中', mask: true })
    data.refundPromise(order.id, refunds, app.globalData.sessionKey).then(function () {
      wx.hideLoading()
      wx.showToast({ title: '退款成功', icon: 'success' })
      that.getData()
    }).catch(function () {
      wx.hideLoading()
      wx.showToast({ title: '退款失败', icon: 'error' })
    })
  },

  // 打开逐笔输入 modal（多笔 + 可退之和 > 应退）
  _openRefundModal(payable, need) {
    var items = payable.map(function (x) {
      return { payment_id: x.payment_id, method: x.method, remain: x.remain, remainStr: x.remainStr, input: '' }
    })
    this.setData({
      refundModal: {
        show: true, need: need, needStr: util.showAmount(need),
        items: items, allocatedStr: util.showAmount(0),
        remainToAllocStr: util.showAmount(need), canConfirm: false
      }
    })
  },

  onRefundItemInput(e) {
    var idx = e.currentTarget.dataset.idx
    var modal = this.data.refundModal
    var items = modal.items.slice()
    items[idx] = Object.assign({}, items[idx], { input: e.detail.value })
    var allocated = 0
    var overflow = false
    for (var i = 0; i < items.length; i++) {
      var v = parseFloat(items[i].input)
      if (!isNaN(v) && v > 0) {
        allocated += v
        if (v > parseFloat((items[i].remain + 0.001).toFixed(2))) overflow = true
      }
    }
    allocated = parseFloat(allocated.toFixed(2))
    // 待分配（已四舍五入到 2 位）必须严格为 0 才允许确认；
    // 不能用 abs(allocated-need)<0.01——0.02 与 0.03 的浮点差是 0.00999…会被误判为已配平
    var remainToAlloc = parseFloat((modal.need - allocated).toFixed(2))
    var canConfirm = !overflow && remainToAlloc === 0
    this.setData({
      'refundModal.items': items,
      'refundModal.allocatedStr': util.showAmount(allocated),
      'refundModal.remainToAllocStr': util.showAmount(remainToAlloc),
      'refundModal.canConfirm': canConfirm
    })
  },

  onRefundModalCancel() {
    this.setData({ 'refundModal.show': false })
  },

  onRefundModalConfirm() {
    var that = this
    var modal = this.data.refundModal
    if (!modal.canConfirm) {
      wx.showToast({ title: '各笔退款之和需等于应退', icon: 'none' })
      return
    }
    var refunds = []
    for (var i = 0; i < modal.items.length; i++) {
      var v = parseFloat(modal.items[i].input)
      if (!isNaN(v) && v > 0) {
        refunds.push({ payment_id: modal.items[i].payment_id, amount: parseFloat(v.toFixed(2)), reason: '租赁退押金' })
      }
    }
    if (refunds.length == 0) {
      wx.showToast({ title: '请输入退款金额', icon: 'none' })
      return
    }
    this.setData({ 'refundModal.show': false })
    that._submitRefunds(refunds)
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

  // 打开追加页（新建追加 / 继续编辑草稿都走这里）：跳独立追加页 rent_append，带订单上下文
  onOpenAppend() {
    var order = this.data.order
    if (!order || !order.id) return
    wx.navigateTo({
      url: '/pages/admin/rent/rent_append?orderId=' + order.id
        + '&shop=' + encodeURIComponent(order.shop || '')
    })
  },
  // 「去支付」：跳通用结算页（与开单流程同一页）。付完后 settle 的 onPaid 会 redirectTo 回本页重新 getData → 按钮自动消失。
  onGoPay() {
    var order = this.data.order
    if (!order || !order.id) return
    wx.navigateTo({ url: '/pages/payment/settle/index?orderId=' + order.id })
  },

  // 放弃全部未确认草稿：逐个 RemoveAppendingRental（草稿删光 = 订单回到追加前）
  onDiscardAllAppend() {
    var that = this
    var order = that.data.order
    var drafts = (order && order.draftRentals) || []
    if (drafts.length == 0) return
    wx.showModal({
      title: '放弃全部追加',
      content: '将删除 ' + drafts.length + ' 项未确认的追加，确定？',
      complete: function (res) {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中', mask: true })
        var chain = Promise.resolve()
        drafts.forEach(function (d) {
          chain = chain.then(function () {
            var delUrl = app.globalData.requestPrefix
              + 'Rent/RemoveAppendingRental/' + d.id.toString()
              + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '')
            return util.performWebRequest(delUrl, null)
          })
        })
        chain.then(function () {
          wx.hideLoading()
          that.getData()
          wx.showToast({ title: '已放弃', icon: 'success' })
        }).catch(function () {
          wx.hideLoading()
          that.getData()
          wx.showToast({ title: '部分删除失败', icon: 'none' })
        })
      }
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
    var tip = rental._isDraft ? '未确认的追加' : '待支付的追加'
    wx.showModal({
      title: '删除追加项',
      content: tip + '：' + (rental.name || '租赁商品') + ' 即将删除' + (rental._isDraft ? '' : '（含其待支付押金）') + '。',
      complete: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中', mask: true })
        var delUrl = app.globalData.requestPrefix
          + 'Rent/RemoveAppendingRental/' + id.toString()
          + '?sessionKey=' + app.globalData.sessionKey
        util.performWebRequest(delUrl, null).then(function () {
          wx.hideLoading()
          that.getData()
          wx.showToast({ title: '已删除', icon: 'success' })
        }).catch(function () {
          wx.hideLoading()
          wx.showToast({ title: '删除失败', icon: 'error' })
        })
      }
    })
  },
})

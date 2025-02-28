// pages/admin/rent/rent_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    showCreditGallery: false,
    rentalReduce: 0,
    rentalReduceTicket: 0,
    currentDateStr: util.formatDate(new Date()),
    currentTimeStr: util.formatTimeStr(new Date()),
    refunding: false,
    depositAmount: 0,
    depositAmountStr: '¥0.00',
    payWithDeposit: false,
    depositPayAmount: 0,
    depositPayAmountStr: "¥0.00",
    cashPayAmount: 0,
    cashPayAmountStr: "¥0.00",
    logs:[]

  },

  goHome(e){
    wx.redirectTo({
      url: '../admin',
    })
  },

  setStartDate(e){
    var that = this
    var rentOrder = that.data.rentOrder
    var index = parseInt(e.currentTarget.id)
    var detail = rentOrder.details[index]
    var oriStartDateTime = new Date(detail.start_date)
    var newStartDate = e.detail.value
    var newStartDateTimeStr = newStartDate + ' ' + util.formatTimeStr(oriStartDateTime)
    var msg = detail.rent_item_name + ' 起租时间 从 ' + util.formatDateTime(oriStartDateTime) + ' 修改为 ' + newStartDateTimeStr 
    wx.showModal({
      title: '起租时间修改确认',
      content: msg,
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          detail.start_date = newStartDateTimeStr.replace(' ', 'T')
          detail.pickStart_dateStr = newStartDate
          detail.pickStart_timeStr = util.formatTimeStr(oriStartDateTime)
          that.setData({rentOrder: rentOrder})
          that.save(e)
        }
      }
    })
  },

  setStartTime(e){
    var that = this
    var rentOrder = that.data.rentOrder
    var index = parseInt(e.currentTarget.id)
    var detail = rentOrder.details[index]
    var oriStartDateTime = new Date(detail.start_date)
    var newStartTime = e.detail.value
    var newStartDateTimeStr = util.formatDate(oriStartDateTime) + ' ' + newStartTime
    var msg = detail.rent_item_name + ' 起租时间 从 ' + util.formatDateTime(oriStartDateTime) + ' 修改为 ' + newStartDateTimeStr 
    wx.showModal({
      title: '起租时间修改确认',
      content: msg,
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          detail.start_date = newStartDateTimeStr.replace(' ', 'T')
          detail.pickStart_dateStr = util.formatDate(oriStartDateTime)
          detail.pickStart_timeStr = newStartTime
          that.setData({rentOrder: rentOrder})
          that.save(e)
        }
      }
    })
  },

  setReturnDate(e){
    var that = this
    var rentOrder = that.data.rentOrder
    var index = parseInt(e.currentTarget.id)
    var detail = rentOrder.details[index]
    var oriEndDateTime = new Date(detail.real_end_date)
    var newEndDate = e.detail.value
    var newEndDateTimeStr = newEndDate + ' ' + util.formatTimeStr(oriEndDateTime)
    var msg = detail.rent_item_name + ' 退租时间 从 ' + util.formatDateTime(oriEndDateTime) + ' 修改为 ' + newEndDateTimeStr 
    wx.showModal({
      title: '起租时间修改确认',
      content: msg,
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          detail.real_end_date = newEndDateTimeStr.replace(' ', 'T')
          detail.pickEnd_dateStr = newEndDate
          detail.pickEnd_timeStr = util.formatTimeStr(oriEndDateTime)
          that.setData({rentOrder: rentOrder})
          that.save(e)
        }
      }
    })

  },
  setReturnTime(e){
    var that = this
    var rentOrder = that.data.rentOrder
    var index = parseInt(e.currentTarget.id)
    var detail = rentOrder.details[index]
    var oriEndDateTime = new Date(detail.real_end_date)
    var newEndTime = e.detail.value
    var newEndDateTimeStr = util.formatDate(oriEndDateTime) + ' ' + newEndTime
    var msg = detail.rent_item_name + ' 退租时间 从 ' + util.formatDateTime(oriEndDateTime) + ' 修改为 ' + newEndDateTimeStr 
    wx.showModal({
      title: '起租时间修改确认',
      content: msg,
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          detail.real_end_date = newEndDateTimeStr.replace(' ', 'T')
          detail.pickEnd_dateStr = util.formatDate(oriEndDateTime)
          detail.pickEnd_timeStr = newEndTime
          that.setData({rentOrder: rentOrder})
          that.save(e)
          //that.getData()
        }
      }
    })
  },

  showGallery(e){
    var that = this
    var id = e.currentTarget.id
    if (id.indexOf('credit')>=0){
      that.setData({showCreditGallery: true})
    }
  },
 
  getData(){
    var that = this
    
    var getUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentOrder/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){

          var rentOrder = res.data
          console.log('rent order', rentOrder)

          var startDate = new Date(rentOrder.start_date)
          var currentTime = new Date()

          if (rentOrder.end_date != null){
            currentTime = new Date(rentOrder.end_date)
          }

          rentOrder.guarantee_credit_photos_arr = rentOrder.guarantee_credit_photos.split(',')
          
          rentOrder.deposit_real_str = util.showAmount(rentOrder.deposit_real)
          rentOrder.deposit_reduce_str = util.showAmount(rentOrder.deposit_reduce)
          rentOrder.deposit_final_str = util.showAmount(rentOrder.deposit_final)
          rentOrder.additionalAmountStr = util.showAmount(rentOrder.additionalPaidAmount)
          rentOrder.depositPaid = rentOrder.deposit_real + rentOrder.additionalPaidAmount - rentOrder.deposit_reduce
          rentOrder.depositPaidStr = util.showAmount(rentOrder.depositPaid)
          var dueEndTime = new Date(rentOrder.due_end_date)
          rentOrder.due_end_time_str = util.formatDate(dueEndTime) + ' ' + util.formatTimeStr(dueEndTime)
          if (rentOrder.order_id > 0){

            var payTime =  undefined
            if (rentOrder.order.pay_time != null){
              payTime = new Date(rentOrder.order.pay_time) 
            }
            else{
              if (rentOrder.order.payments != null && rentOrder.order.payments.length > 0){
                payTime = new Date(rentOrder.order.payments[0].create_date) 
              }
            }


            var orderDate = new Date(rentOrder.create_date)
            if (payTime!=undefined){
            rentOrder.paidTimeStr = util.formatDate(payTime) + ' ' + util.formatTimeStr(payTime)
            }
            else{
              rentOrder.paidTimeStr = '——'
            }
            if (rentOrder.order.payments != null && rentOrder.order.payments.length > 0){
              rentOrder.outTradeNo = rentOrder.order.payments[0].out_trade_no
            }
            else{
              rentOrder.outTradeNo = '——'
            }
            rentOrder.create_date_str = util.formatDate(orderDate) + ' ' + util.formatTimeStr(orderDate)
          }
          else{
            rentOrder.paidTimeStr = '-'
            rentOrder.outTradeNo = '-'
          }
          var totalRental = 0
          var txtColor = '#73703A'
          var lastPackage = null
          for(var i = 0; i < rentOrder.details.length; i++)
          {
            var detail = rentOrder.details[i]
            if (detail.package_code != null && lastPackage != detail.package_code){
              if (txtColor == '#73703A'){
                txtColor = '#00007F'
              }
              else{
                txtColor = '#73703A'
              }
              if (detail.package_code != null){
                lastPackage = detail.package_code
              }
            }






            if (detail.package_code == null){
              detail.txtColor = '#000000'
            }
            else{
              detail.txtColor = txtColor
            }

            detail.suggestRental_str = util.showAmount(detail.suggestRental)
            var startDate = new Date(detail.start_date)
            detail.start_dateStr = util.formatDateTime(startDate)

            detail.pickStart_dateStr = util.formatDate(startDate)
            detail.pickStart_timeStr = util.formatTimeStr(startDate)
            if (detail.pickStart_timeStr == '00:00:00'){
              detail.pickStart_timeStr = '-'
            }

            if (detail.real_end_date != null){
              var endDate = new Date(detail.real_end_date)
              detail.pickEnd_dateStr = util.formatDate(endDate)
              detail.pickEnd_timeStr = util.formatTimeStr(endDate)
            }


            if (detail.real_end_date == undefined || detail.real_end_date == null){
              detail.real_end_dateStr = '--'
            }
            else{
              detail.real_end_dateStr = util.formatDateTime(new Date(detail.real_end_date))
            }
            if (detail.status == '未归还'){
              detail.real_rental = detail.suggestRental
              detail.real_rental_str = util.showAmount(detail.real_rental)
            }
            else{
              detail.real_rental_str = util.showAmount(detail.real_rental)
            }
            if (detail.end_date == null){
              detail.end_dateStr = '--'
            }
            else {
              var endDate = new Date(detail.end_date)
              detail.end_dateStr = til.formatDate(endDate) + ' ' + util.formatTimeStr(endDate)
            }
            totalRental = totalRental + detail.real_rental
            detail.unit_rental_str = util.showAmount(detail.unit_rental)
            detail.deposit_str = util.showAmount(detail.deposit)
            detail.refund_str = util.showAmount(detail.deposit - detail.real_rental - detail.overtime_charge - detail.reparation)
            detail.imageArr = detail.images.split(',')
            detail.reparationStr = util.showAmount(detail.reparation)
            detail.showGallery = false
            detail.overtime_charge_str = util.showAmount(detail.overtime_charge)
            detail.pickedDateStr = detail.end_dateStr
            detail.pickedTimeStr = that.data.currentTimeStr

            if (detail.pick_date){
              var pickDate = new Date(detail.pick_date)
              detail.pick_dateDateStr = util.formatDate(pickDate)
              detail.pick_dateTimeStr = util.formatTimeStr(pickDate)
            }
            if (detail.return_date){
              var returnDate = new Date(detail.pick_date)
              detail.return_dateDateStr = util.formatDate(returnDate)
              detail.return_dateTimeStr = util.formatTimeStr(returnDate)
            }


            if (detail.log){
              var logs = detail.log.sort((a, b) => {
                var timeA = new Date(a.create_date)
                var timeB = new Date(b.create_date)
                if (timeA < timeB){
                  return -1
                }
                else{
                  return 1
                }
              })
              
              for(var k = 0; k < logs.length; k++){
                var log = logs[k]
                var logDate = new Date(log.create_date)
                log.dateStr = util.formatDate(logDate)
                log.timeStr = util.formatTimeStr(logDate)
              }
            }
            rentOrder.details[i] = detail



          }
          rentOrder = that.computeAmount(rentOrder)
          var realTotalAmount = 0
          var realTotalRefund = 0
          /*
          var refunds = []
          for(var j = 0; rentOrder.order != null && rentOrder.order.refunds != null && j < rentOrder.order.refunds.length; j++){
            var r = rentOrder.order.refunds[j];
            if (r.refundSuccess){
              r.create_dateStr = util.formatDateTime(new Date(r.create_date))
              r.amountStr = util.showAmount(r.amount)
              refunds.push(r)
              realTotalRefund += r.amount
            }
          }
          */

          var refunds = []
          var totalRefund = 0
          for(var j = 0; rentOrder.order != null && rentOrder.order.refunds != null && j < rentOrder.order.refunds.length; j++){
            var r = rentOrder.order.refunds[j];
            var balanceItem = {}
            if (r.refundSuccess){
              balanceItem.outTradeNo = r.out_refund_no
              balanceItem.payMethod = '——'
              balanceItem.create_date = new Date(r.create_date)
              balanceItem.create_dateStr = util.formatDateTime(new Date(r.create_date))
              balanceItem.create_timeStr = util.formatTimeStr(new Date(r.create_date))
              balanceItem.amount = -1 * r.amount 
              //realTotalRefund += r.amount
              balanceItem.amountStr = util.showAmount(balanceItem.amount)
              balanceItem.memo = (r.memo == ''? '退款': r.memo)
              balanceItem.staffName = r.msa.member.real_name
              //balanceItem.msa = rentOrder.order.msa
              refunds.push(balanceItem)
              //totalRefund += r.amount
              realTotalAmount += balanceItem.amount
            }
          }
          var incomes = []
          var totalIncome = 0
          for(var j = 0; rentOrder.order != null && rentOrder.order.payments != null && j < rentOrder.order.payments.length; j++){
            var r = rentOrder.order.payments[j]
            var balanceItem = {}
            if (r.status == '支付成功'){
              balanceItem.outTradeNo = r.out_trade_no
              balanceItem.create_date = new Date(r.create_date)
              balanceItem.create_dateStr = util.formatDateTime(new Date(r.create_date))
              balanceItem.create_timeStr = util.formatTimeStr(new Date(r.create_date))
              balanceItem.amount = r.amount 
              balanceItem.amountStr = util.showAmount(balanceItem.amount)
              balanceItem.memo = '押金'
              balanceItem.payMethod = r.pay_method
              balanceItem.staffName = rentOrder.order.msa.member.real_name
              //balanceItem.msa = 
              incomes.push(balanceItem)
              totalIncome += r.amount
              realTotalAmount += balanceItem.amount
            }
          }
          incomes.sort((a,b) => (a.create_date - b.create_date))
          refunds.sort((a,b) => (a.create_date - b.create_date))
          console.log('incomes', incomes)
          console.log('refunds', refunds)
        
          var realTotalRefundStr = util.showAmount(rentOrder.totalRefund)
          var bonus = rentOrder.deposit_final - rentOrder.totalRefund + that.data.rentOrder.additionalPaidAmount
          
          that.setData({rentOrder: rentOrder, payWithDeposit: (rentOrder.totalDepositPaidAmount==0? false: true),
            rentalReduce: rentOrder.rental_reduce, rentalReduceStr: util.showAmount(rentOrder.rental_reduce),
            rentalReduceTicket: rentOrder.rental_reduce_ticket, rentalReduceTicketStr: util.showAmount(rentOrder.rental_reduce_ticket),
              realTotalRefund: realTotalRefund, realTotalRefundStr: realTotalRefundStr, bonus: bonus, bonusStr: util.showAmount(bonus), textColor: rentOrder.textColor, backColor: rentOrder.backColor, realTotalAmount, incomes, refunds, 
              totalIncome, totalIncomeStr: util.showAmount(totalIncome), totalRefund, totalRefundStr: util.showAmount(totalRefund)})
          that.computeTotal()
          that.getDepositAmount()
          that.getLog()
        }
      }
    })
  },
  setRental(e){
    console.log('input rental', e)
    var that = this
    var id = parseInt(e.currentTarget.id.split('_')[1])
    var value = parseFloat(e.detail.value)
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]

    if (isNaN(value)){
      detail.real_rental = detail.suggestRental
      detail.filled_rental = ''
    }
    
    else {
      detail.filled_rental = value
      detail.real_rental = value
    }
    
    detail.refund_str = util.showAmount(detail.deposit - detail.filled_rental - detail.reparation - detail.overtime_charge)
    that.setData({rentOrder: rentOrder})
    that.computeTotal()
  },

  setReparation(e){
    var that = this
    var id = parseInt(e.currentTarget.id.split('_')[1])
    var value = parseFloat(e.detail.value)
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]

    if (!isNaN(value)){
      detail.reparation = value
    }
    
    detail.refund_str = util.showAmount(detail.deposit - detail.real_rental - detail.reparation - detail.overtime_charge)
    that.setData({rentOrder: rentOrder})
    that.computeTotal()
  },

  setRentalReduce(e){
    var value = parseFloat(e.detail.value)
    if (isNaN(value)){
      value = 0
    }
    var that = this
    that.setData({rentalReduce: value})
    that.computeTotal()
  },
  setRentalReduceTicket(e){
    var value = parseFloat(e.detail.value)
    if (isNaN(value)){
      value = 0
    }
    var that = this
    that.setData({rentalReduceTicket: value})
    that.computeTotal()
  },
  computeTotal(){
    var that = this
    var rentOrder = that.data.rentOrder
    var totalRental = 0
    var totalReparation = 0
    var totalOvertimeCharge = 0
    for(var i = 0; i < rentOrder.details.length; i++){
      
      var detail = rentOrder.details[i]
      if (detail.rental_discount == undefined || isNaN(detail.rental_discount)){
        detail.rental_discount = 0
      }
      detail.rental_discountStr = util.showAmount(detail.rental_discount)
      if (detail.rental_ticket_discount == undefined || isNaN(detail.rental_ticket_discount)){
        detail.rental_ticket_discount = 0
      }
      detail.rental_ticket_discountStr = util.showAmount(detail.rental_ticket_discount)
      var rental = detail.suggestRental - detail.rental_ticket_discount - detail.rental_discount
      detail.real_rental = rental
      detail.real_rental_str = util.showAmount(rental)
      detail.refund_str = util.showAmount(detail.deposit - detail.real_rental - detail.reparation - detail.overtime_charge)
      detail.paySummary = rental + detail.reparation + detail.overtime_charge
      detail.paySummaryStr = util.showAmount(detail.paySummary)
      totalRental = totalRental + rental
      totalReparation = totalReparation + detail.reparation
      totalOvertimeCharge = totalOvertimeCharge + detail.overtime_charge
    }
    var refundAmount = that.data.rentOrder.deposit_final - totalRental + that.data.rentalReduce + that.data.rentalReduceTicket - totalReparation - totalOvertimeCharge
    
    var payWithDeposit = that.data.payWithDeposit
    var cashPayAmount = totalRental + totalOvertimeCharge  - that.data.rentalReduce - that.data.rentalReduceTicket + totalReparation
    var depositPayAmount = that.data.depositPayAmountMod? 
      that.data.depositPayAmount : rentOrder.totalDepositPaidAmount

    /*
    if (payWithDeposit){
      depositPayAmount = totalRental + totalOvertimeCharge  - that.data.rentalReduce - that.data.rentalReduceTicket
      cashPayAmount = totalReparation
      refundAmount += depositPayAmount
    }
    else{
      depositPayAmount = that.data.depositPayAmount
    }
    */
    cashPayAmount = cashPayAmount - depositPayAmount
    var rentalSettleAmount = totalRental + totalOvertimeCharge - that.data.rentalReduce - that.data.rentalReduceTicket
    
    var cashTotal = cashPayAmount + totalReparation 
    refundAmount = rentOrder.depositPaid - cashTotal
    var unRefund = refundAmount - that.data.rentOrder.totalRefund

    var unRefundStr = util.showAmount(unRefund)
    that.setData({refundAmount: refundAmount, refundAmountStr: util.showAmount(refundAmount),
      totalRental: totalRental, totalRentalStr: util.showAmount(totalRental), totalReparation, totalReparationStr: util.showAmount(totalReparation), totalOvertimeCharge: totalOvertimeCharge, totalOvertimeChargeStr: util.showAmount(totalOvertimeCharge), rentOrder: rentOrder, unRefund: unRefund, unRefundStr: unRefundStr, depositPayAmount, depositPayAmountStr: util.showAmount(depositPayAmount), cashPayAmount, cashPayAmountStr: util.showAmount(cashPayAmount), rentalSettleAmount, rentalSettleAmountStr: util.showAmount(rentalSettleAmount),
      cashTotal, cashTotalStr: util.showAmount(cashTotal)})
  },
  
//////set buttons/////////////
  computeAmount(rentOrder){
    var that = this
    var details = rentOrder.details
    for(var i = 0; i < details.length; i++){
      var unit_rental = parseFloat(details[i].unit_rental)
      var real_rental = parseFloat(details[i].real_rental)
      var deposit = parseFloat(details[i].deposit)
      var overtime_charge = parseFloat(details[i].overtime_charge)
      var reparation = parseFloat(details[i].reparation)
      var refund = parseFloat(details[i].refund)
      if (isNaN(unit_rental)){
        details[i].unit_rental_str = "¥0.00"
      }
      else{
        details[i].unit_rental_str = util.showAmount(unit_rental)
      }
      if (isNaN(real_rental)){
        details[i].real_rental_str = "¥0.00"
      }
      else {
        details[i].real_rental_str = util.showAmount(real_rental)
      }
      if (isNaN(deposit)){
        details[i].deposit_str = "¥0.00"
      }
      else{
        details[i].deposit_str = util.showAmount(deposit)
      }
      if (isNaN(overtime_charge)){
        details[i].overtime_charge_str = "¥0.00"
      }
      else{
        var overtime_charge_str = util.showAmount(overtime_charge)
        details[i].overtime_charge_str = overtime_charge_str
      }
      if (isNaN(reparation)){
        details[i].reparationStr = "¥0.00"
      }
      else{
        details[i].reparationStr = util.showAmount(reparation)
      }
      details[i].real_rental_str = util.showAmount(details[i].real_rental)
      refund = deposit - overtime_charge - reparation - real_rental
      
      details[i].refund_str = util.showAmount(refund)
      details[i].refund = refund
      
    }
    for(var i = 0; i < rentOrder.payments.length; i++){
      var p = rentOrder.payments[i]
      p.amountStr = util.showAmount(p.amount)
      p.create_dateStr = util.formatDateTime(new Date(p.create_date))
      p.memo = '押金'
      for(var j = 0; j < rentOrder.additionalPayments.length; j++){
        if (p.order_id == rentOrder.additionalPayments[j].order_id){
          p.memo = rentOrder.additionalPayments[j].reason
        }
      }
    }
    for(var i = 0; i < rentOrder.refunds.length; i++){
      var r = rentOrder.refunds[i]
      r.create_dateStr = util.formatDateTime(new Date(r.create_date))
      r.amountStr = util.showAmount(r.amount)
    }
    rentOrder.totalChargeStr = util.showAmount(rentOrder.totalCharge)
    rentOrder.totalRefundStr = util.showAmount(rentOrder.totalRefund)
    that.setData({rentOrder: rentOrder})
    return rentOrder
  },

  setKeep(e){
    var id = parseInt(e.currentTarget.id)
    if (isNaN(id)){
      return 
    }
    var that = this
    var detail = that.data.rentOrder.details[id]
    var setUrl = 'https://' + app.globalData.domainName + '/core/Rent/SetDetailLog/' + detail.id + '?status=' + encodeURIComponent('已暂存') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setUrl,
      method: 'GET',
      success:(res)=>{
        wx.showToast({
          icon:'success',
          title: '已暂存。',
        })
        that.getData()
      }
    })
  },

  setUnKeep(e){
    var id = parseInt(e.currentTarget.id)
    if (isNaN(id)){
      return 
    }
    var that = this
    var detail = that.data.rentOrder.details[id]
    var setUrl = 'https://' + app.globalData.domainName + '/core/Rent/SetDetailLog/' + detail.id + '?status=' + encodeURIComponent('已发放') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setUrl,
      method: 'GET',
      success:(res)=>{
        wx.showToast({
          icon:'success',
          title: '已提取。',
        })
        that.getData()
      }
    })
  },
  setPick(e){
    var that = this
    var id = parseInt(e.currentTarget.id)
    var detail = that.data.rentOrder.details[id]
    if ((detail.rent_item_class == '单板' || detail.rent_item_class == '单板鞋' 
      || detail.rent_item_class == '双板' || detail.rent_item_class == '双板鞋')
      && detail.rent_item_code == ''){
        wx.showToast({
          title: '板鞋类必填编号。',
          icon: 'error'
        })
        return
      }
    wx.showModal({
      title: '确认发放装备',
      content: '点确认之前，请先和顾客确认装备是否有误或损坏。',
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          that.setPcikConfirm(e)
        }
      }
    })
  },
  setPcikConfirm(e){
    var id = parseInt(e.currentTarget.id)
    if (isNaN(id)){
      return 
    }
    var that = this
    var detail = that.data.rentOrder.details[id]
    var setUrl = 'https://' + app.globalData.domainName + '/core/Rent/SetDetailLog/' + detail.id + '?status=' + encodeURIComponent('已发放') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setUrl,
      method:'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        detail = res.data
        var rentOrder = that.data.rentOrder
        rentOrder.details[id] = detail
      
        wx.showToast({
          title: '装备已发放',
          icon: 'success',
          duration: 1000,
          success:()=>{
            rentOrder = that.computeAmount(rentOrder)
            that.setData({rentOrder: rentOrder})
            that.getData()
          }
        })
      }
    })
  },


  setRentStart(e){
    var id = parseInt(e.currentTarget.id)
    if (isNaN(id)){
      return 
    }
    var that = this
    var detail = that.data.rentOrder.details[id]
    var setUrl = 'https://' + app.globalData.domainName + '/core/Rent/SetRentStart/' + detail.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){
          detail = res.data
          var rentOrder = that.data.rentOrder
          rentOrder.details[id] = detail
          
          wx.showToast({
            title: '租赁开始',
            icon: 'success',
            duration: 1000,
            success:()=>{
              rentOrder = that.computeAmount(rentOrder)
              that.setData({rentOrder: rentOrder})
              that.getData()
            }
          })
        }
      }
    })
  },

  setUnReturn(e){
    var that = this
    var id = parseInt(e.currentTarget.id.split('_')[1])
    if (isNaN(id)){
      return 
    }
    var detail = that.data.rentOrder.details[id]
    var setUrl = 'https://' + app.globalData.domainName + '/core/Rent/SetUnReturn/' + detail.id
      + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setUrl,
      success:(res)=>{
        if (res.statusCode == 200){
          that.getData()
        }
      }
    })
  },

  setReturn(e){
    var id = parseInt(e.currentTarget.id.split('_')[1])
    if (isNaN(id)){
      return 
    }

    var that = this
    var detail = that.data.rentOrder.details[id]

    

    var nowDate = util.formatDateString(new Date())
    var realRental = parseFloat(detail.filled_rental)
    var reparation = parseFloat(detail.reparation)
    if (isNaN(realRental)){
      realRental = parseFloat(detail.suggestRental)
    }
    var returnDate = detail.pickedDateStr + ' ' + detail.pickedTimeStr
    var setUrl = 'https://' + app.globalData.domainName + '/core/Rent/SetReturn/' + detail.id
      + '?rental=' + encodeURIComponent(realRental) 
      + '&returnDate=' + encodeURIComponent(nowDate) + '&reparation=' + encodeURIComponent(reparation)
      + '&memo=' + encodeURIComponent(detail.memo) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      + '&overTimeCharge=' + encodeURIComponent(detail.overtime_charge)
    wx.request({
      url: setUrl,
      method: 'GET',
      success:(res) => {
        if (res.statusCode == 200){
          that.getData()
        }
      }
    })
    return true
  },
  setMod(e){
    var id = parseInt(e.currentTarget.id)
    if (isNaN(id)){
      return 
    }
    var that = this
    var rentOrder = that.data.rentOrder
    rentOrder.details[id].isEdit = true
    var classStr = rentOrder.details[id].rent_item_class
    var classId = 0
    var classList = that.data.classList
    for(var i = 0; i < classList.length; i++){
      if (classList[i] == classStr){
        classId = i
        break
      }
    }
    rentOrder.details[id].classIndex = classId
    rentOrder = that.computeAmount(rentOrder)
    that.setData({rentOrder: rentOrder})
  },
  setAppend(e){
    var id = parseInt(e.currentTarget.id)
    var that = this
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    if (detail.id != 0){
      return
    }
    //detail.images = ''
    if (!that.checkValid(detail)){
      return
    }
    var updateUrl = 'https://' + app.globalData.domainName + '/core/Rent/AppendDetail?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method: 'POST',
      data: detail,
      success:(res)=>{
        if (res.statusCode == 200){
          console.log('append detail', res)
          detail = res.data
          rentOrder.details[id] = detail
          rentOrder = that.computeAmount(rentOrder)
          that.setData({rentOrder: rentOrder})
          that.setRentStart(e)
        }
      }
    })
  },
  setOrderMemo(e){
    console.log('set memo', e)
    var that = this
    var rentOrder = that.data.rentOrder
    var value = e.detail.value
    var setUrl = 'https://' + app.globalData.domainName + '/core/Rent/SetMemo/' + rentOrder.id + '?memo=' + encodeURIComponent(value) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setUrl,
      method: 'GET'
    })
  },
  setInstance(e){
    var id = parseInt(e.currentTarget.id)
    var that = this
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    if (!that.checkValid(detail)){
      return
    }
    var updateUrl = 'https://' + app.globalData.domainName + '/core/Rent/UpdateDetail?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method: 'POST',
      data: detail,
      success:(res)=>{
        if (res.statusCode == 200){
          console.log('update detail', res)
          that.setRentStart(e)
        }
      }
    })
  },

  reserveMore(e){
    var that = this
    var id = parseInt(e.currentTarget.id.split('_')[1])
    
    var detail = that.data.rentOrder.details[id]
    if (that.setReturn(e)){
      var reserveUrl = 'https://' + app.globalData.domainName + '/core/Rent/ReserveMore/' + detail.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: reserveUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode == 200){
            that.getData()
          }
        }
      })
    }

  },

////set buttons end/////


  setMemo(e){
    var id = parseInt(e.currentTarget.id.split('_')[1])
    if (isNaN(id)){
      return 
    }
    var that = this
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    detail.memo = e.detail.value
    that.setData({rentOrder: rentOrder})
  },

  setRefundAmount(e){
    var value = parseFloat(e.detail.value)
    var that = this
    if (isNaN(value)){
      return
    }
    that.setData({refundAmount: value})
  },
  refundConfirm(){
    var that = this
    that.setData({refunding: true})
    var unRefund = that.data.unRefund
    var unRefundStr = that.data.unRefundStr
    var paid = that.data.rentOrder.deposit_final_str
    var rental = that.data.totalRentalStr
    var refunded = that.data.realTotalRefundStr
    console.log('deposit pay', that.data.depositPayAmount)
    console.log('refund', that.data.refundAmount)
    var content = '已付押金：' + paid + '  租金：' + rental + '  已退：'+refunded + '  本次退款：'+ unRefundStr
    if (that.data.payWithDeposit){
      content = '已付押金：' + paid + '  【储值支付】租金：' + rental + '  已退：'+refunded + '  本次退款：'+ unRefundStr
    }
    //return
    
    wx.showModal({
      title: '退款确认',
      content: content,
      complete: (res) => {
        if (res.cancel) {
          that.setData({refunding: false})
        }
    
        if (res.confirm) {
          that.refund(unRefund)
          if (that.data.depositPayAmount > 0){
            that.payWithDeposit()
          }
        }
      }
    })
  },
  refund(amount){
    var that = this
    var refundUrl = 'https://' + app.globalData.domainName + '/core/Rent/Refund/' + that.data.rentOrder.id 
    + '?amount=' + encodeURIComponent(amount) + '&memo=' + encodeURIComponent(that.data.rentOrder.memo)
    + '&rentalReduce=' + encodeURIComponent(that.data.rentalReduce) 
    + '&rentalReduceTicket=' + encodeURIComponent(that.data.rentalReduceTicket)
    + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: refundUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode == 200){
          that.close()
        }
      },
      complete:(res)=>{
        that.setData({refunding: false})
        that.getData()
        that.computeTotal()
      }
    })
  },
  showDetailGallery(e){
    var id = parseInt(e.currentTarget.id)
    var that = this
    if (isNaN(id)){
      return
    }
    var rentOrder = that.data.rentOrder
    rentOrder.details[id].showGallery = true
    that.setData({rentOrder: rentOrder})
    rentOrder.details[id].showGallery = false
  },
  setOvertimeCharge(e){
    var id = parseInt(e.currentTarget.id)
    var that = this
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    
    var value = parseFloat(e.detail.value)
    if (isNaN(value)){
      return
    }
    detail.filled_overtime_charge = value
    detail.overtime_charge = value
    detail.refund_str = util.showAmount(detail.deposit - detail.real_rental - detail.reparation - detail.overtime_charge)
    that.setData({rentOrder: rentOrder})
    that.computeTotal()

  },

  setDiscount(e){
    var id = parseInt(e.currentTarget.id.split('_')[1])
    var that = this
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    var value = parseFloat(e.detail.value)
    if (isNaN(value)){
      return
    }
    detail.rental_discount = value
    that.computeDetail(detail)
    that.setData({rentOrder: rentOrder})
    that.computeTotal()
  },

  setTicketDiscount(e){
    var id = parseInt(e.currentTarget.id.split('_')[2])
    var that = this
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    var value = parseFloat(e.detail.value)
    if (isNaN(value)){
      return
    }
    detail.rental_ticket_discount = value
    that.computeDetail(detail)
    that.setData({rentOrder: rentOrder})

    that.computeTotal()
  },

  

  setCode(e){
    console.log('input code', e)
  },

  setTextValue(e){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var id = parseInt(idArr[1])
    var name = idArr[0]
    var rentOrder = that.data.rentOrder
    var v = e.detail.value
    var detail = rentOrder.details[id]
    switch(name){
      case 'name':
        detail.rent_item_name = v
        break
      case 'code':
        detail.rent_item_code = v
        break
      default:
        break
    }
    that.setData({rentOrder: rentOrder})
  },

  selectClass(e){
    var that = this
    var id = e.currentTarget.id
    var v = parseInt(e.detail.value)
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    var classList = that.data.classList
    var className = classList[v]
    detail.classIndex = v
    detail.rent_item_class = className
    that.setData({rentOrder: rentOrder})
  },

  setCharge(e){
    var id = parseInt(e.currentTarget.id)
    if (isNaN(id)){
      return 
    }
    var that = this
    var detail = that.data.rentOrder.details[id]

    var realRental = parseFloat(detail.filled_rental)
    var reparation = parseFloat(detail.reparation)
    if (isNaN(realRental)){
      realRental = parseFloat(detail.real_rental)
    }
    

    var modUrl = 'https://' + app.globalData.domainName + '/core/Rent/ModItemInfo/' + detail.id
      + '?rental=' + encodeURIComponent(realRental) 
      + '&reparation=' + encodeURIComponent(reparation)
      + '&memo=' + encodeURIComponent(detail.memo) 
      + '&overTimeCharge=' + encodeURIComponent(detail.overtime_charge)
      + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    console.log('modurl', modUrl)
  
    wx.request({
      url: modUrl,
      method:'GET',
      success:(res)=>{
        if (res.statusCode == 200)
        {
          wx.showToast({
            title: '修改成功',
            icon: 'success',
            success:()=>{
              var rentOrder = that.data.rentOrder
              rentOrder.details[id].isEdit = false
              that.setData({rentOrder: rentOrder})
            }
          })
        }
      }
    })
  },

  gotoPay(){
    var that = this
    wx.navigateTo({
      url: 'rent_pay?id=' + that.data.id,
    })
  },
  scan(e){
    var id = e.currentTarget.id
    var that = this
    wx.scanCode({
      onlyFromCamera: false,
      success:(res)=>{
        console.log('scan result', res)
        var code = res.result

        //var currentRentItem = that.data.currentRentItem
        //currentRentItem.code = code
        that.getItemInfo(code, id)
      }
    })
  },
  getItemInfo(code, index){
    var that = this
    var currentRentItem = that.data.currentRentItem
    var classList = that.data.classList
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[index]
    var getItemUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentItem/' + code + '?shop=' + encodeURIComponent('万龙')
    wx.request({
      url: getItemUrl,
      success:(res)=>{
        if (res.statusCode == 200){
          detail.rent_item_name = res.data.name
          detail.rent_item_class = res.data.class
          detail.rent_item_code = code
          detail.classIndex = 0
          for(var i = 0; i < classList.length; i++){
            if (classList[i] == detail.rent_item_class){
              detail.classIndex = i
              break;
            }
          }
          detail.unit_rental = res.data.rental
          that.setData({rentOrder: rentOrder})
        
        }
      }
    })
  },

  addMore(){
    var that = this
    var rentOrder = that.data.rentOrder
    var detail = {
      rent_item_code: '',
      rent_item_name: '',
      rent_item_class: '',
      rent_list_id: rentOrder.id,
      classIndex: 0,
      status: '未领取',
      deposit_type: '立即租赁',
      due_end_time_str: util.formatDateString(new Date()),
      unit_rental: 0,
      unit_rental_str: '¥0.00',
      timeLength: '1天',
      deposit: 0,
      deposit_str: '¥0.00',
      real_rental: 0,
      real_rental_str: '¥0.00',
      overTime: false,
      overtime_charge: 0,
      overtime_charge_str: '¥0.00',
      reparation: 0,
      reparationStr: '¥0.00',
      refund: 0,
      refund_str: '¥0.00',
      id: 0,
      isEdit: true,
      images: '',
      memo: '',
      rental_discount: 0,
      rental_discountStr: '¥0.00',
      rental_ticket_discount: 0,
      rental_ticket_discountStr: '¥0.00',
      suggestRental_str: '¥0.00'
    }

    rentOrder.details.push(detail)
    that.setData({rentOrder: rentOrder})
  },

  computeDetail(detail){

    var count = parseInt(detail.timeLength.replace('天', ''))
    if (isNaN(count)){
      count = 1
    }
    if (isNaN(detail.unit_rental)){
      detail.unit_rental = 0
    }
    detail.suggestRental = detail.unit_rental * count

    if (isNaN(detail.rental_discount)){
      detail.rental_discount = 0
    }
    if (isNaN(detail.rental_ticket_discount)){
      detail.rental_ticket_discount = 0
    }
    if (isNaN(detail.overtime_charge)){
      detail.overtime_charge = 0
    }
    if (isNaN(detail.reparation)){
      detail.reparation = 0
    }
    detail.paySummary = detail.suggestRental - detail.rental_discount - detail.rental_ticket_discount

    detail.suggestRental_str = util.showAmount(detail.suggestRental)
    detail.unit_rental_str = util.showAmount(detail.unit_rental_)
    detail.rental_discountStr = util.showAmount(detail.rental_discount)
    detail.rental_ticket_discountStr = util.showAmount(detail.rental_ticket_discount)
    detail.overtime_charge_str = util.showAmount(detail.overtime_charge)
    detail.reparationStr = util.showAmount(detail.reparation)
    detail.paySummaryStr = util.showAmount(detail.paySummary)
    return detail
  },

  restore(){
    var that = this
    var rentOrder = that.data.rentOrder
    for(var i = 0; i < rentOrder.details.length; i++){
      rentOrder.details[i].isEdit = false
    }
    that.setData({rentOrder: rentOrder})
  },

  


  setUnitRental(e){
    var that = this
    var id = parseInt(e.currentTarget.id)
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    var v = parseFloat(e.detail.value)
    if (!isNaN(v)){
      detail.unit_rental = v
      detail.unit_rental_str = util.showAmount(v)
      that.computeDetail(detail)
      that.setData({rentOrder: rentOrder})
    }
  },

  save(e){
    var that = this
    var rentOrder = that.data.rentOrder
    var id = parseInt(e.currentTarget.id)
    var detail = rentOrder.details[id]
    that.computeAmount(rentOrder)
    that.computeTotal()
    if (rentOrder.depositPaid < that.data.refundAmount){
      wx.showToast({
        title: '应退金额>押金',
        icon: 'error'
      })
      that.getData()
      return
    }
    if (Math.round(that.data.unRefund*100) < 0){
      wx.showToast({
        title: '未退金额<0',
        icon: 'error'
      })
      that.getData()
      return
    }
    var updateUrl = 'https://' + app.globalData.domainName + '/core/Rent/UpdateDetail?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method: 'POST',
      data: detail,
      success:(res)=>{
        if (res.statusCode == 200){
          detail.isEdit = false
          rentOrder.details[id] = detail
          that.computeAmount(rentOrder)
          that.computeTotal()
          that.setData({rentOrder: rentOrder})
          that.getData()
        }
      }
    })
  },

  checkValid(detail){
    var msg = ''
    if (detail.rent_item_name == ''){
      msg = '请填写名称'
    }
    else if (detail.rent_item_class == ''){
      msg = '请选择分类'
    }
    if (msg != ''){
      wx.showToast({
        title: msg,
        duration: 1000,
        success: (res)=>{

        }
      })
      return false
    }
    else{
      return true
    }
  },

  change(e){
    var that = this
    var id = e.currentTarget.id
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    var detailId = detail.id


  },

  close(){
    var that = this
    var rentOrder = that.data.rentOrder
    var closeUrl = 'https://' + app.globalData.domainName + '/core/Rent/SetClose/' + rentOrder.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: closeUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){
          rentOrder = res.data
          that.setData({rentOrder: rentOrder})
        }
      }
    })
  },

  call(e){
    var cell = e.currentTarget.id
    wx.makePhoneCall({
      phoneNumber: cell,
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var id = options.id
    that.setData({id: id})
    app.loginPromiseNew.then(function(resolve){
      that.setData({isManager: app.globalData.userInfo.is_manager})
      var getClassUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetClassList'
      wx.request({
        url: getClassUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          var classList = []
          for(var i = 0; i < res.data.length; i++){
            classList.push(res.data[i])
          }
          that.setData({classList: classList})
          that.getData()
        }
      })
      

    })
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
    that.getData()
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
  getDepositAmount(){
    var that = this
    if (!that.data.rentOrder.order){
      return
    }
    var memberId = that.data.rentOrder.order.member.id
    if (memberId == undefined || isNaN(memberId)){
      return
    }
    var getDepositUrl = 'https://' + app.globalData.domainName + '/core/Deposit/GetMemberAvaliableAmount/' + memberId + '?depositType=&depositSubType=&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getDepositUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var deposit = parseFloat(res.data)
        var deopsitStr = util.showAmount(deposit)
        that.computeTotal()
        var depositPayEnabled = true
        if (that.data.totalRental + that.data.totalOvertimeCharge > deposit){
          depositPayEnabled = false
        }
        that.setData({depositAmount: deposit, depositAmountStr: deopsitStr, depositPayEnabled})
      }
    })
  },
  setPaywithDeposit(e){
    var that = this
    var payWithDeposit = (e.detail.value.length == 0)? false : true
    that.setData({payWithDeposit})
    that.computeTotal()
  },
  payWithDeposit(){
    var that = this
    var rentOrder = that.data.rentOrder
    if (isNaN(that.data.depositPayAmount)){
      wx.showToast({
        title: '请填写正确的储值支付金额',
        icon: 'error'
      })
      return
    }
    var depositPayAmount = parseFloat(that.data.depositPayAmount) - rentOrder.totalDepositPaidAmount 
    var payUrl = 'https://' + app.globalData.domainName + '/core/Deposit/RentOderPay/' + that.data.rentOrder.id + '?amount=' + depositPayAmount.toString() + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: payUrl,
      method: 'GET',
      success: (res)=>{
        that.getData()
        that.computeTotal()
      }
    })
  },
  payAdditional(){
    var that = this
    var id = that.data.id
    wx.navigateTo({
      url: 'pay_additional?id=' + id,
    })
  },
  reopen(){
    var that = this
    wx.showModal({
      title: '重新打开订单',
      content: '此操作会导致报表变化，而且会留下操作记录，是否继续？',
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          var url = 'https://' + app.globalData.domainName + '/core/Rent/SetFinish/' + that.data.rentOrder.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: url,
            method:'GET',
            success:(res)=>{
              if (res.statusCode != 200){
                return
              }
              that.getData()
            }
          })
        }
      }
    })
  },
  setFinish(){
    var that = this
    wx.showModal({
      title: '设置订单完成',
      content: '此操作不可逆，执行后该订单会显示在财务报表中，是否确认？',
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          //var finishDate = util.formatDate(new Date()) + ' ' + util.formatTimeStr(new Date())
          var finishDate = util.formatDateTime(new Date())
          var url = 'https://' + app.globalData.domainName + '/core/Rent/SetFinish/' + that.data.rentOrder.id + '?finishDate=' + finishDate + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: url,
            method:'GET',
            success:(res)=>{
              if (res.statusCode != 200){
                return
              }
              that.getData()
            }
          })
        }
      }
    })
  },
  getLog(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentOrderLogs/' + that.data.rentOrder.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res) => {
        if (res.statusCode != 200){
          return
        }
        var logs = res.data
        for(var i = 0; i < logs.length; i++){
          var log = logs[i]
          log.amountStr = '——'
          log.staffName = log.member? log.member.real_name : ''
          log.create_date = new Date(log.create_date)
          log.create_dateStr = util.formatDateTime(log.create_date)
          switch(log.memo){
            case '订单完成':
              log.color = 'white'
              log.back = '#0000FF'
              break
            case '订单重开':
              log.color = 'black'
              log.back = '#FFFF00'
              break
            default:
              log.color = 'black'
              log.back = 'white'
          }
        }
        var incomes = that.data.incomes
        for(var i = 0; i < incomes.length; i++){
          var income = incomes[i]
          var log = {}
          log.create_date = income.create_date
          log.amount = income.amount
          log.memo = '收款'
          log.create_date = new Date(log.create_date)
          log.create_dateStr = util.formatDateTime(log.create_date)
          log.amountStr = util.showAmount(log.amount)
          log.staffName = income.staffName
          log.color = '#FF0000'
          log.back = 'white'
          logs.push(log)
        }
        var addPays = that.data.rentOrder.additionalPayments
        for(var i = 0; i < addPays.length; i++){
          var addPay = addPays[i]
          if (addPay.is_paid != 1){
            continue
          }
          var log = {}
          log.create_date = new Date(addPay.create_date)
          log.amount = addPay.amount
          log.memo = addPay.reason
          log.create_dateStr = util.formatDateTime(log.create_date)
          log.amountStr = util.showAmount(log.amount)
          log.staffName = addPay.staffMember.real_name
          log.color = '#FF0000'
          log.back = 'white'
          logs.push(log)
        }
        var refunds = that.data.rentOrder.refunds
        for(var i = 0; i < refunds.length; i++){
          var refund = refunds[i]
          var log = {}
          log.create_date = refund.create_date
          log.amount = -1 * refund.amount
          log.memo = '退款'
          log.create_dateStr = util.formatDateTime(new Date(log.create_date))
          log.amountStr = util.showAmount(log.amount)
          log.staffName = refund.msa.member.real_name
          log.color = '#009000'
          log.back = 'white'
          logs.push(log)
        }
        logs.sort((a, b) => (new Date(a.create_dateStr) - new Date(b.create_dateStr)))
        //console.log('log', logs)
        that.setData({logs})
      }
      
    })
  },
  setDateTime(e){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var id = parseInt(idArr[2])
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    var value = e.detail.value
    console.log('set date time', e)
    var oriDate = undefined
    var oriTime = undefined
    var newDate = undefined
    var newTime = undefined
    var oriDateTime = undefined
    if (idArr[0] == 'pick'){
      oriDateTime = new Date(detail.pick_date)
    }
    if (idArr[0] == 'return'){
      oriDateTime = new Date(detail.return_date)
    }
    oriDate = util.formatDate(oriDateTime)
    oriTime = util.formatTimeStr(oriDateTime)
    if (idArr[1] == 'date'){
      newDate = value
      newTime = oriTime
    }
    if (idArr[1] = 'time'){
      newDate = oriDate
      newTime = value
    }
    var title = '修改' + ((idArr[0] == 'pick') ? ' 发放 ' : ' 归还 ') + '时间'
    var content = '从 ' + oriDate + ' ' + oriTime + ' 修改成 ' + newDate + ' ' + newTime
    wx.showModal({
      title: title,
      content: content,
      complete: (res) => {
        if (res.cancel) {
          
        }
        if (res.confirm) {
          console.log('now detail', detail)
          if (idArr[0] == 'pick'){
            detail.pick_date = newDate + 'T' + newTime
          }
          if(idArr[1] == 'return'){
            detail.return_date = newDate + 'T' + newTime
          }
          //that.setData({rentOrder})
          //that.save(e)
          var updateUrl = 'https://' + app.globalData.domainName + '/core/Rent/UpdateDetail?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: updateUrl,
            method: 'POST',
            data: detail,
            success:(res)=>{
              if (res.statusCode != 200){
                return
              }
          
              rentOrder.details[id] = detail
              that.computeAmount(rentOrder)
              that.computeTotal()
              that.setData({rentOrder: rentOrder})
              that.getData()
        
            }
          })
        }
      }
    })
  },
  setDepositPayAmount(e){
    var that = this
    var value = e.detail.value
    if (!isNaN(value)){
      var depositPayAmount = parseFloat(value)
      that.setData({depositPayAmount, depositPayAmountStr: util.showAmount(depositPayAmount),
        depositPayAmountMod: true})
      that.computeTotal()
    }
    
  }
})
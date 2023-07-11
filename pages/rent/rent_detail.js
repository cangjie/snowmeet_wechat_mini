// pages/rent/rent_detail.js
const app = getApp()
const util = require('../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {

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
          var dueEndTime = new Date(rentOrder.due_end_date)
          rentOrder.due_end_time_str = util.formatDate(dueEndTime) + ' ' + util.formatTimeStr(dueEndTime)
          if (rentOrder.order_id > 0){
            var payTime = rentOrder.order.pay_time == null ? 
              new Date(rentOrder.order.payments[0].create_date) 
              : new Date(rentOrder.order.pay_time) 
            var orderDate = new Date(rentOrder.create_date)
            rentOrder.paidTimeStr = util.formatDate(payTime) + ' ' + util.formatTimeStr(payTime)
            rentOrder.outTradeNo = rentOrder.order.payments[0].out_trade_no
            rentOrder.create_date_str = util.formatDate(orderDate) + ' ' + util.formatTimeStr(orderDate)
          }
          else{
            rentOrder.paidTimeStr = '-'
            rentOrder.outTradeNo = '-'
          }
          var totalRental = 0
          for(var i = 0; i < rentOrder.details.length; i++)
          {
            var detail = rentOrder.details[i]
            detail.suggestRental_str = util.showAmount(detail.suggestRental)
            if (detail.status == '未归还'){
              detail.real_rental = detail.suggestRental
              detail.real_rental_str = util.showAmount(detail.real_rental)
            }
            else{
              detail.real_rental_str = util.showAmount(detail.real_rental)
            }
            totalRental = totalRental + detail.real_rental
            detail.unit_rental_str = util.showAmount(detail.unit_rental)
            detail.deposit_str = util.showAmount(detail.deposit)
            detail.refund_str = util.showAmount(detail.deposit - detail.real_rental - detail.overtime_charge - detail.reparation)
            detail.imageArr = detail.images.split(',')
            detail.reparationStr = util.showAmount(detail.reparation)
            detail.showGallery = false
            detail.overtime_charge_str = util.showAmount(detail.overtime_charge)

            /*
            if (startDate.getHours() >= 16 && currentTime.getDate() == startDate.getDate()){
              detail.overTime = false
            }
            else if (currentTime.getHours()>=11){
              detail.overTime = true
            }
            else{
              detail.overTime = false
            }
            */
            rentOrder.details[i] = detail

          }
          var orderDate = new Date(rentOrder.create_date)
          rentOrder.create_date_date_str = util.formatDate(orderDate)
          rentOrder.create_date_time_str = util.formatTimeStr(orderDate)
          rentOrder = that.computeAmount(rentOrder)
          that.setData({rentOrder: rentOrder, 
            rentalReduce: rentOrder.rental_reduce, rentalReduceStr: util.showAmount(rentOrder.rental_reduce),
            rentalReduceTicket: rentOrder.rental_reduce_ticket, rentalReduceTicketStr: util.showAmount(rentOrder.rental_reduce_ticket)})
          that.computeTotal()
        }
      }
    })
  },
  computeTotal(){
    var that = this
    var rentOrder = that.data.rentOrder
    var totalRental = 0
    var totalReparation = 0
    var totalOvertimeCharge = 0
    for(var i = 0; i < rentOrder.details.length; i++){
      var rental = 0
      var detail = rentOrder.details[i]
      var filledRental = parseFloat(detail.filled_rental)
      if (isNaN(filledRental)){
        rental = parseFloat(detail.real_rental)
      }
      else {
        rental = filledRental
      }
      totalRental = totalRental + rental
      totalReparation = totalReparation + detail.reparation
      totalOvertimeCharge = totalOvertimeCharge + detail.overtime_charge
    }
    var refundAmount = that.data.rentOrder.deposit_final - totalRental + that.data.rentalReduce + that.data.rentalReduceTicket - totalReparation - totalOvertimeCharge
    that.setData({refundAmount: refundAmount, refundAmountStr: util.showAmount(refundAmount),
      totalRental: totalRental, totalRentalStr: util.showAmount(totalRental), totalReparationStr: util.showAmount(totalReparation), totalOvertimeCharge: totalOvertimeCharge, totalOvertimeChargeStr: util.showAmount(totalOvertimeCharge)})
  },
  computeAmount(rentOrder){
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
      refund = deposit - overtime_charge - reparation - real_rental
      
      details[i].refund_str = util.showAmount(refund)
      details[i].refund = refund
      
    }
    return rentOrder
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var id = options.id
    that.setData({id: id})
    app.loginPromiseNew.then(function (resolve){
      that.getData()
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

  }
})
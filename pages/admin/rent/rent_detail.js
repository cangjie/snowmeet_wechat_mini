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
    rentalReduceTicket: 0
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
          rentOrder.guarantee_credit_photos_arr = rentOrder.guarantee_credit_photos.split(',')
          
          rentOrder.deposit_real_str = util.showAmount(rentOrder.deposit_real)
          rentOrder.deposit_reduce_str = util.showAmount(rentOrder.deposit_reduce)
          rentOrder.deposit_final_str = util.showAmount(rentOrder.deposit_final)
          var dueEndTime = new Date(rentOrder.due_end_date)
          rentOrder.due_end_time_str = util.formatDate(dueEndTime) + ' ' + util.formatTimeStr(dueEndTime)
          if (rentOrder.order_id > 0){
            var payTime = new Date(rentOrder.order.payments[0].create_date)
            rentOrder.paidTimeStr = util.formatDate(payTime) + ' ' + util.formatTimeStr(payTime)
            rentOrder.outTradeNo = rentOrder.order.payments[0].out_trade_no
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
            detail.refund_str = util.showAmount(detail.deposit - detail.real_rental)
            detail.imageArr = detail.images.split(',')
            detail.reparationStr = util.showAmount(detail.reparation)
            detail.showGallery = false
            rentOrder.details[i] = detail

          }
          that.setData({rentOrder: rentOrder, 
            rentalReduce: rentOrder.rental_reduce, rentalReduceStr: util.showAmount(rentOrder.rental_reduce),
            rentalReduceTicket: rentOrder.rental_reduce_ticket, rentalReduceTicketStr: util.showAmount(rentOrder.rental_reduce_ticket)})
          that.computeTotal()
        }
      }
    })
  },
  setRental(e){
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
    
    detail.refund_str = util.showAmount(detail.deposit - value - detail.reparation)
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
    detail.refund_str = util.showAmount(detail.deposit - detail.filled_rental - value)
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
    }
    var refundAmount = that.data.rentOrder.deposit_final - totalRental + that.data.rentalReduce + that.data.rentalReduceTicket - totalReparation
    that.setData({refundAmount: refundAmount, refundAmountStr: util.showAmount(refundAmount),
      totalRental: totalRental, totalRentalStr: util.showAmount(totalRental), totalReparationStr: util.showAmount(totalReparation)})
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
    var setUrl = 'https://' + app.globalData.domainName + '/core/Rent/SetReturn/' + detail.id
      + '?rental=' + encodeURIComponent(realRental) 
      + '&returnDate=' + encodeURIComponent(nowDate) + '&reparation=' + encodeURIComponent(reparation)
      + '&memo=' + encodeURIComponent(detail.memo) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setUrl,
      method: 'GET',
      success:(res) => {
        if (res.statusCode == 200){
          that.getData()
        }
      }
    })
 
  },
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
  setOrderMemo(e){
    var that = this
    var rentOrder = that.data.rentOrder
    rentOrder.memo = e.detail.value
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
  refund(){
    var that = this
    var refundUrl = 'https://' + app.globalData.domainName + '/core/Rent/Refund/' + that.data.rentOrder.id 
    + '?amount=' + encodeURIComponent(that.data.refundAmount) + '&memo=' + encodeURIComponent(that.data.rentOrder.memo)
    + '&rentalReduce=' + encodeURIComponent(that.data.rentalReduce) 
    + '&rentalReduceTicket=' + encodeURIComponent(that.data.rentalReduceTicket)
    + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: refundUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode == 200){
          that.getData()
        }
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
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var id = options.id
    that.setData({id: id})
    app.loginPromiseNew.then(function(resolve){
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
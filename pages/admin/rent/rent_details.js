// pages/admin/rent/rent_details.js
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
    that.setData({id: options.id})
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
    app.loginPromiseNew.then(function(resovle){
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
  getData(){
    var that = this
    var id = that.data.id
    var getUrl = app.globalData.requestPrefix + 'Order/GetOrderByStaff/' + id + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, undefined).then(function(resolve){
      var order = resolve
      console.log('get order', order)
      
      var bizDate = new Date(order.biz_date)
      var packages = []
      var rentals = []
      order.bizDateStr = util.formatDate(bizDate)
      order.bizTimeStr = util.formatTimeStr(bizDate)
      
      var packageNum = 0
      for(var i = 0; i < order.rentals.length; i++){
        var rental = order.rentals[i]
        rental.totalRentalAmountStr = util.showAmount(rental.totalRentalAmount)
        rental.totalRepairationAmountStr = util.showAmount(rental.totalRepairationAmount)
        rental.totalOvertimeAmountStr = util.showAmount(rental.totalOvertimeAmount)
        rental.ticketDiscountAmountStr = util.showAmount(rental.ticketDiscountAmount)
        rental.othersDiscountAmountStr = util.showAmount(rental.othersDiscountAmount)
        rental.summary = rental.totalRentalAmount + rental.totalRepairationAmount + rental.totalOvertimeAmount 
          - rental.ticketDiscountAmount - rental.othersDiscountAmount
        rental.summaryStr = util.showAmount(rental.summary)
        if (rental.isPackage){
          packages.push(rental)
          packageNum++
        }
        else{
          rentals.push(rental)
        }
        rental.totalGuarantyAmountStr = util.showAmount(rental.totalGuarantyAmount)
        if (rental.start_date){
          var startDate = new Date(rental.start_date)
          rental.start_dateDateStr = util.formatDate(startDate)
          rental.start_dateTimeStr = util.formatTimeStr(startDate)
        }
        else{
          rental.start_dateDateStr = '——'
          rental.start_dateDateStr = '——'
        }
        if (rental.end_date){
          var endDate = new Date(rental.end_date)
          rental.end_dateDateStr = util.formatDate(endDate)
          rental.end_dateTimeStr = util.formatTimeStr(endDate)
        }

        for(var j = 0; j < rental.rentItems.length; j++){
          var rentItem = rental.rentItems[j]
          if (rentItem.pick_time){
            var pickDate = new Date(rentItem.pick_time)
            rentItem.pick_dateDateStr = util.formatDate(pickDate)
            rentItem.pick_dateTimeStr = util.formatTimeStr(pickDate)
          }
          else{
            rentItem.pick_dateDateStr = '——'
            rentItem.pick_dateTimeStr = '——'
          }
          if (rentItem.return_time){
            var retDate = new Date(rentItem.return_time)
            rentItem.return_dateDateStr = util.formatDate(retDate)
            rentItem.return_dateTimeStr = util.formatTimeStr(retDate)
          }
          rentItem.repairationAmount = rentItem.repairationCharge ? rentItem.repairationCharge.amount: 0
          rentItem.repairationAmountStr = util.showAmount(rentItem.repairationAmount)
        }
      }
      that.setData({order, packageNum, rentalNum: order.rentals.length, packages, rentals})
    }).catch(function (){

    })
  }
})
// pages/admin/rent/rent_report.js
const app = getApp()
const util = require('../../../utils/util.js')
const utile = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    startDate: util.formatDate(new Date('2023-01-01')),
    endDate: util.formatDate(new Date()),
    currentDate: util.formatDate(new Date()),

    unRefundDeposit: 0,
    unSettledRental: 0,
    sameDaySettledRental:0,
    currentTotalDeposit: 0,
    currentDayRefundPlacedBefore:0,
    currentBusinessRental: 0,
    currentBusinessRentalSettled:0,
    currentBusinessRentalUnSettled:0,
    settledBeforeRental: 0
  },

  changeDate(e){
    var that = this
    var value = e.detail.value
    that.setData({currentDate: value})
    that.getData()
  },

  getData(){
    var that = this
    that.setData({unRefundDeposit:0, unSettledRental: 0, sameDaySettledRental: 0, currentTotalDeposit: 0, currentDayRefundPlacedBefore: 0, currentBusinessRental: 0, currentBusinessRentalSettled: 0, currentBusinessRentalUnSettled: 0, settledBeforeRental: 0})
    var getUnSettledOrderBeforeUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetUnSettledOrderBefore?date=' + encodeURIComponent(that.data.currentDate) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    var getCurrentSameDaySettledUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetCurrentSameDaySettled?date=' + encodeURIComponent(that.data.currentDate) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    var getCurrentDayPlacedUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetCurrentDayPlaced?date=' + encodeURIComponent(that.data.currentDate) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    var getCurrentDaySettledPlacedBeforeUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetCurrentDaySettledPlacedBefore?date=' + encodeURIComponent(that.data.currentDate) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUnSettledOrderBeforeUrl,
      method: 'GET',
      success:(res)=>{
        console.log('unsettled before', res)

        var orders = res.data.orders
        var currentBusinessRental = that.data.currentBusinessRental
        var currentBusinessRentalSettled = that.data.currentBusinessRentalSettled
        var currentBusinessRentalUnSettled = that.data.currentBusinessRentalUnSettled
        for(var i = 0; orders != null && i < orders.length; i++){
          var rentalList = orders[i].rentalDetails
          for(var j = 0; rentalList != null && j < rentalList.length; j++){
            var rental = rentalList[j]
            var currentDate = new Date(that.data.currentDate.toString()+'T00:00:00')
            var rentalDate = new Date(rental.date)
            if (currentDate.getFullYear() == rentalDate.getFullYear()
              && currentDate.getMonth() == rentalDate.getMonth()
              && currentDate.getDate() == rentalDate.getDate()){
              var rentalAmount = parseFloat(rental.rental)
              if (!isNaN(rentalAmount)){
                currentBusinessRental = currentBusinessRental + rentalAmount
                if (rental.type != ''){
                  currentBusinessRentalSettled = currentBusinessRentalSettled + rentalAmount
                }
                else{
                  currentBusinessRentalUnSettled += rentalAmount
                }
              }
              
            }
          }
        }
        that.setData({unRefundDeposit: res.data.unRefundDeposit, unRefundDepositStr: util.showAmount(res.data.unRefundDeposit), unSettledReantal: res.data.unSettledRental, unSettledRentalStr: util.showAmount(res.data.unSettledRental), currentBusinessRental: currentBusinessRental,
          currentBusinessRentalStr: util.showAmount(currentBusinessRental), currentBusinessRentalSettled: currentBusinessRentalSettled, currentBusinessRentalSettledStr: util.showAmount(currentBusinessRentalSettled), currentBusinessRentalUnSettled: currentBusinessRentalUnSettled, currentBusinessRentalUnSettledStr: util.showAmount(currentBusinessRentalUnSettled)})
        wx.request({
          url: getCurrentDayPlacedUrl,
          method: 'GET',
          success:(res)=>{
            console.log('today placed', res)
            var orders = res.data.orders
            var currentBusinessRental = that.data.currentBusinessRental
            var currentBusinessRentalSettled = that.data.currentBusinessRentalSettled
            var currentBusinessRentalUnSettled = that.data.currentBusinessRentalUnSettled
            for(var i = 0; orders != null && i < orders.length; i++){
              var rentalList = orders[i].rentalDetails
              for(var j = 0; rentalList != null && j < rentalList.length; j++){
                var rental = rentalList[j]
                var currentDate = new Date(that.data.currentDate.toString()+'T00:00:00')
                var rentalDate = new Date(rental.date)
                if (currentDate.getFullYear() == rentalDate.getFullYear()
                  && currentDate.getMonth() == rentalDate.getMonth()
                  && currentDate.getDate() == rentalDate.getDate()){
                  var rentalAmount = parseFloat(rental.rental)
                  
                  if (!isNaN(rentalAmount)){
                    currentBusinessRental = currentBusinessRental + rentalAmount
                    if (rental.type != ''){
                      currentBusinessRentalSettled = currentBusinessRentalSettled + rentalAmount
                    }
                    else {
                      currentBusinessRentalUnSettled += rentalAmount
                    }
                  }
                  
                }
              }
            }




            that.setData({currentTotalDeposit: res.data.totalDeposit, currentTotalDepositStr: util.showAmount(res.data.totalDeposit), currentBusinessRental: currentBusinessRental, currentBusinessRentalStr: util.showAmount(currentBusinessRental), currentBusinessRentalSettled: currentBusinessRentalSettled, currentBusinessRentalSettledStr: util.showAmount(currentBusinessRentalSettled), currentBusinessRentalSettled: currentBusinessRentalSettled, currentBusinessRentalSettledStr: util.showAmount(currentBusinessRentalSettled), currentBusinessRentalUnSettled: currentBusinessRentalUnSettled, currentBusinessRentalUnSettledStr: util.showAmount(currentBusinessRentalUnSettled)})
            wx.request({
              url: getCurrentSameDaySettledUrl,
              method:'GET',
              success:(res)=>{
                console.log('today settled', res)
                that.setData({sameDaySettledRental: res.data.totalRental, sameDaySettledRentalStr: util.showAmount(res.data.totalRental), sameDayRefundDeposit: res.data.totalDeposit, sameDayRefundDepositStr: util.showAmount(res.data.totalDeposit)})
                wx.request({
                  url: getCurrentDaySettledPlacedBeforeUrl,
                  method:'GET',
                  success:(res)=>{
                    console.log('today settled before', res)
                    var currentDateUnRefundDeposit = that.data.currentTotalDeposit - that.data.sameDayRefundDeposit

                    var settledBeforeRental = that.data.settledBeforeRental
                    var orders = res.data.orders

                    for(var i = 0; orders != null && i < orders.length; i++){
                      var details = orders[i].details
                      for(var j = 0; details != null && j < details.length; j++){
                        var detail = details[j]
                        var amount = parseFloat(details[j].real_rental)
                        if (!isNaN(amount)){
                          settledBeforeRental += amount
                        }
                      }
                    }


                    that.setData({currentDayRefundPlacedBefore: res.data.totalDeposit, 
                      currentDayRefundPlacedBeforeStr: util.showAmount(res.data.totalDeposit),
                      currentDateUnRefundDeposit: currentDateUnRefundDeposit, 
                      currentDateUnRefundDepositStr: util.showAmount(currentDateUnRefundDeposit), settledBeforeRental: settledBeforeRental,
                      settledBeforeRentalStr: util.showAmount(settledBeforeRental)})
                  }
                })
              }
            })
          }
        })
      }
    })

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
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
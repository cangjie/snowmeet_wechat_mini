// pages/admin/rent/rent_report.js
const app = getApp()
const util = require('../../../utils/util.js')
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
    settledBeforeRental: 0,
    scene: 0,
    shop: ''
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
    var getUnSettledOrderBeforeUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetUnSettledOrderBefore?date=' + encodeURIComponent(that.data.currentDate) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&shop=' + encodeURIComponent(that.data.shop)
    var getCurrentSameDaySettledUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetCurrentSameDaySettled?date=' + encodeURIComponent(that.data.currentDate) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&shop=' + encodeURIComponent(that.data.shop)
    var getCurrentDayPlacedUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetCurrentDayPlaced?date=' + encodeURIComponent(that.data.currentDate) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&shop=' + encodeURIComponent(that.data.shop)
    var getCurrentDaySettledPlacedBeforeUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetCurrentDaySettledPlacedBefore?date=' + encodeURIComponent(that.data.currentDate) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&shop=' + encodeURIComponent(that.data.shop)
    wx.request({
      url: getUnSettledOrderBeforeUrl,
      method: 'GET',
      success:(res)=>{
        console.log('unsettled before', res)

        var orders = res.data.orders

        var currentIncomeOrders = []

        var sameDaySettled = that.data.CurrentSameDaySettledSet

         

        var currentBusinessRental = that.data.currentBusinessRental
        var currentBusinessRentalSettled = that.data.currentBusinessRentalSettled
        var currentBusinessRentalUnSettled = that.data.currentBusinessRentalUnSettled
        
        for(var i = 0; orders != null && i < orders.length; i++){

          
          var createDate = new Date(orders[i].create_date)
          orders[i].create_date_str = util.formatDate(createDate)
          orders[i].create_time_str = util.formatTimeStr(createDate)
          orders[i].deposit_final_str = util.showAmount(orders[i].deposit_final)
          orders[i].currentStatus = '已结算'

          orders[i].currentDayRentalSettled = 0
          orders[i].currentDayRentalUnSettled = 0

          var orderRental = 0
          var rentalList = orders[i].rentalDetails
          var haveCurrentDayIncome = false
          for(var j = 0; rentalList != null && j < rentalList.length; j++){
            var rental = rentalList[j]
            var currentDate = new Date(that.data.currentDate.toString()+'T00:00:00')
            var rentalDate = new Date(rental.date)
            var rentalAmount = parseFloat(rental.rental)
            
            

            if (currentDate.getFullYear() == rentalDate.getFullYear()
              && currentDate.getMonth() == rentalDate.getMonth()
              && currentDate.getDate() == rentalDate.getDate()){
              
              if (!isNaN(rentalAmount)){
                haveCurrentDayIncome = true
                currentBusinessRental = currentBusinessRental + rentalAmount
                
                if (rental.type != ''){

                  currentBusinessRentalSettled = currentBusinessRentalSettled + rentalAmount
                  orders[i].currentDayRentalSettled += rentalAmount
                }
                else{
                  
                  currentBusinessRentalUnSettled += rentalAmount
                  orders[i].currentDayRentalUnSettled += rentalAmount
                }
              }
              
            }
            else if (currentDate.valueOf() >= rentalDate.valueOf()){
              orderRental += rentalAmount
            }
          }
          orders[i].orderRentalStr = util.showAmount(orderRental)
          orders[i].currentDayRentalSettledStr = util.showAmount(orders[i].currentDayRentalSettled)
          orders[i].currentDayRentalUnSettledStr = util.showAmount(orders[i].currentDayRentalUnSettled)
          if (haveCurrentDayIncome){
            currentIncomeOrders.push(orders[i])
          }
        }

        that.setData({unRefundDeposit: res.data.unRefundDeposit, unRefundDepositStr: util.showAmount(res.data.unRefundDeposit), unSettledReantal: res.data.unSettledRental, unSettledRentalStr: util.showAmount(res.data.unSettledRental), currentBusinessRental: currentBusinessRental,
          currentBusinessRentalStr: util.showAmount(currentBusinessRental), currentBusinessRentalSettled: currentBusinessRentalSettled, currentBusinessRentalSettledStr: util.showAmount(currentBusinessRentalSettled), currentBusinessRentalUnSettled: currentBusinessRentalUnSettled, currentBusinessRentalUnSettledStr: util.showAmount(currentBusinessRentalUnSettled), UnSettledOrderBeforeSet: orders, CurrentIncomdeOrderSet: currentIncomeOrders})
        wx.request({
          url: getCurrentDayPlacedUrl,
          method: 'GET',
          success:(res)=>{
            console.log('today placed', res)
            var orders = res.data.orders
            var currentBusinessRental = that.data.currentBusinessRental
            var currentBusinessRentalSettled = that.data.currentBusinessRentalSettled
            var currentBusinessRentalUnSettled = that.data.currentBusinessRentalUnSettled
            var currentIncomeOrders = that.data.CurrentIncomdeOrderSet
            for(var i = 0; orders != null && i < orders.length; i++){
              var rentalList = orders[i].rentalDetails
              orders[i].currentStatus = '已结算'
              var createDate = new Date(orders[i].create_date)
              orders[i].create_date_str = util.formatDate(createDate)
              orders[i].create_time_str = util.formatTimeStr(createDate)
              orders[i].deposit_final_str = util.showAmount(orders[i].deposit_final)
              orders[i].currentDayRentalSettled = 0
              orders[i].currentDayRentalUnSettled = 0
              var orderDisplayedRental = 0
              var haveCurrentIncome = false
              
              for(var j = 0; rentalList != null && j < rentalList.length; j++){
                var rental = rentalList[j]
                var currentDate = new Date(that.data.currentDate.toString()+'T00:00:00')
                var rentalDate = new Date(rental.date)
                if (currentDate.getFullYear() == rentalDate.getFullYear()
                  && currentDate.getMonth() == rentalDate.getMonth()
                  && currentDate.getDate() == rentalDate.getDate()){

                  haveCurrentIncome = true
                  var rentalAmount = parseFloat(rental.rental)
                  
                  if (!isNaN(rentalAmount)){
                    currentBusinessRental = currentBusinessRental + rentalAmount
                    orderDisplayedRental = rentalAmount
                    if (rental.type != ''){
                      currentBusinessRentalSettled = currentBusinessRentalSettled + rentalAmount
                      orders[i].currentDayRentalSettled += rentalAmount
                    }
                    else {
                      currentBusinessRentalUnSettled += rentalAmount
                      orders[i].currentDayRentalUnSettled += rentalAmount
                    }
                  }
                  
                }
              }

              
              orders[i].currentDayRentalSettledStr = util.showAmount(orders[i].currentDayRentalSettled)
              orders[i].currentDayRentalUnSettledStr = util.showAmount(orders[i].currentDayRentalUnSettled)
              orders[i].orderRentalStr = util.showAmount(orderDisplayedRental)
              if (haveCurrentIncome){
                currentIncomeOrders.push(orders[i])

              }
            }




            that.setData({currentTotalDeposit: res.data.totalDeposit, currentTotalDepositStr: util.showAmount(res.data.totalDeposit), currentBusinessRental: currentBusinessRental, currentBusinessRentalStr: util.showAmount(currentBusinessRental), currentBusinessRentalSettled: currentBusinessRentalSettled, currentBusinessRentalSettledStr: util.showAmount(currentBusinessRentalSettled), currentBusinessRentalSettled: currentBusinessRentalSettled, currentBusinessRentalSettledStr: util.showAmount(currentBusinessRentalSettled), currentBusinessRentalUnSettled: currentBusinessRentalUnSettled, currentBusinessRentalUnSettledStr: util.showAmount(currentBusinessRentalUnSettled), CurrentDayPlacedSet: orders, CurrentIncomdeOrderSet: currentIncomeOrders})
            wx.request({
              url: getCurrentSameDaySettledUrl,
              method:'GET',
              success:(res)=>{
                console.log('today settled', res)


                var orders = res.data.orders

                var currentDatePlacedOrders = that.data.CurrentDayPlacedSet


                for(var i = 0; i < orders.length; i++){
                  var createDate = new Date(orders[i].create_date)
                  orders[i].create_date_str = util.formatDate(createDate)
                  orders[i].create_time_str = util.formatTimeStr(createDate)
                  orders[i].deposit_final_str = util.showAmount(orders[i].deposit_final)

                  var details = orders[i].rentalDetails
                  var rental = 0;
                  for(var j = 0; details != null && j < details.length; j++){
                    var amount = parseFloat(details[j].rental)
                    if (!isNaN(amount)){
                      rental += amount
                    }
                  }
                  orders[i].orderRentalStr = util.showAmount(rental)

                  for(var j = 0; j < currentDatePlacedOrders.length; j++){
                    
                    if (orders[i].id == currentDatePlacedOrders[j].id){
                      currentDatePlacedOrders[j].currentStatus = '已结算'
                      break
                    }
                  }

                }


                that.setData({sameDaySettledRental: res.data.totalRental, sameDaySettledRentalStr: util.showAmount(res.data.totalRental), sameDayRefundDeposit: res.data.totalDeposit, sameDayRefundDepositStr: util.showAmount(res.data.totalDeposit), CurrentSameDaySettledSet: orders, CurrentDayPlacedSet: currentDatePlacedOrders})
                wx.request({
                  url: getCurrentDaySettledPlacedBeforeUrl,
                  method:'GET',
                  success:(res)=>{
                    console.log('today settled before', res)
                    var currentDateUnRefundDeposit = that.data.currentTotalDeposit - that.data.sameDayRefundDeposit

                    var settledBeforeRental = that.data.settledBeforeRental
                    var orders = res.data.orders
                    


                    for(var i = 0; orders != null && i < orders.length; i++){


                      var orderRental = 0
                      var createDate = new Date(orders[i].create_date)
                      orders[i].create_date_str = util.formatDate(createDate)
                      orders[i].create_time_str = util.formatTimeStr(createDate)
                      orders[i].deposit_final_str = util.showAmount(orders[i].deposit_final)


                 
                      var details = orders[i].rentalDetails
                      for(var j = 0; details != null && j < details.length; j++){
                        var amount = parseFloat(details[j].rental)
                        if (!isNaN(amount)){
                          settledBeforeRental += amount
                          orderRental += amount
                        }
                      }
                      orders[i].orderRentalStr = util.showAmount(orderRental)

                      



                    }


                    that.setData({currentDayRefundPlacedBefore: res.data.totalDeposit, 
                      currentDayRefundPlacedBeforeStr: util.showAmount(res.data.totalDeposit),
                      currentDateUnRefundDeposit: currentDateUnRefundDeposit, 
                      currentDateUnRefundDepositStr: util.showAmount(currentDateUnRefundDeposit), settledBeforeRental: settledBeforeRental,
                      settledBeforeRentalStr: util.showAmount(settledBeforeRental), CurrentDaySettledPlacedBeforeSet: orders})
                  }
                })
              }
            })
          }
        })
      }
    })

  },

  goBack(){
    var that = this
    that.setData({scene: 0})
  },
  showDetail(e){
    var id = e.currentTarget.id
    var that = this
    that.setData({scene: parseInt(id)})
  },
  gotoDetail(e){
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'rent_detail?id=' + id,
    })
  },
  shopSelected(e){
    var that = this
    that.setData({shop: e.detail.shop})
    //that.getData()
  },

  query(){
    var that = this
    that.setData({currentDayRefundPlacedBefore: 0, 
        currentDayRefundPlacedBeforeStr: "￥0.00",
        currentDateUnRefundDeposit: 0, 
        currentDateUnRefundDepositStr:  "￥0.00", 
        settledBeforeRental: 0,
        settledBeforeRentalStr:  "￥0.00", 
        CurrentDaySettledPlacedBeforeSet: []})
    that.getData()
  },


  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      //that.getData()
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
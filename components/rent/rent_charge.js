const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
Component({
  properties: {
    rentItem: Object,
    shop: Object,
    scene: {
      type: String,
      value: '会员'
    }
  },
  data: {
    activeNames: ['1', '2', '3']
  },
  lifetimes: {
    ready() {
      var that = this
      var rental = that.properties.rentItem
      data.getEnumListPromise('RentType').then(function (rentTypeList) {
        that.setData({ rentTypeList })
      })
      that.setData({ rental, shopObj: that.properties.shop })
      that.computeEndDate()
      console.log('get price list', rental.priceList)
      that.setData({ priceList: rental.priceList })
      //var price = that.getPrice(rental.startDateIsWeekend ? '周末' : '平日', that.data.rentType[0], that.properties.scene)
      //price.priceStr = util.showAmount(price.price)
      //util.getPrice()
      //that.setData({rental}) 
      //console.log('item', that.properties.rentItem)
      that.computeRental(rental)
    }
  },
  methods: {
    switchSeg(e) {
      var that = this
      var segIndex = e.detail.index
      that.setData({ segIndex })
    },
    onChange(event) {
      this.setData({
        activeNames: event.detail,
      });
    },
    setGuarantyDiscount(e) {
      var that = this
      var value = e.detail.value
      var rental = that.data.rental
      if (!isNaN(value)) {
        var discount = parseFloat(value)
        var deposit = rental.deposit
        rental.depositDiscount = discount
        rental.depositDiscountStr = util.showAmount(discount)
        rental.realDeposit = deposit - discount
        rental.realDepositStr = util.showAmount(rental.realDeposit)
        that.setData({ rental })
        that.triggerEvent('RentalChange', rental)
      }
    },
    computeEndDate() {
      var that = this
      var rental = that.data.rental
      var endDate = new Date(rental.startDate)
      var expectDays = parseInt(rental.expectDays) - 1
      endDate.setDate(endDate.getDate() + expectDays)
      rental.endDate = util.formatDate(endDate)
      that.setData({ rental })
    },
    /*
    computeRentalTable(startDate, endDate) {
      var that = this
      var rentalDetails = []
      var totalRentalAmount = 0
      for (var i = startDate; i <= endDate; i.setDate(i.getDate() + 1)) {
        var isWeekend = util.isWeekend(new Date(i))
        var price = that.getPrice(isWeekend ? '周末' : '平日', '多日', that.properties.scene)
        var detail = {
          date: util.formatDate(i),
          isWeekend: isWeekend ? '周末' : '平日',
          price: price.price,
          priceStr: util.showAmount(price.price),
          discount: 0,
          summary: price.price,
          summaryStr: util.showAmount(price.price)
        }
        totalRentalAmount += price.price
        rentalDetails.push(detail)
      }
      that.setData({ rentalDetails, totalRentalAmount, totalRentalAmountStr: util.showAmount(totalRentalAmount) })
    },
    */
    setExpectDays(e) {
      if (isNaN(e.detail.value)) {
        return
      }
      var that = this
      var days = parseInt(e.detail.value)
      var rental = that.data.rental
      rental.expectDays = days
      that.computeEndDate()
      util.createRentalDetal(rental, new Date(rental.startDate), new Date(rental.endDate))
      console.log('new rental', rental)
      that.computeRental(rental)
      /*
      for(var i = 0; i < rental.details.length; i++){
        rental.details[i].date = util.formatDate(rental.details[i].date)
      }
      */
      //that.setData({rental})
      
/*

      that.triggerEvent('RentalChange', rental)
      if (days > 1) {
        that.computeRentalTable(new Date(rental.startDate), new Date(rental.endDate))
      }
      */
    },
    /*
    setFixedRental(e) {
      if (isNaN(e.detail.value)) {
        return
      }
      var amount = parseFloat(e.detail.value)
      var that = this
      var rental = that.data.rental
      //rental.fixedRental = amount
      that.computeRental(rental)
      //that.setData({ rental })
      //that.triggerEvent('RentalChange', rental)
    },
    */
    /*
    getPrice(dayType, rentType, scene) {
      var that = this
      var priceList = that.data.priceList
      for (var i = 0; i < priceList.length; i++) {
        var price = priceList[i]
        if (price.day_type == dayType && price.scene == scene && rentType == price.rent_type) {
          return price
        }
      }
      return null
    },
    */
    setRentType(e){
      var that = this
      var rentType = that.data.rentTypeList[e.detail.value]
      var rental = that.data.rental
      var detail = rental.details[0]
      var price = util.getRentPrice(rental.priceList, new Date(detail.date), rentType)
      detail.rentType = price.rent_type
      detail.price = price.price
      detail.priceStr = util.showAmount(detail.price)
      rental.totalAmount = detail.price
      rental.totalAmountStr = util.showAmount(rental.totalAmount)
      //that.setData({rental})
      that.computeRental(rental)
    },
    setRentalDiscount(e){
      if (isNaN(e.detail.value)){
        return
      }
      var that = this
      var discount = parseFloat(e.detail.value)
      var id = parseInt(e.currentTarget.id)
      var rental = that.data.rental
      var detail = rental.details[id]
      detail.discount = discount
      that.computeRental(rental)
    },
    computeRental(){
      var that = this
      var rental = that.data.rental
      var totalAmount = 0
      var totalDiscount = 0
      var totalSummary = 0
      for(var i = 0; i < rental.details.length; i++){
        var detail = rental.details[i]
        detail.summary = detail.price - detail.discount
        detail.summaryStr = util.showAmount(detail.summary)
        totalAmount += detail.price
        totalDiscount += detail.discount
        totalSummary += (detail.price - detail.discount)
      }
      rental.totalAmount = totalAmount
      rental.totalDiscount = totalDiscount
      rental.totalSummary = totalSummary
      rental.totalAmountStr = util.showAmount(rental.totalAmount)
      rental.totalDiscountStr = util.showAmount(rental.totalDiscount)
      rental.totalSummaryStr = util.showAmount(rental.totalSummary)
      that.setData({rental})
      that.triggerEvent('RentalUpdated', rental)
    },
    setEntrain(e){
      var that = this
      var rental = that.data.rental
      if (e.detail.value.length == 0){
        rental.entrain = false
      }
      else{
        rental.entrain = true
      }
      that.computeRental()
    }
  }
})
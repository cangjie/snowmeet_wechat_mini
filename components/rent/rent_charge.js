const util = require('../../utils/util.js')
Component({
  properties: {
    rentItem: Object
  },
  data: {
    activeNames: ['1', '2', '3']
  },
  lifetimes:{
    ready(){
      var that = this
      var rental = that.properties.rentItem
      
      that.setData({rental})
      that.computeEndDate()
      console.log('item', that.properties.rentItem)
    }
  },
  methods: { 
    switchSeg(e){
      var that = this
      var segIndex = e.detail.index
      that.setData({segIndex})
    },
    onChange(event) {
      this.setData({
        activeNames: event.detail,
      });
    },
    setGuarantyDiscount(e){
      var that = this
      var value = e.detail.value
      var rental = that.data.rental
      if (!isNaN(value)){
        var discount = parseFloat(value)
        var deposit = rental.deposit
        rental.depositDiscount = discount
        rental.depositDiscountStr = util.showAmount(discount)
        rental.realDeposit = deposit - discount
        rental.realDepositStr = util.showAmount(rental.realDeposit)
        that.setData({rental})
        that.triggerEvent('RentalChange', rental)
      }
    },
    computeEndDate(){
      var that = this
      var rental = that.data.rental
      var endDate = new Date(rental.startDate)
      var expectDays = parseInt(rental.expectDays) - 1
      endDate.setDate(endDate.getDate() + expectDays)
      rental.endDate = util.formatDate(endDate)
      that.setData({rental})
    },
    setExpectDays(e){
      if (isNaN(e.detail.value)){
        return
      }
      var that = this
      var days = parseInt(e.detail.value)
      var rental = that.data.rental
      rental.expectDays = days
      that.computeEndDate() 
      that.triggerEvent('RentalChange', rental)
    },
    setFixedRental(e){
      if (isNaN(e.detail.value)){
        return
      }
      var amount = parseFloat(e.detail.value)
      var that = this
      var rental = that.data.rental
      rental.fixedRental = amount
      that.setData({rental})
      that.triggerEvent('RentalChange', rental)
    }

  },
})
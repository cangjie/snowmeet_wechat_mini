// components/rent/confirm_rental.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
Component({

  /**
   * Component properties
   */
  properties: {
    rentalId: Number
  },

  /**
   * Component initial data
   */
  data: {

  },
  lifetimes:{
    ready(){
      var that = this
      if (!that.properties.rentalId || that.properties.rentalId == 0){
        return
      }
      that.setData({rentalId: that.properties.rentalId})
      that.getData()
    }
  },

  /**
   * Component methods
   */
  methods: {
    getData(){
      var that = this
      data.getRentalPromise(that.data.rentalId, app.globalData.sessionKey)
        .then(function (rental){
          that.renderRental(rental)
          that.setData({rental})
        })
    },
    renderRental(rental){
      var that = this
      var totalRentalAmount = 0
      for(var i = 0; i < rental.details.length; i++){
        var detail = rental.details[i]
        detail.amountStr = util.showAmount(detail.amount)
        if (detail.rentPrice){
          var price = detail.rentPrice
          detail.rent_type = price.rent_type
          detail.day_type = price.day_type
          detail.scene = price.scene
        }
        else {
          detail.rent_type = '--'
          detail.day_type = '--'
          detail.scene = '--'
        }
        if (detail.discount){
          detail.discount = detail.discount.amount
        }
        else {
          detail.discount = 0
        }
        detail.discountStr = util.showAmount(detail.discount)
        detail.dateStr = util.formatDate(new Date(detail.rental_date))
        detail.summary = detail.amount - detail.discountTotalAmount
        totalRentalAmount += detail.summary
        detail.summaryStr = util.showAmount(detail.summary)
      }
      that.setData({totalRentalAmount, totalRentalAmountStr: util.showAmount(totalRentalAmount)})
    },
    setValid(e){
      var that = this
      var rental = that.data.rental
      var id = e.currentTarget.id
      var detailIndex = util.getRentalDetailIndexFromRental(id, rental)
      var detail = rental.details[detailIndex]
      detail.valid = e.detail.value.length==1?0:1
      detail.modified = true
    },
    setDiscount(e){
      var that = this
      var value = e.detail.value
      if (isNaN(value)){
        return
      }
      var rental = that.data.rental
      var id = e.currentTarget.id
      var detailIndex = util.getRentalDetailIndexFromRental(id, rental)
      var detail = rental.details[detailIndex]
      detail.discountTotalAmount = e.detail.value
      detail.modified = true
      if (util.canRenderNumber(value)){
        that.renderRental(rental)
        that.setData({rental})
      }
    },
    cancel(){
      var that = this
      that.triggerEvent('CloseBackdrop', {})
    },
    save(){
      var that = this
      var rental = that.data.rental
      var details = []
      for(var i = 0; rental && rental.details && i < rental.details.length; i++){
        if (rental.details[i].modified){
          details.push(rental.details[i])
          rental.details[i].modified = false
        }
      }
      if (details.length == 0){
        that.cancel()
      }
      data.updateRentalDetailsPromise(details, '租赁结算修改价格', app.globalData.sessionKey).then(function (details){
        if (details && details.length > 0){
          data.getRentalPromise(details[0].rental_id, app.globalData.sessionKey).then(function (rental){
            that.triggerEvent('CloseBackdrop', {rental: rental})
            that.cancel()
          })
        }
      })
    }
  }
})
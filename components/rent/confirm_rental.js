// components/rent/confirm_rental.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
const { deleteRentPackagePromise } = require('../../utils/data.js')
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
    rentalMod: false
  },
  lifetimes:{
    ready(){
      var that = this
      if (!that.properties.rentalId || that.properties.rentalId == 0){
        return
      }
      data.getRentTypePromise().then(function (typeList){
        that.setData({rentType: typeList})
      })
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
        detail.summaryStr = util.showAmount(detail.summary)

        if (detail.valid == 1){
          if ((rental.experience == true && detail.charge_type != '租金' )
          || rental.experience != true ){
            totalRentalAmount += detail.summary  
          }
        }
      }
      if (rental._filledOverTimeCharge != null && !isNaN(rental._filledOverTimeCharge)){
        totalRentalAmount += rental._filledOverTimeCharge
      }
      //totalRentalAmount += rental.totalOvertimeAmount
      that.setData({totalRentalAmount: totalRentalAmount, 
        totalRentalAmountStr: util.showAmount(totalRentalAmount)})
    },
    setValid(e){
      var that = this
      var rental = that.data.rental
      var id = e.currentTarget.id
      var detailIndex = util.getRentalDetailIndexFromRental(id, rental)
      var detail = rental.details[detailIndex]
      detail.valid = e.detail.value.length==1?0:1
      detail.modified = true
      that.renderRental(rental)
      that.setData(rental)
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

      if (details.length > 0 && that.data.rentalMod)
      {
        data.updateRentalDetailsPromise(details, '租赁结算修改价格', app.globalData.sessionKey).then(function (details){
          data.updateRentalPromise(rental, '租赁结算修改订单试滑超时费', app.globalData.sessionKey).then(function (newRental){
            that.triggerEvent('CloseBackdrop', {rental: newRental})
            that.cancel()
          })
        })
      }
      else if (details.length > 0){
        data.updateRentalDetailsPromise(details, '租赁结算修改价格', app.globalData.sessionKey).then(function (details){
          if (details && details.length > 0){
            data.getRentalPromise(details[0].rental_id, app.globalData.sessionKey).then(function (rental){
              that.triggerEvent('CloseBackdrop', {rental: rental})
              that.cancel()
            })
          }
        })
      }
      else if (that.data.rentalMod){
        data.updateRentalPromise(rental, '租赁结算修改订单试滑超时费', app.globalData.sessionKey).then(function (newRental){
          that.triggerEvent('CloseBackdrop', {rental: newRental})
          that.cancel()
        })
      }
      else {
        that.cancel()
      }
    },
    setExperience(e){
      var that = this
      var rental = that.data.rental
      rental.experience = e.detail.value.length == 1? true: false
      that.data.rentalMod = true
      that.renderRental(rental)
      that.setData({rental})
    },
    setOverTime(e){
      var that = this
      var value = e.detail.value
      
      if (isNaN(value)){
        return
      }
      var rental = that.data.rental
      if (util.canRenderNumber(value)){
        that.data.rentalMod = true
        rental.totalOvertimeAmount = parseFloat(value)
        rental._filledOverTimeCharge = parseFloat(value)
        that.renderRental(rental)
        that.setData({rental})
      }
    },
    setRentType(e){
      var that = this
      var rental = that.data.rental
      var id = parseInt(e.currentTarget.id)
      var detail = rental.details[id]
      var index = e.detail.value
      var rentType = that.data.rentType[index]
      detail.rent_type = rentType
      data.getRentPriceByIdPromise(detail.rent_price_id).then(function (currentPrice){
        console.log('get price', currentPrice)
        var type = rental.package_id == null ? '分类' : '套餐'
        var id = null
        if (type=='分类'){
          id = rental.category_id
        }
        else{
          id = rental.package_id
        }
        data.getRentPriceListPromise(currentPrice.shop_id, type, id, currentPrice.scene).then(function (priceList){
          var newPrice = null
          for(var i = 0; priceList && i < priceList.length; i++){
            if (priceList[i].rent_type == detail.rent_type && priceList[i].scene == currentPrice.scene 
              && priceList[i].day_type == currentPrice.day_type){
              newPrice = priceList[i]
              detail.rent_price_id = newPrice.id
              detail.amount = newPrice.price
              detail.rentPrice = newPrice
              detail.modified = true
              that.renderRental(rental)
              that.setData({rental})
            }
          }
        })
      })
    }
  }
})
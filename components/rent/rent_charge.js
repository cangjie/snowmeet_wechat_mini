const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
Component({
  properties: {
    rentItem: Object,
    shop: String,
    scene: {
      type: String,
      value: '会员'
    }
  },
  data: {
    activeNames: ['1', '2', '3']
  },
  lifetimes:{
    ready(){
      var that = this
      var rental = that.properties.rentItem
      data.getEnumListPromise('RentType').then(function (rentType){
        that.setData({rentType})
      })
      that.setData({rental})
      that.computeEndDate()
      data.getShopByNamePromise(that.properties.shop).then(function (shopObj){
        that.setData({shopObj})
        var type = rental.package_id? '套餐': '分类'
        var id = type == '套餐' ? rental.package_id : rental.category.id
        data.getRentPriceListPromise(shopObj.id, type, id, that.properties.scene).then(function (priceList){
          console.log('get price list', priceList)
          that.setData({priceList})
          var price = that.getPrice(rental.startDateIsWeekend? '周末': '平日', that.data.rentType[0], that.properties.scene)
          price.priceStr = util.showAmount(price.price)
          that.setData({price})
        })
      }).catch(function (exp){})
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
    computeRentalTable(startDate, endDate){
      var that = this
      for(var i = startDate; i <= endDate; i.setDate(i.getDate() + 1)){

      }
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
    },
    getPrice(dayType, rentType, scene){
      var that = this
      var priceList = that.data.priceList
      for(var i = 0; i < priceList.length; i++){
        var price = priceList[i]
        if (price.day_type == dayType && price.scene == scene && rentType == price.rent_type){
          return price
        }
      }
      return null
    }
  }
})
// components/rent/cart_list_pay.js
const util = require('../../utils/util.js')
Component({

  /**
   * Component properties
   */
  properties: {
    rentals: Array
  },

  /**
   * Component initial data
   */
  data: {

  },
  lifetimes:{
    ready(){
      var that = this
      console.log('get rentals ready', that.properties.rentals)
      that.renderRentals()
    }
  },
  pageLifetimes:{
    show(){
      var that = this
      console.log('get rentals show', that.properties.rentals)
    }
  },
  /**
   * Component methods
   */
  methods: {
    renderRentals(){
      var that = this
      var rentals = that.properties.rentals
      var totalGuarantyAmount = 0
      for(var i = 0; i < rentals.length; i++){
        var rental = rentals[i]
        totalGuarantyAmount += rental.realDeposit
      }
      that.setData({totalGuarantyAmount, totalGuarantyAmountStr: util.showAmount(totalGuarantyAmount)})
    }
  }
})
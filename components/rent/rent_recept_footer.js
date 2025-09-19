// components/rent/rent_recept_footer.js
const util = require('../../utils/util.js')
Component({

  /**
   * Component properties
   */
  properties: {
    rentals: Object
  },

  /**
   * Component initial data
   */
  data: {
    wellForm: false

  },
  lifetimes: {
    ready() {
      var that = this
      that.renderData()
    }
  },

  /**
   * Component methods
   */
  methods: {
    renderData() {
      var that = this
      var rentals = that.properties.rentals
      var totalGuarantyAmount = 0
      var totalGuarantyDiscountAmount = 0
      for (var i = 0; rentals && i < rentals.length; i++) {
        if (rentals[i].noGuaranty == true) {

        }
        else {
          totalGuarantyAmount += rentals[i].deposit
          if (!isNaN(rentals[i].depositDiscount)) {
            totalGuarantyDiscountAmount += rentals[i].depositDiscount
          }
        }
      }
      that.setData({
        totalGuarantyAmount, totalGuarantyDiscountAmount, totalGuarantyRealAmount: totalGuarantyAmount - totalGuarantyDiscountAmount,
        totalGuarantyAmountStr: util.showAmount(totalGuarantyAmount), totalGuarantyDiscountAmountStr: util.showAmount(totalGuarantyDiscountAmount),
        totalGuarantyRealAmountStr: util.showAmount(totalGuarantyAmount - totalGuarantyDiscountAmount)
      })
      that.triggerEvent('WellFormed', util.checkRentalsWellForm(rentals))
    }
  }
})
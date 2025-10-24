// components/rent/rent_backdrop.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
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
  lifetimes: {
    ready() {
      var that = this
      var rentals = that.properties.rentals
      var wellFormed = util.checkRentalsWellForm(rentals)
      that.setData({ wellFormed, rentals })
      that.renderRentals()

    }
  },

  /**
   * Component methods
   */
  methods: {
    renderRentals() {
      var that = this
      var rentals = that.data.rentals
      var totalGuaranty = 0;
      for (var i = 0; i < rentals.length; i++) {
        var rental = rentals[i]
        rental.type = (rental.package_id && rental.package_id > 0) ? '套餐' : '单品'
        var guaranty = rental.guaranty - rental.guaranty_discount
        if (rental.noGuaranty == 1) {
          guaranty = 0
        }
        totalGuaranty += guaranty
        rental.guarantyStr = util.showAmount(guaranty)
        that.setData({ rentals,totalGuaranty, totalGuarantyStr: util.showAmount(totalGuaranty) })
        if (rental.package_id && rental.package_id > 0) {
          data.getPackagePromise(rental.package_id).then(function (rentPackage) {
            rental.name = rentPackage.name
          })
        }
        else {
          data.getRentCategoryPromise(rental.category_id).then(function(rentCategory){
            rental.name = rentCategory.name
          })
        }

      }

    }
  }
})
// components/rent/rent_recept.js
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
const app = getApp()
Component({

  /**
   * Component properties
   */
  properties: {
    showPopUp: false,
    popUpContent: ''
  },

  /**
   * Component initial data
   */
  data: {
    rentals: []
  },

  lifetimes:{
    ready(){
      app.loginPromiseNew.then(function(resolve){

      })
    }
  },

  /**
   * Component methods
   */
  methods: {
    addNewPackage(){
      var that = this
      that.setData({showPopUp: true, popUpContent: 'packageSelector'})
    },
    cancelPopUp(){
      var that = this
      that.setData({showPopUp: false, popUpContent: 'packageSelector'})
    },
    selectPackageConfirm(e){
      var that = this
      that.cancelPopUp()
      console.log('select package', e)
      var selectedPackage = e.detail
      var rental = {
        id: 0,
        order_id: null,
        package_id: selectedPackage.id,
        name: selectedPackage.name,
        valid: 0,
        realDeposit: selectedPackage.deposit,
        realDepositStr: util.showAmount(selectedPackage.deposit)
      }
      var items = []
      for (var i = 0; i < selectedPackage.categories.length; i++) {
        var item = {
          id: 0,
          rental_id: 0,
          noCode: false,
          categoryName: selectedPackage.categories[i].name,
          name: null,
          code: null,
          rent_product_id: null,
          category_id: selectedPackage.categories[i].id
        }
        items.push(item)
      }
      rental.rentItems = items
      var rentals = that.data.rentals
      rentals.push(rental)
      console.log('rentals', rentals)
      //that.setData({ type: null, packageSelectIndex: null })
      that.renderData(rentals)
    },
    renderData(rentals) {
      var that = this
      //var rentals = that.data.rentals
      var packageCommonBackgroud = '#F0F0F0'
      var productCommonBackgroud = '#F0F0F0'
      var packageCommonTextColor = '#000000'
      var itemCommonColor = '#000000'
      var itemIndex = 1
      var totalItemNum = 0
      var totalGuarantyAmount = 0
      for (var i = 0; i < rentals.length; i++) {
        var rental = rentals[i]
        if (rental.package_id) {
          rental.backgroundColor = packageCommonBackgroud
          rental.textColor = packageCommonTextColor
        }
        else {
          rental.backgroundColor = productCommonBackgroud
        }
        if (!isNaN(rental.realDeposit)){
          totalGuarantyAmount += rental.realDeposit
        }
        //totalGuarantyAmount += rental
        for (var j = 0; j < rental.rentItems.length; j++) {
          totalItemNum++
          var item = rental.rentItems[j]
          item.itemIndex = itemIndex
          itemIndex++
          item.textColor = itemCommonColor
          if (!item.noCode && !item.rent_product_id) {
            item.textColor = 'red'
          }
          else if (item.noCode && (!item.category  || !item.name) ){
            item.textColor = 'red'
          }
          else{
            item.textColor = that.data.defaultTextColor
          }
        }
      }
      console.log('render rentals', rentals)
      that.setData({ rentals, totalItemNum, totalGuarantyAmount, 
        totalGuarantyAmountStr: util.showAmount(totalGuarantyAmount) })
    },
  }
})
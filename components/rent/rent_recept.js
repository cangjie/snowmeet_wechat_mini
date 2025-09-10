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
    searchBarcodeFuzzy(e){
      var that = this
      that.setData({showPopUp: true, popUpContent: 'searchBarCodeFuzzy'})
    },
    confirmProduct(e){
      var that = this
      if (that.data.currentItemIndex){
        var product = e.detail
        var item = that.getItemByIndex(parseInt(that.data.currentItemIndex))
        item.name = product.name
        item.category_id = product.category_id
        item.categoryName = product.category.name
        item.code = product.barcode
        var rentals = that.data.rentals
        that.renderData(rentals)
      }
      else{
        that.selectProduct(e)
      }
      that.setData({showPopUp: false, popUpContent: null, currentItemIndex: null, barCode: null})
    },
    selectProduct(e){
      var that = this
      var rentProduct = e.detail
      if (that.checkCodeDup(rentProduct.barcode)){
        wx.showToast({
          title: '编码不可重复',
          icon: 'error'
        })
        returm
      }
      console.log('select product', e)
      var rental = {
        id: 0,
        order_id: null,
        package_id: null,
        name: rentProduct.name,
        valid: 0,
        realDeposit: rentProduct.realDeposit,
        realDepositStr: util.showAmount(rentProduct.realDeposit)
      }
      var items = []
      var item = {
        id: 0,
        rental_id: 0,
        noCode: false,
        category_id: rentProduct.category.id,
        name: rentProduct.name,
        categoryName: rentProduct.category.name,
        code: rentProduct.barcode,
        rent_product_id: rentProduct.id
      }
      items.push(item)
      rental.rentItems = items
      var rentals = that.data.rentals
      rentals.push(rental)
      that.setData({showPopUp: false, popUpContent: null})
      that.renderData(rentals)
    },
    checkCodeDup(code) {
      var dup = false
      var that = this
      var rentals = that.data.rentals
      for (var i = 0; rentals && i < rentals.length; i++) {
        var rental = rentals[i]
        for (var j = 0; j < rental.rentItems.length; j++) {
          var item = rental.rentItems[j]
          if (item.code == code) {
            dup = true
            break
          }
        }
        if (dup) {
          break
        }
      }
      return dup
    },
    addNewBlank() {
      var that = this
      var rental = {
        id: 0,
        order_id: null,
        package_id: null,
        name: '',
        valid: 0,
        realDeposit: 0,
        realDepositStr: '——'
      }
      var items = []
      var item = {
        id: 0,
        noCode: true,
        rental_id: 0,
        category_id: null,
        name: '',
        categoryName: '',
        code: '',
        rent_product_id: null
      }
      items.push(item)
      rental.rentItems = items
      var rentals = that.data.rentals
      rentals.push(rental)
      that.renderData(rentals)
    },
  }
})
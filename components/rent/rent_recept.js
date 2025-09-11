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
    rentals: [],
    defaultTextColor: 'black',
    noNeedTextColor: 'gray',
    startDate: util.formatDate(new Date())
  },

  lifetimes: {
    ready() {
      app.loginPromiseNew.then(function (resolve) {

      })
    }
  },

  /**
   * Component methods
   */
  methods: {
    addNewPackage() {
      var that = this
      that.setData({ showPopUp: true, popUpContent: 'packageSelector' })
    },
    cancelPopUp() {
      var that = this
      that.setData({ showPopUp: false, popUpContent: 'packageSelector' })
    },
    selectPackageConfirm(e) {
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
        expectDays: 1,
        deposit: selectedPackage.deposit,
        depositStr: util.showAmount(selectedPackage.deposit),
        realDeposit: selectedPackage.deposit,
        realDepositStr: util.showAmount(selectedPackage.deposit),
        startDate: that.data.startDate
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
        if (isNaN(rental.depositDiscount)){
          rental.realDeposit = rental.deposit
        }
        else{
          rental.realDeposit = rental.deposit - rental.depositDiscount
        }
        rental.realDepositStr = util.showAmount(rental.realDeposit)
        if (rental.package_id) {
          rental.backgroundColor = packageCommonBackgroud
          rental.textColor = packageCommonTextColor
        }
        else {
          rental.backgroundColor = productCommonBackgroud
        }
        if (!isNaN(rental.realDeposit)) {
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
          else if (item.noCode && (!item.category_id || !item.name)) {
            item.textColor = 'red'
          }
          else {
            item.textColor = that.data.defaultTextColor
          }
          if (item.noNeed){
            item.textColor = that.data.noNeedTextColor
          }
         
        }
      }
      console.log('render rentals', rentals)
      that.setData({
        rentals, totalItemNum, totalGuarantyAmount,
        totalGuarantyAmountStr: util.showAmount(totalGuarantyAmount)
      })
    },
    searchBarcodeFuzzy(e) {
      var that = this
      that.setData({ showPopUp: true, popUpContent: 'searchBarCodeFuzzy' })
    },
    confirmProduct(e) {
      var that = this
      if (that.data.currentItemIndex) {
        var product = e.detail
        var item = that.getItemByIndex(parseInt(that.data.currentItemIndex))
        item.name = product.name
        item.category_id = product.category_id
        item.categoryName = product.category.name
        item.code = product.barcode
        item.rent_product_id = product.id
        var rentals = that.data.rentals
        that.renderData(rentals)
      }
      else {
        that.selectProduct(e)
      }
      that.setData({ showPopUp: false, popUpContent: null, currentItemIndex: null, barCode: null })
    },
    selectProduct(e) {
      var that = this
      var rentProduct = e.detail
      if (that.checkCodeDup(rentProduct.barcode)) {
        wx.showToast({
          title: '编码不可重复',
          icon: 'error'
        })
        return
      }
      console.log('select product', e)
      var rental = {
        id: 0,
        order_id: null,
        package_id: null,
        name: rentProduct.name,
        valid: 0,
        deposit: rentProduct.category.deposit,
        depositStr: util.showAmount(rentProduct.category.deposit),
        realDeposit: rentProduct.category.deposit,
        realDepositStr: util.showAmount(rentProduct.category.deposit),
        startDate: that.data.startDate,
        expectDays: 1,
        category: rentProduct.category
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
        rent_product_id: rentProduct.id,
        category: rentProduct.category
      }
      items.push(item)
      rental.rentItems = items
      var rentals = that.data.rentals
      rentals.push(rental)
      that.setData({ showPopUp: false, popUpContent: null })
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
        realDepositStr: '——',
        startDate: that.data.startDate,
        expectDays: 1
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
    searchListBarcodeFuzzy(e) {
      var that = this
      var id = parseInt(e.currentTarget.id)
      var item = that.getItemByIndex(id)
      console.log('query item', item)
      if (item.noCode || item.noNeed) {
        return
      }
      else {
        that.setData({ showPopUp: true, popUpContent: 'searchBarCodeFuzzy', searchCategoryId: item.category_id, currentItemIndex: id })
      }
    },
    getItemByIndex(index) {
      var that = this
      var rentals = that.data.rentals
      var returnItem = null
      for (var i = 0; returnItem == null && i < rentals.length; i++) {
        var rental = rentals[i]
        var returnItem = null
        for (var j = 0; returnItem == null && j < rental.rentItems.length; j++) {
          var item = rental.rentItems[j]
          if (index == item.itemIndex) {
            returnItem = item
          }
        }
      }
      return returnItem
    },
    getRentenalByItemIndex(index){
      var that = this
      var rentals = that.data.rentals
      var rental =  null
      for(var i = 0; rental == null && i < rentals.length; i++){
        for(var j = 0; rental == null && j < rentals[i].rentItems.length; j++){
          if (index == rentals[i].rentItems[j].itemIndex){
            rental = rentals[i]
          }
        }
      }
      return rental
    },
    setNoCode(e) {
      var that = this
      var id = parseInt(e.currentTarget.id)
      var item = that.getItemByIndex(id)
      item.noCode = e.detail.value.length == 0 ? false : true
      that.setData({ rentals: that.data.rentals })
      console.log('get item', item)
      that.renderData(that.data.rentals)
    },
    setNoNeed(e){
      var that = this
      var id = parseInt(e.currentTarget.id)
      var item = that.getItemByIndex(id)
      item.noNeed = e.detail.value.length == 0 ? false : true
      that.setData({ rentals: that.data.rentals })
      console.log('get item', item)
      that.renderData(that.data.rentals)
    },
    setAtOnce(e){
      var that = this
      var id = parseInt(e.currentTarget.id)
      var item = that.getItemByIndex(id)
      item.atOnce = e.detail.value.length == 0 ? false : true
      that.setData({ rentals: that.data.rentals })
      console.log('get item', item)
      that.renderData(that.data.rentals)
    },
    setNoGuaranty(e){
      var that = this
      var id = parseInt(e.currentTarget.id)
      var rentals = that.data.rentals
      var rental = rentals[id]
      rental.noGuaranty = e.detail.value.length == 0 ? false : true
      if(rental.noGuaranty){
        rental.realDeposit = 0
        rental.realDepositStr = util.showAmount(rental.realDeposit)
      }
      else{
        if (isNaN(rental.depositDiscount)){
          rental.realDeposit = rental.deposit
          rental.realDepositStr = util.showAmount(rental.realDeposit)
        }
        else{
          rental.realDeposit = rental.deposit - rental.depositDiscount
          rental.realDepositStr = util.showAmount(rental.realDeposit)
        }
      }
      that.renderData(rentals)
    },
    setStartDate(e){
      var that = this
      var id = parseInt(e.currentTarget.id)
      var rentals = that.data.rentals
      var rental = rentals[id]
      rental.startDate = e.detail.value
      that.renderData(rentals)
      that.setData({rentals})
    },
    setItemName(e) {
      var that = this
      var id = parseInt(e.currentTarget.id)
      var item = that.getItemByIndex(id)
      item.name = e.detail.value
      that.renderData(that.data.rentals)
    },
    selectCategory(e) {
      var that = this
      var id = parseInt(e.currentTarget.id)
      that.setData({ showPopUp: true, popUpContent: 'categorySelector', currentItemIndex: id })
    },
    confirmCategory(e) {
      var that = this
      console.log('confirm cate', e)
      that.setData({ showPopUp: false, popUpContent: null })
      var item = that.getItemByIndex(that.data.currentItemIndex)
      item.category = e.detail
      item.category_id = item.category.id
      /*
      item.deposit = e.detail.deposit
      item.depositStr = util.showAmount(item.deposit)
      item.realDeposit = item.deposit
      item.realDepositStr = util.showAmount(item.realDeposit)
      */
      var rental = that.getRentenalByItemIndex(that.data.currentItemIndex)
      rental.deposit = e.detail.deposit
      rental.depositStr = util.showAmount(rental.deposit)
      rental.realDeposit = rental.deposit
      rental.realDepositStr = rental.depositStr
      that.renderData(that.data.rentals)

      that.setData({ barCode: null, searchBarCode: null })
    },
    showItem(e) {
      var that = this
      var id = e.currentTarget.id
      var rentals = that.data.rentals
      var currentRental = rentals[parseInt(id)]
      that.setData({ currentRental, showBackdrop: true, action: 'item', currentRentalNum: 100 })
    },
    cancelBackdrop(e) {
      var that = this
      that.setData({ showBackdrop: false, action: null, currentRental: null, currentItem: null })
    },
    showPackage(e) {
      var that = this
      var id = e.currentTarget.id
      var rentals = that.data.rentals
      var currentRental = rentals[parseInt(id)]
      if (currentRental != null) {
        that.setData({ currentRental, showBackdrop: true, action: 'package' })
      }
    },
    onRentalChange(e){
      console.log('rental change', e)
      var that = this
      that.setData({unSavedRental: e.detail})
    },
    saveUpdatedRental(){
      var that = this
      
      if (that.data.unSavedRental){
        var currentRental = that.data.currentRental
        var unSavedRental = that.data.unSavedRental
        currentRental.depositDiscount = unSavedRental.depositDiscount
        currentRental.fixedRental = unSavedRental.fixedRental
        currentRental.expectDays = unSavedRental.expectDays
      }
      that.renderData(that.data.rentals)
      that.cancelBackdrop()
      that.setData({unSavedRental: null})
    }
  }
})
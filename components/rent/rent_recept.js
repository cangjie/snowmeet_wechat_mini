// components/rent/rent_recept.js
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
const app = getApp()
Component({

  /**
   * Component properties
   */
  properties: {
    /*
    showPopUp: false,
    popUpContent: '',
    */
    memberId: Number,
    shop: String,
    rentals: Array
  },

  /**
   * Component initial data
   */
  data: {
    rentals: [],
    defaultTextColor: 'black',
    noNeedTextColor: 'gray',
    startDate: util.formatDate(new Date()),
    startDateIsWeekend: util.isWeekend(new Date()),
    currentDate: new Date()
  },

  lifetimes: {
    ready() {
      var that = this
      that.setData({ memberId: that.properties.memberId, shop: that.properties.shop })
      app.loginPromiseNew.then(function (resolve) {
        data.getShopByNamePromise(that.data.shop).then(function (shopObj) {
          if (that.properties.rentals){
            console.log('save rentals', that.properties.rentals)
            var rentals = that.properties.rentals
            for(var i = 0; i < rentals.length; i++){
              var startDate = new Date()
              if (rentals[i].start_date)
              {
                startDate = new Date(rentals[i].start_date)
              }
              var endDate = rentals[i].end_date
              if (!endDate){
                endDate = startDate
              }
              else{
                endDate = new Date(endDate)
              }
              var rentType = rentals[i].package_id == null ? '分类' : '套餐';
              var scene = that.data.memberId? '会员':'门市'
              var rental = rentals[i]
              var id = 0
              switch(rentType){
                case '分类':
                  id = rental.category_id
                  break
                case '套餐':
                  id = rental.package_id
                  break;
                default:
                  break
              }
              data.getRentPriceListPromise(shopObj.id, rentType, id, scene)
              .then(function(priceList){
                rental.priceList = priceList
                var startDate = rental.start_date
                if (startDate){
                  startDate = util.formatDate(new Date(startDate))
                }
                else{
                  startDate = util.formatDate(new Date())
                }
                rental.startDate = startDate
                var details = []
                for(var i = 0; i < rental.pricePresets.length; i++){
                  var preset = rental.pricePresets[i]
                  var detail = {
                    id: 0,
                    rentType: preset.rentType,
                    date: preset.rent_date,
                    price: preset.price,
                    discount: preset.discount,
                    dayType: preset.day_type
                  }
                  details.push(detail)
                }
                rental.details = details
                util.createRentalDetail(rental, new Date(startDate), new Date(endDate))
                rentals = that.formatRentals(rentals)
                that.renderData(rentals)
              }).catch(function (exp){

              })
              
            }
            //that.setData({rentals})
            
          }
          that.setData({ shopObj })

        })
      })
    }
  },
  methods: {
    formatRentals(rentals){
      for(var i = 0; i < rentals.length; i++){
        var rental = rentals[i]
        if (!isNaN(rental.guaranty)){
          rental.deposit = parseFloat(rental.guaranty)
        }
        else{
          rental.deposit = 0
        }
        if (!isNaN(rental.guaranty_discount)){
          rental.depositDiscount = parseFloat(rental.guaranty_discount)
        }
        else{
          rental.depositDiscount = 0
        }
        rental.realDeposit = rental.deposit - rental.depositDiscount
        rental.realDepositStr = util.showAmount(rental.realDeposit)
        if (rental.start_date){
          rental.startDate = util.formatDate(new Date(rental.start_date))
        }
        else{
          rental.startDate = util.formatDate(new Date())
        }
        //util.createRentalDetail(rental, new Date(rental.startDate), new Date(rental.end_date))
      }
      return rentals
    },
    addNewPackage() {
      var that = this
      that.setData({ showPopUp: true, popUpContent: 'packageSelector' })
    },
    cancelPopUp() {
      var that = this
      that.setData({ showPopUp: false, popUpContent: 'packageSelector' })
    },
    getPrice(priceList, date) {
      var currentDate = new Date()
      var rentType = '日场'
      if (util.formatDate(date) == util.formatDate(currentDate)) {
        var hour = currentDate.getHours()
        if (hour >= 13 && hour < 16) {
          rentType = '下午场'
        }
        else if (hour >= 16) {
          rentType = '夜场'
        }
      }
      var isWeekend = util.isWeekend(date)
      var commonPrice = null
      for (var i = 0; i < priceList.length; i++) {
        var price = priceList[i]
        if (price.rent_type == rentType
          && ((isWeekend && price.day_type == '周末') || (!isWeekend && price.day_type == '平日'))) {
          return price
        }
        if (price.rent_type == '日场'
          && ((isWeekend && price.day_type == '周末') || (!isWeekend && price.day_type == '平日'))) {
          commonPrice = price
        }
      }
      return commonPrice
    },
    selectPackageConfirm(e) {
      var that = this
      that.cancelPopUp()
      console.log('select package', e)
      var selectedPackage = e.detail
      data.getRentPriceListPromise(that.data.shopObj.id, '套餐', selectedPackage.id, that.properties.memberId ? '会员' : '门市')
        .then(function (priceList) {
          var rental = {
            id: 0,
            order_id: null,
            package_id: selectedPackage.id,
            name: selectedPackage.name,
            valid: 0,
            expectDays: 1,
            deposit: selectedPackage.deposit,
            guaranty: selectedPackage.deposit,
            depositStr: util.showAmount(selectedPackage.deposit),
            realDeposit: selectedPackage.deposit,
            realDepositStr: util.showAmount(selectedPackage.deposit),
            startDate: that.data.startDate,
            startDateIsWeekend: util.isWeekend(new Date(that.data.startDate)),
            priceList: priceList,
            memo: ''
          }
          util.createRentalDetail(rental, new Date(rental.startDate), new Date(rental.startDate))
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
              category_id: selectedPackage.categories[i].id,
              memo: '',
              category: selectedPackage.categories[i]
            }
            items.push(item)
          }
          rental.rentItems = items
          var rentals = that.data.rentals
          var newRentals = []
          newRentals.push(rental)
          for(var i = 0; rentals && i < rentals.length; i++){
            var oldRental = rentals[i]
            newRentals.push(oldRental)
          }
          
          console.log('rentals', newRentals)
          //that.setData({ type: null, packageSelectIndex: null })
          that.renderData(newRentals)
          //that.triggerEvent()
          that.triggerEvent('SyncRentData', {rentals: newRentals, needUpdate: true})
        }).catch(function (exp) { })


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
        if (isNaN(rental.depositDiscount)) {
          rental.realDeposit = rental.deposit
        }
        else {
          rental.realDeposit = rental.deposit - rental.depositDiscount
        }
        if (!isNaN(rental.realDeposit)) {
          rental.realDepositStr = util.showAmount(rental.realDeposit)
        }
        else {
          rental.realDepositStr = ''
        }
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
          if (item.noNeed) {
            item.textColor = that.data.noNeedTextColor
          }

        }
      }
      console.log('render rentals', rentals)
      that.setData({
        rentals, totalItemNum, totalGuarantyAmount,
        totalGuarantyAmountStr: util.showAmount(totalGuarantyAmount)
      })
      //that.triggerEvent('SyncRentData', rentals)
    },
    searchBarcodeFuzzy(e) {
      var that = this
      that.setData({ showPopUp: true, popUpContent: 'searchBarCodeFuzzy', searchCategoryId: null })
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
        item.memo = ''
        var rentals = that.data.rentals
        that.renderData(rentals)
        that.triggerEvent('SyncRentData', {rentals: rentals, needUpdate: true})
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
      data.getRentPriceListPromise(that.data.shopObj.id, '分类',
        rentProduct.category.id, that.properties.memberId ? '会员' : '门市')
        .then(function (priceList) {
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
            startDateIsWeekend: util.isWeekend(new Date(that.data.startDate)),
            expectDays: 1,
            category: rentProduct.category,
            priceList: priceList,
            memo: ''
          }
          util.createRentalDetail(rental, new Date(rental.startDate), new Date(rental.startDate))
          var items = []
          var item = {
            id: 0,
            rental_id: 0,
            noCode: false,
            category_id: rentProduct.category.id,
            category: rentProduct.category,
            name: rentProduct.name,
            categoryName: rentProduct.category.name,
            code: rentProduct.barcode,
            rent_product_id: rentProduct.id,
            category: rentProduct.category,
            memo: ''
          }
          items.push(item)
          rental.rentItems = items
          var rentals = that.data.rentals
          rentals.push(rental)
          that.setData({ showPopUp: false, popUpContent: null })
          that.renderData(rentals)
          //that.triggerEvent('SyncRentData', rentals)
          that.triggerEvent('SyncRentData', {rentals: rentals, needUpdate: true})
        })

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
        startDateIsWeekend: util.isWeekend(new Date(that.data.startDate)),
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
      var newRentals = []
      newRentals.push(rental)
      for(var i = 0; rentals && i < rentals.length; i++){
        newRentals.push(rentals[i])
      }
      //rentals.push(rental)
      that.renderData(newRentals)
      that.triggerEvent('SyncRentData', {rentals: newRentals, needUpdate: true})
      //that.triggerEvent('SyncRentData', rentals)
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
    getRentenalByItemIndex(index) {
      var that = this
      var rentals = that.data.rentals
      var rental = null
      for (var i = 0; rental == null && i < rentals.length; i++) {
        for (var j = 0; rental == null && j < rentals[i].rentItems.length; j++) {
          if (index == rentals[i].rentItems[j].itemIndex) {
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
      //that.triggerEvent('SyncRentData', that.data.rentals)
      that.triggerEvent('SyncRentData', {rentals: that.data.rentals, needUpdate: true})
    },
    setNoNeed(e) {
      var that = this
      var id = parseInt(e.currentTarget.id)
      var item = that.getItemByIndex(id)
      item.noNeed = e.detail.value.length == 0 ? false : true
      that.setData({ rentals: that.data.rentals })
      console.log('get item', item)
      that.renderData(that.data.rentals)
      //Event('SyncRentData', that.data.rentals)
      that.triggerEvent('SyncRentData', {rentals: that.data.rentals, needUpdate: true})
    },
    setAtOnce(e) {
      var that = this
      var id = parseInt(e.currentTarget.id)
      var item = that.getItemByIndex(id)
      item.atOnce = e.detail.value.length == 0 ? false : true
      that.setData({ rentals: that.data.rentals })
      console.log('get item', item)
      that.renderData(that.data.rentals)
      //that.triggerEvent('SyncRentData', that.data.rentals)
      that.triggerEvent('SyncRentData', {rentals: that.data.rentals, needUpdate: true})
    },
    setNoGuaranty(e) {
      var that = this
      var id = parseInt(e.currentTarget.id)
      var rentals = that.data.rentals
      var rental = rentals[id]
      rental.noGuaranty = e.detail.value.length == 0 ? false : true
      if (rental.noGuaranty) {
        rental.realDeposit = 0
        rental.realDepositStr = util.showAmount(rental.realDeposit)
      }
      else {
        if (isNaN(rental.depositDiscount)) {
          rental.realDeposit = rental.deposit
          rental.realDepositStr = util.showAmount(rental.realDeposit)
        }
        else {
          rental.realDeposit = rental.deposit - rental.depositDiscount
          rental.realDepositStr = util.showAmount(rental.realDeposit)
        }
      }
      that.renderData(rentals)
      //that.triggerEvent('SyncRentData', rentals)
      that.triggerEvent('SyncRentData', {rentals: rentals, needUpdate: true})
    },
    setStartDate(e) {
      var that = this
      var id = parseInt(e.currentTarget.id)
      var rentals = that.data.rentals
      var rental = rentals[id]
      var date = new Date(e.detail.value)
      rental.startDate = e.detail.value
      rental.startDateIsWeekend = util.isWeekend(new Date(e.detail.value))
      rental.expectDays = 1
      rental.endDate = e.detail.value
      util.createRentalDetail(rental, date, date)
      that.renderData(rentals)
      //that.setData({ rentals })
      //that.triggerEvent('SyncRentData', rentals)
      that.triggerEvent('SyncRentData', {rentals: rentals, needUpdate: true})
    },
    setItemName(e) {
      var that = this
      var id = parseInt(e.currentTarget.id)
      var item = that.getItemByIndex(id)
      item.name = e.detail.value
      that.renderData(that.data.rentals)
      //that.triggerEvent('SyncRentData', that.data.rentals)
      that.triggerEvent('SyncRentData', {rentals: that.data.rentals, needUpdate: false})
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
      var rental = that.getRentenalByItemIndex(that.data.currentItemIndex)
      data.getRentPriceListPromise(that.data.shopObj.id, '分类',
        item.category.id, that.properties.memberId ? '会员' : '门市')
        .then(function (priceList) {
          rental.deposit = e.detail.deposit
          rental.depositStr = util.showAmount(rental.deposit)
          rental.realDeposit = rental.deposit
          rental.realDepositStr = rental.depositStr
          rental.guaranty = rental.deposit 
          rental.guarantyStr = rental.depositStr
          
          rental.category = e.detail
          rental.expectDays = 1
          rental.startDate = that.data.startDate
          rental.startDateIsWeekend = util.isWeekend(new Date(that.data.startDate))
          rental.priceList = priceList
          util.createRentalDetail(rental, new Date(rental.startDate), new Date(rental.startDate))
          that.renderData(that.data.rentals)
          //that.triggerEvent('SyncRentData', that.data.rentals)
          that.triggerEvent('SyncRentData', {rentals: that.data.rentals, needUpdate: true})
          that.setData({ barCode: null, searchBarCode: null })
        }).catch(function (exp) { })
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
      that.setData({ showBackdrop: false, action: null, currentRental: null, currentItem: null, unSavedRental: null })
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
    onRentalChange(e) {
      var that = this
      console.log('rental change', e)
      console.log('rental change ori', that.data.rentals)
      that.setData({ unSavedRental: e.detail })
    },
    saveUpdatedRental() {
      var that = this
      if (that.data.unSavedRental) {
        var itemIndex = that.data.unSavedRental.rentItems[0].itemIndex
        var rentals = that.data.rentals
        for(var i = 0; i < rentals.length; i++){
          var rental = rentals[i]
          for(var j = 0; j < rental.rentItems.length; j++){
            if (rental.rentItems[j].itemIndex == itemIndex){
              rentals[i] = that.data.unSavedRental
            }
          }
        }
      }
      that.renderData(that.data.rentals)
      //that.triggerEvent('SyncRentData', that.data.rentals)
      that.triggerEvent('SyncRentData', {rentals: that.data.rentals, needUpdate: true})
      that.cancelBackdrop()
      that.setData({ unSavedRental: null })
    },
    showPriceList(e) {
      var that = this
      var id = parseInt(e.currentTarget.id)
      var shop = that.data.shop
      var rental = that.data.rentals[id]
      var targetId = rental.package_id ? rental.package_id : rental.category.id
      that.setData({
        showBackdrop: true, action: 'priceList',
        dayType: rental.startDateIsWeekend ? '周末' : '平日',
        type: rental.package_id ? '套餐' : '分类', shop, targetId
      })
    },
    setRentalMemo(e){
      var that = this
      var id = parseInt(e.currentTarget.id)
      var rental = that.data.rentals[id]
      rental.memo = e.detail.value
      that.renderData(that.data.rentals)
      that.triggerEvent('SyncRentData', {rentals: that.data.rentals, needUpdate: false })
    },
    setItemMemo(e){
      var that = this
      var rentals = that.data.rentals
      var id = parseInt(e.currentTarget.id)
      for(var i = 0; i < rentals.length; i++){
        var rental = rentals[i]
        for(var j = 0; j < rental.rentItems.length; j++){
          if (rental.rentItems[j].itemIndex == id){
            rental.rentItems[j].memo = e.detail.value
            break
          }
        }
      }
      that.renderData(that.data.rentals)
      that.triggerEvent('SyncRentData', {rentals: that.data.rentals, needUpdate: false })
    },
    del(e){
      var that = this
      var id = parseInt(e.currentTarget.id)
      var rentals = that.data.rentals
      var newRentals = []
      for(var i = 0; i< rentals.length; i++){
        if (i != id){
          newRentals.push(rentals[i])
        }
      }
      that.renderData(newRentals)
      that.triggerEvent('SyncRentData', {rentals: newRentals, needUpdate: true})
    }
  }
})
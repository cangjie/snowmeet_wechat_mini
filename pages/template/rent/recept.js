// pages/test/firstUI/rent_recept.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    currentRentalNum: 0,
    maxCategoryColIndex: 0,
    categorySelectIndex: undefined,
    categorySelectText: '',
    packageSelectIndex: undefined,
    rentals:[],
    defaultTextColor: '#000000',
    showBackdrop: false,
    action: '',
    itemSegs: ['押金', '租金'],
    displayRental: false,
    querying: false,
    values1: [{
      id: 1,
      name: 'segmented1',
      badge: 1
    }, {
      id: 2,
      name: 'segmented2'
    }, {
      id: 3,
      name: 'segmented3'
    }, {
      id: 4,
      name: 'segmented4'
    }, {
      id: 5,
      name: 'segmented5'
    }, {
      id: 6,
      name: 'segmented6'
    }],
    propertyObj:{
      a: 1, b: 'aaa'
    }
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var startDate = util.formatDate(new Date())
    that.setData({startDate})
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {
    var that = this
    app.loginPromiseNew.then(function (resolve){
      that.getCatagories()
      that.getPackageList()
      that.setData({windowHeight: app.globalData.windowInfo.screenHeight})
    })
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  },
  getCatagories()
  {
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Rent/GetAllCategoryList'
    util.performWebRequest(getUrl, null).then(function(resovle){
      var categories = resovle
      console.log('get categories', categories)
      var categoryPickerArr = []
      categoryPickerArr.push(categories)
      that.setData({categoryPickerArr, categories})
      that.selCategory(0, 0)
    })
  },
  selCategory(column, value){
    var that = this
    that.data.maxCategoryColIndex = Math.max(column, that.data.maxCategoryColIndex)
    var categories = that.data.categories
    var categoryPickerArrOld = that.data.categoryPickerArr
    var categoryPickerArr = []
    for(var i = 0; i <= column; i++){
      categoryPickerArr.push(categoryPickerArrOld[i])
    }
    var currentCategoryList = categoryPickerArr[column]
    if (!currentCategoryList || currentCategoryList.length <= value){
      value = 0
    }
    var currentCategory = currentCategoryList[value]
    if (currentCategory.children){
      categoryPickerArr.push(currentCategory.children)
      that.data.categoryPickerArr = categoryPickerArr
      that.selCategory(column + 1, 0)
    }
    else{
      for(var i = column; i < that.data.maxCategoryColIndex; i++){
        categoryPickerArr.push([])
      }
      that.setData({categoryPickerArr})
      if (column == 0 && value == 13)
        console.log('13')
    }
  },
  catePickerColChange(e){
    var that = this
    console.log('sel col change', e)
    that.selCategory(e.detail.column, e.detail.value)
  },
  selectCategoryOk(e){
    console.log('sel ok', e)
    var that = this
    var categorySelectIndex = e.detail.value
    var categorySelectText = ''
    var categoryPickerArr = that.data.categoryPickerArr
    for(var i = 0; i < categorySelectIndex.length; i++){
      var txt = ''
      if (i < categoryPickerArr.length && categorySelectIndex[i] < categoryPickerArr[i].length){
        txt = categoryPickerArr[i][categorySelectIndex[i]].name
      }
      if (txt!=''){
        categorySelectText += ((categorySelectText == '' ? '' : ' > ') + txt)
      }
    }
    that.setData({categorySelectIndex, categorySelectText})
  },
  selectType(e){
    console.log('sel type', e)
    var that = this
    that.setData({type: e.detail.value})
  },
  getPackageList(){
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Rent/GetRentPackageList'
    util.performWebRequest(getUrl, null).then(function(resolve){
      console.log('get package list', resolve)
      that.setData({packageList: resolve})
    })
  },
  selectPackage(e){
    var that = this
    that.setData({packageSelectIndex: e.detail.value})
    var packageList = that.data.packageList
    var selectedPackage = packageList[that.data.packageSelectIndex]
    var getPackageUrl = app.globalData.requestPrefix + 'Rent/GetRentPackage/' + selectedPackage.id
    util.performWebRequest(getPackageUrl, null).then(function (resovle){
      selectedPackage = resovle
      console.log('package to add', selectedPackage)
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
      for(var i = 0; i < selectedPackage.categories.length; i++){
        var item = {
          id: 0,
          rental_id: 0,
          categoryName: selectedPackage.categories[i].name,
          name: null,
          code: null,
          rent_product_id: null
        }
        items.push(item)
      }
      rental.rentItems = items
      var rentals = that.data.rentals
      rentals.push(rental)
      console.log('rentals', rentals)
      that.setData({type: null, packageSelectIndex: null})
      that.renderData(rentals)
    })
  },
  del(e){
    var that = this
    console.log('del click', e)
    var id = parseInt(e.currentTarget.id)
    var rentals = that.data.rentals
    var newRentals = []
    for(var i = 0; i < rentals.length; i++){
      if (i != id){
        newRentals.push(rentals[i])
      }
    }
    that.setData({rentals: newRentals})
  },


  inputBarcode(e){
    var that = this
    var barCode = e.detail.value
    that.setData({barCode})
    /*
    if (barCode.length >= 3){
      setTimeout(()=>{
        var now = new Date()
        var ts = now - that.data.lastInputBarCodeTime 
        console.log('ts', ts)
        if (ts >= 1900 && ts <= 2100){
          //console.log('barcode', barCode)
          that.searchBarcode()
        }
        
      }, 2000)
      that.setData({barCode, lastInputBarCodeTime: new Date()})
    }
    */
  },
  
  
  searchBarcode(){
    var that = this
    console.log('bar code is: ', that.data.barCode)
    var barCode = that.data.barCode
    if (that.checkCodeDup(barCode)){
      wx.showToast({
        title: '编码不可重复',
        icon: 'error'
      })
      return
    }
    that.setData({querying: true})
    var searchUrl = app.globalData.requestPrefix + 'Rent/GetRentProductByBarcode/' + barCode
    util.performWebRequest(searchUrl, null).then(function (resolve){
      var rentProduct = resolve
      
      console.log('rent product', rentProduct)
      that.setData({barCodeInputing: false})
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
        category_id:  rentProduct.category.id,
        name: rentProduct.name,
        categoryName: rentProduct.category.name,
        code: rentProduct.barcode,
        rent_product_id: rentProduct.id
      }
      items.push(item)
      rental.rentItems = items
      var rentals = that.data.rentals
      rentals.push(rental)
      console.log('rentals', rentals)
      that.setData({type: null, packageSelectIndex: null, barCodeInputing: false, barCode: null, querying:false})
      that.renderData(rentals)
    }).catch(function(reject){
      that.setData({querying: false})
    })
  },
  
  renderData(rentals){
    var that = this
    //var rentals = that.data.rentals
    var packageCommonBackgroud = '#F0F0F0'
    var productCommonBackgroud = '#F0F0F0'
    var packageCommonTextColor = '#000000'
    var itemCommonColor = '#000000'
    var itemIndex = 1
    for(var i = 0; i < rentals.length; i++){
      var rental = rentals[i]
      if (rental.package_id){
        rental.backgroundColor = packageCommonBackgroud
        rental.textColor = packageCommonTextColor
      }
      else{
        rental.backgroundColor = productCommonBackgroud
      }
      for(var j = 0; j < rental.rentItems.length; j++){
        var item = rental.rentItems[j]
        item.itemIndex = itemIndex
        itemIndex++
        item.textColor = itemCommonColor
        if (!item.rent_product_id){
          item.textColor = 'red'
        }
      }
    }
    console.log('render rentals', rentals)
    that.setData({rentals})
  },
  showPackageItem(e){
    var that = this
    var id = e.currentTarget.id
    var rentals = that.data.rentals
    var currentRental = null
    var currentItem = null
    for(var i = 0; i < rentals.length; i++){
      var rental = rentals[i]
      for(var j = 0; j < rental.rentItems.length; j++){
        var item = rental.rentItems[j];
        if (parseInt(id)==item.itemIndex){
          currentItem = item
          currentRental = rental
          break
        }
      }
    }
    if (currentRental != null && currentItem != null){
      currentRental.menu = that.getRentalItemMenus(currentRental)
      currentRental.currentMenuIndex = 0
      that.setData({currentRental, currentItem, showBackdrop: true, action: 'packageItem'})
    }
  },
  showPackage(e){
    var that = this
    var id = e.currentTarget.id
    var rentals = that.data.rentals
    var currentRental = rentals[parseInt(id)]
    if (currentRental != null){
      that.setData({currentRental, showBackdrop: true, action: 'package'})
    }
  },
  getRentalItemMenus(rental){
    var items = rental.rentItems
    var menu = []
    for(var i = 0; i < items.length; i++){
      var item = items[i]
      var menuItem = {
        id: i,
        name: item.categoryName,
        badge: (item.name || item.code)? 0 : 1
      }
      menu.push(menuItem)
    }
    return menu
  },
  showItem(e){
    var that = this
    var id = e.currentTarget.id
    var rentals = that.data.rentals
    var currentRental = rentals[parseInt(id)]
    that.setData({currentRental, showBackdrop: true, action: 'item', currentRentalNum: 100})
  },
  cancelBackdrop(e){
    var that = this
    that.setData({showBackdrop: false, action: null, currentRental: null, currentItem: null})
  },
  switchGuarantyRental(e){
    var that = this
    console.log('switch', e)
    if (e.detail.index == 0){
      that.setData({displayRental: false})
    }
    else {
      that.setData({displayRental: true})
    }
  },
  scroll(e){
    console.log('scroll')
  },
  checkCodeDup(code){
    var dup = false
    var that = this
    var rentals = that.data.rentals
    for(var i = 0; rentals && i < rentals.length; i++){
      var rental = rentals[i]
      for(var j = 0; j < rental.rentItems.length; j++){
        var item = rental.rentItems[j]
        if (item.code == code){
          dup = true
          break
        }
      }
      if (dup){
        break
      }
    }
    return dup
  }
})
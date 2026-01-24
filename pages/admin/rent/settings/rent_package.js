// pages/admin/rent/settings/rent_package.js
//import Linq  from '../../../../node_modules/linq/linq.min.js'
const app = getApp()
const data = require('../../../../utils/data.js')
Page({

  /**
   * Page initial data
   */
  data: {
    selectedCode: [],
    priceArr: [
      {
        shop: '万龙',
        matrix: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']]
      },
      {
        shop: '旗舰',
        matrix: [['10', '20', '30'], ['40', '50', '60'], ['70', '80', '90']]
      },
      {
        shop: '南山',
        matrix: [['-', '-', '-'], ['-', '-', '-'], ['-', '-', '-']]
      }

    ],
    priceArrayValid: false,
    currentTabIndex: 0,
    priceSaving: false,
    showShopMatrix: true,
    moddingBaseInfo: false,
    moddingCategory: false,
    modRentItemCategory: false,
    changedCategories: [],
    rentItemCategoryWellFormed: false
  },

  handleSelect(e) {
    console.log('select', e)
  },
  handleCheck(e) {
    console.log('check', e)
    var that = this
    var changedCategories = that.data.changedCategories
    changedCategories.push(e.detail)
    that.setData({changedCategories})
    
  },

  getDataTree() {
    var that = this
    data.getAllRentCategoriesPromise().then(function (categories) {
      that.data.categories = categories
      var dataTree = that.convertDataTree(categories, true)
      that.setData({ dataTree: dataTree })
    })
  },
  convertDataTree(data, diabled) {
    var that = this
    var dataArr = []
    for (var i = 0; i < data.length; i++) {
      var leaf = { id: data[i].id, code: data[i].code, name: data[i].name, checked: false, open: false, disabled: diabled}
      //var childSelected = false
      for (var j = 0; j < that.data.selectedCode.length; j++) {
        var currentCode = that.data.selectedCode[j]
        if (currentCode.startsWith(leaf.code)) {
          leaf.open = true
          leaf.checked = true
        }
      }
      if (data[i].children != undefined && data[i].children != null) {
        leaf.children = this.convertDataTree(data[i].children, diabled)
      }
      dataArr.push(leaf)
    }
    return dataArr
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var id = options.id
    that.setData({ id: id })
    app.loginPromiseNew.then(function (resolve) {
      that.getPackage()
    })

  },

  getPackage() {
    var that = this
    data.getPackagePromise(that.data.id).then(function (rentPackage) {
      var selectedCode = []
      for (var i = 0; i < rentPackage.rentPackageCategoryList.length; i++) {
        selectedCode.push(rentPackage.rentPackageCategoryList[i].rentCategory.code)
      }
      rentPackage.need_save = false
      that.buildRentItemCategories(rentPackage)
      that.setData({ rentPackage: rentPackage, selectedCode: selectedCode })
      that.getDataTree()
    })
  },
  buildRentItemCategories(rentPackage){
    var that = this
    var rentItemCategories = []
    var categoryList = rentPackage.rentPackageCategoryList
    var itemCount = rentPackage.item_count
    for(var i = 0; i < itemCount; i++){
      var rentItemCategory = {}
      rentItemCategory.itemIndex = i
      if (categoryList!=null){
        rentItemCategory.categories = that.getCategories(categoryList, i)
      }
      else{
        var category = {id: null}
        rentItemCategory.categories = [category]
      }
      rentItemCategories.push(rentItemCategory)
    }
    var rentItemCategoryWellFormed = thet.checkRentCategoryWellForm(rentItemCategories)
    that.setData({rentItemCategories, rentItemCategoryWellFormed})
    /*
    for(var i = 0; i < rentPackage.rentPackageItemCategories.length; i++){
      var categories = that.getCategories()
    }
    */
  },
  checkRentCategoryWellForm(rentItemCategories){
    var wellFormed = true
    for(var i = 0; wellFormed && i < rentItemCategories.length; i++){
      var rentItem = rentItemCategories[i]
      if (!rentItem.categories || rentItem.categories.length == 0){
        wellFormed = false
      }
    }
    return wellFormed
  },
  getCategories(rentPackageCategoryList, itemIndex){
    var categories = []
    for(var i = 0; i < rentPackageCategoryList.length; i++){
      if (rentPackageCategoryList[i].item_index == itemIndex){
        categories.push(rentPackageCategoryList[i].rentCategory)
      }
    }
    return categories
  },
  keyInput(e) {
    var that = this
    var v = e.detail.value
    var id = e.currentTarget.id
    var rentPackage = that.data.rentPackage
    switch (id) {
      case 'name':
        //rentPackage.name = v
        that.data.modedName = v
        rentPackage.need_save = true
        break
      case 'description':
        //rentPackage.description = v
        that.data.modedDescription = v
        rentPackage.need_save = true
        break
      case 'deposit':
        if (isNaN(v) || v.toString().trim() == '') {
          rentPackage.need_save = false
          wx.showToast({
            title: '押金必须是数字。',
            icon: 'error'
          })
        }
        else {
          that.data.modedDeposit = parseFloat(v)
          rentPackage.need_save = true
        }
        break
      default:
        break
    }
  },
  setCancelModBaseInfo(e) {
    var that = this
    var rentPackage = that.data.rentPackage
    rentPackage.need_save = false
    that.setData({ rentPackage, modedDeposit: null, modedDescription: null, modedName: null, moddingBaseInfo: false })
  },
  setConfirmModBaseInfo(e) {
    var that = this
    wx.showModal({
      title: '确认修改？',
      content: '',
      complete: (res) => {
        if (res.cancel) {
          that.setCancelModBaseInfo(e)
        }

        if (res.confirm) {
          var rentPackage = that.data.rentPackage

          if (rentPackage.need_save) {
            if (!that.data.modedDeposit) {
              that.data.modedDeposit = rentPackage.deposit
            }
            if (!that.data.modedDescription) {
              that.data.modedDescription = rentPackage.description
            }
            if (!that.data.modedName) {
              that.data.modedName = rentPackage.name
            }

            data.updateRentPackagePromise(rentPackage.id, that.data.modedName, 
              that.data.modedDescription,
              that.data.modedDeposit, app.globalData.sessionKey, rentPackage.shop).then(function (rentPackage) {
                that.setData({ rentPackage })
                that.setCancelModBaseInfo(e)
              }).catch(function (exp) {
                that.setCancelModBaseInfo(e)
              })
          }
        }
      }
    })
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
  setModBaseInfo() {
    var that = this
    that.setData({ moddingBaseInfo: true })
  },
  setModCategory(){
    var that = this
    var dataTree = that.convertDataTree(that.data.categories, false)
    that.setData({dataTree, moddingCategory: true, changedCategories:[]})
  },
  setCancelModCategory(e){
    var that = this
    var dataTree = that.convertDataTree(that.data.categories, true)
    that.setData({dataTree, moddingCategory: false})
  },
  setConfirmModCategory(e){
    var that = this
    var changedCategories = that.data.changedCategories
    for(var i = 0; i < changedCategories.length; i++){
      var cate = changedCategories[i]
      var act = cate.checked?'Add':'Del'
      data.modRentPackageCategory(that.data.id, cate.id, act, app.globalData.sessionKey).then(function (rentPackage){
        var categories = that.data.categories
        var selectedCode = []
        for(var i = 0; i < rentPackage.categories.length; i++){
          selectedCode.push(rentPackage.categories[i].code)
        }
        that.data.selectedCode = selectedCode
        var dataTree = that.convertDataTree(categories, true)
        that.setData({rentPackage, categories, dataTree})
        that.setCancelModCategory(e)
      }).then(function (exp){})
    }
  },
  del(){
    var that = this
    wx.showModal({
      title: '确认删除',
      content: '此操作不可逆。',
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          data.deleteRentPackagePromise(that.data.id, app.globalData.sessionKey).then(function (rentPackage){
            wx.navigateBack()
          })
        }
      }
    })
  },
  setModRentItemCategory(e){
    var that = this
    that.setData({modRentItemCategory: true})
  },
  setCancelModRentItemCategory(e){
    var that = this
    that.getPackage()
    that.setData({modRentItemCategory: false})
  },
  delRentItemCategory(e){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var rentItemCategories = that.data.rentItemCategories 
    var rentItemCategory = rentItemCategories[parseInt(idArr[0])]
    var categories = rentItemCategory.categories
    var newCategories = []
    for(var i = 0; i < categories.length; i++){
      if (i != parseInt(idArr[1])){
        newCategories.push(categories[i])
      }
    }
    rentItemCategory.categories = newCategories
    that.setData({rentItemCategories})
    console.log('del cate', e)
  },
  setItemCount(e){
    var that = this
    var value = e.detail.value
    if (isNaN(value)){
      return
    }
    var rentPackage = that.data.rentPackage
    rentPackage.item_count = parseInt(value)
    that.buildRentItemCategories(rentPackage)
  },
  addRentItemCategory(e){
    var that = this
    var index = parseInt(e.currentTarget.id)
    that.setData({popUpContent: 'categorySelector', currentModRenItemIndex: index})
  },
  confirmCategory(e){
    console.log('selecte cate', e)
    var that = this
    var category = e.detail
    var rentItemCategories = that.data.rentItemCategories
    var index = that.data.currentModRenItemIndex
    rentItemCategories[index].categories.push(category)
    that.setData({rentItemCategories})
    that.cancelPopUp(e)
  },
  cancelPopUp(e){
    var that = this
    that.setData({popUpContent: null})
  },
  setConfirmModRentItemCategory(e){
    var that = this
    var rentItemCategories = that.data.rentItemCategories
    console.log('updated rentItemCategories', rentItemCategories)
    //var postUrl = app.globalData.requestPrefix + 'Rent/'
    data.updateRentPackageCategoryPromise(that.data.rentPackage.id, rentItemCategories, app.globalData.sessionKey).then(function(rentPackage){
      that.buildRentItemCategories(rentPackage)
      that.setData({rentPackage})
    })
  },
  shopSelected(e){
    var that = this
    var rentPackage = that.data.rentPackage
    rentPackage.shop = e.detail.shop
    rentPackage.need_save = true
    that.setData({rentPackage})
    console.log('shop', e)
  }
})
// pages/test/firstUI/rent_recept.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    maxCategoryColIndex: 0,
    categorySelectIndex: undefined,
    categorySelectText: '',
    packageSelectIndex: undefined

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {

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
  }
})
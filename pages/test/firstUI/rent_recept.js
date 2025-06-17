// pages/test/firstUI/rent_recept.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    multiArray: [['无脊柱动物', '脊柱动物'], ['扁性动物', '线形动物', '环节动物', '软体动物', '节肢动物'], ['猪肉绦虫', '吸血虫']]
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
      that.getAllCategories()
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

    
  },
  getAllCategories1(){
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Rent/GetAllCategoryList'
    util.performWebRequest(getUrl, null).then(function(resovle){
      var categories = resovle
      console.log('get categories', categories)
      var catePickerList = [categories]






      var pickerArr = []
      var topArr = []
      for(var i = 0; i < categories.length; i++){
        topArr.push(categories[i])
      }
      pickerArr.push(topArr)
      pickerArr.push([])
      that.setData({categories, pickerCateArr: pickerArr})
      that.setSubcatePicker(0)
    })
  },
  setSubcatePicker(index){
    var that = this
    var pickerCateArr = that.data.pickerCateArr
    pickerCateArr.pop()
    var subArr = []
    var categories = that.data.categories
    var subcategories = categories[index].children
    for(var i = 0; subcategories && i < subcategories.length; i++){
      subArr.push(subcategories[i])
    }
    pickerCateArr.push(subArr)
    that.setData({pickerCateArr})
  },
  selectCategory(e){
    console.log('sel cate', e)
    var that = this
    var column = e.detail.column
    switch(column){
      case 0:
        that.setSubcatePicker(e.detail.value)
        break
      case 1:
        break
      default:
        break
    }
  },
  selectCategoryOk(e){
    var that = this
    console.log('sel ok', e)
  }
})
// pages/admin/fd/fd_category_prod_list.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {

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
    app.loginPromiseNew.then(function (resovle){
      that.getCategory()
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
  getCategory() {
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Category/GetSingleLevelCategory?bizType=' + encodeURIComponent('餐饮')
    util.performWebRequest(getUrl, null).then(function (resolve){
      var categories = resolve
      for (var i = 0; categories && i < categories.length; i++){
        if (categories[i].hide == 1){
          categories[i].name = '【隐】'+categories[i].name
        }
      }
      var vtabs = categories.map(item => ({title: item.name, id: item.id}))
      console.log('category', categories)
      console.log('vtab', vtabs)
      that.setData({categories, vtabs})
      that.getProductList()
    })
  },
  onChange(e){
    console.log('tab change', e)
  },
  onTabCLick(e){
    console.log('bind tab click', e)
  },
  getProductList(){
    var that = this
    var categories = that.data.categories
    for(var i = 0; i < categories.length; i++){
      that.getCategoryProductList(categories[i].id)
    }
  },
  getCategoryProductList(categoryId){
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Category/GetCategoryProducts/' + categoryId.toString() + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, null).then(function (resolve){
      var categories = that.data.categories
      var category = null
      var products = resolve
      for(var i = 0; products && i < products.length; i++){
        var product = products[i]
        product.sale_priceStr = util.showAmount(product.sale_priceStr)
        product.stock_numStr = product.stock_num? product.stock_num.toString() : '——'
        product.imageUrl = product.availableImages.length == 0? '' : 'https://' + app.globalData.domainName + product.availableImages[0].image_url
      }
      for(var i = 0; i < categories.length; i++){
        if (categories[i].id == categoryId){
          category = categories[i]
          break
        }
      }
      if (category != null){
        category.products = resolve
      }
      that.setData({categories})
    })
  },
  modProdlist(e){
    var that = this
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'fd_category_prod_list_mod?categoryId=' + id
    })
  }
})
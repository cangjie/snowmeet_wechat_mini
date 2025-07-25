// pages/admin/fd/fd_category_prod_list_mod.js
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
    var that = this
    if (options.categoryId){
      that.setData({categoryId: options.categoryId})
    }
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
      console.log('category', categories)
      var selectedCategory = null
      if (that.data.categoryId){
        for(var i = 0; categories && i < categories.length; i++){
          if (categories[i].id == that.data.categoryId){
            selectedCategory = categories[i]
            break
          }
          
        }
      }
      that.setData({categories, selectedCategory})
      if (selectedCategory){
        that.getProductList(selectedCategory.id)
      }
    })
  },
  getProductList(categoryId){
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Category/GetCategoryProducts/' + categoryId.toString() + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, null).then(function (resolve){
      var products = resolve
      for(var i = 0; products && i < products.length; i++){
        var product = products[i]
        product.sale_priceStr = util.showAmount(product.sale_price)
        product.stock_numStr = product.stock_num? product.stock_num.toString() : '——'
        product.imageUrl = product.availableImages.length == 0? '' : 'https://' + app.globalData.domainName + product.availableImages[0].image_url
      }
      that.setData({products})
    })
  },
  addNew(e){
    var that = this
    var category = that.data.selectedCategory
    var url = 'fd_add_prod'
    if (category){
      url = url + '?categoryId=' + category.id
    }
    wx.navigateTo({
      url: url,
    })
  },
  gotoDetail(e){
    var that = this
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'fd_add_prod?productId=' + id,
    })
  },
  selectCategory(e){
    var that = this
    console.log('select category', e)
    var categories = that.data.categories
    var selectedCategory = categories[parseInt(e.detail.value)]
    that.setData({selectedCategory})
    that.getProductList(selectedCategory.id)
  },
  sortChange(e) {
    console.log('sortChange', e)
    //return
    var that = this
    var sort = e.detail.sort
    var products = that.data.products
    var maxSort = products.length * 100
    for(var i = 0; i < products.length; i++){
      var product = products[i]
      product.sort = maxSort - sort[i] * 100 + 100
    }
    var newProducts = products.sort((a, b)=>b.sort - a.sort)
    for(var i = 0; i < newProducts.length; i++){
      that.updateProduct(newProducts[i])
    }
    that.setData({products: newProducts})
  },
  posChange(e) {
    console.log('posChange', e)
    wx.vibrateShort({
       type: 'heavy'
    })
  },
  updateProduct(product){
    var that = this
    //var product = that.data.product
    var updateUrl = app.globalData.requestPrefix + 'Category/ModProduct?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(updateUrl, product).then(function (resolve){
      console.log('product updated', product)
      that.getProductList(that.data.selectedCategory.id)
    })
  },
  del(e){
    console.log('del', e)
    var that = this
    var id = parseInt(e.currentTarget.id)
    var product = that.getProduct(id)
    if (!product){
      return
    }
    product.valid = 0
    that.updateProduct(product)
  },
  getProduct(id){
    var that = this
    var product = null
    var products = that.data.products
    for(var i = 0; products && i < products.length; i++){
      if (products[i].id == id){
        product = products[i]
        break
      }
    }
    return product
  }
})
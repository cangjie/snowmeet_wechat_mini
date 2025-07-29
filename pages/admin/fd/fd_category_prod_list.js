// pages/admin/fd/fd_category_prod_list.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    showVtabs: true,
    vtabHeight: 1000,
    showCart: false,
    cartUrl: '',
    cart: [],
    cartCount: 0,
    totalPriceStr: '¥0.00'
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
    app.loginPromiseNew.then(function (resovle) {
      that.getCategory()
      var vtabHeight = app.globalData.systemInfo.pixelRatio * app.globalData.systemInfo.screenHeight * 0.55
      var cartUrl = 'https://' + app.globalData.domainName + '/images/icons/cart.png'
      that.setData({ vtabHeight, showVtabs: false, cartUrl })
      that.setData({ showVtabs: true })
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
    util.performWebRequest(getUrl, null).then(function (resolve) {
      var categories = resolve
      for (var i = 0; categories && i < categories.length; i++) {
        if (categories[i].hide == 1) {
          categories[i].name = '【隐】' + categories[i].name
        }
      }
      var vtabs = categories.map(item => ({ title: item.name, id: item.id }))
      console.log('category', categories)
      console.log('vtab', vtabs)
      that.setData({ categories, vtabs })
      that.getProductList()
    })
  },
  onChange(e) {
    console.log('tab change', e)
  },
  onTabCLick(e) {
    console.log('bind tab click', e)
  },
  getProductList() {
    var that = this
    var categories = that.data.categories
    for (var i = 0; i < categories.length; i++) {
      that.getCategoryProductList(categories[i].id)
    }
  },
  getCategoryProductList(categoryId) {
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Category/GetCategoryProducts/' + categoryId.toString() + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, null).then(function (resolve) {
      var categories = that.data.categories
      var category = null
      var products = resolve
      for (var i = 0; products && i < products.length; i++) {
        var product = products[i]
        product.sale_priceStr = util.showAmount(product.sale_price)
        product.stock_numStr = product.stock_num ? product.stock_num.toString() : '——'
        product.imageUrl = product.availableImages.length == 0 ? '' : 'https://' + app.globalData.domainName + product.availableImages[0].imageUrl
        product.count = 1

      }
      for (var i = 0; i < categories.length; i++) {
        if (categories[i].id == categoryId) {
          category = categories[i]
          break
        }
      }
      if (category != null) {
        category.products = resolve
        for (var i = 0; category.products && i < category.products.length; i++) {
          var cartType = ''
          var product = category.products[i]
          if (category.on_shelves == 1 && product.on_shelves == 1 && product.sell_out == 0) {
            cartType = '零售'
          }
          else {
            if (product.sell_out == 0) {
              cartType = '出库'
            }
          }
          product.cartType = cartType
        }
      }

      that.setData({ categories, showVtabs: false })
      that.setData({ showVtabs: true })
    })
  },
  modProdlist(e) {
    var that = this
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'fd_category_prod_list_mod?categoryId=' + id
    })
  },
  popCart() {
    var that = this
    var showCart = that.data.showCart
    showCart = !showCart
    that.setData({ showCart })
  },
  closePopup() {
    var that = this
    that.popCart()
  },
  addCart(e){
    var that = this
    var id = parseInt(e.currentTarget.id)
    var cart = that.data.cart
    var categories = that.data.categories
    var product = that.getProduct(id)
    if (product == null){
      return
    }
    var cartItem = that.getCartItem(product.id, product.cartType)
    if (cartItem == null){
      cartItem = Object.assign({}, product)
      cart.push(cartItem)
    }
    else{
      cartItem.count = cartItem.count + product.count
    }
    product.count = 1
    product.cartMemo = ''
    that.setData({cart, categories})
    that.countCart()
  },
  countCart(){
    var that = this
    var cart = that.data.cart
    var count = 0
    var totalPrice = 0
    for(var i = 0;  cart && i < cart.length; i++){
      count = count + cart[i].count
      
      if (cart[i].cartType == '零售'){
      cart[i].summaryStr = util.showAmount(cart[i].sale_price * cart[i].count)
      totalPrice = totalPrice + cart[i].sale_price * cart[i].count
      }
      else{
        cart[i].summaryStr = '¥0.00'
      }
    }
    that.setData({cartCount: count, totalPrice, totalPriceStr: util.showAmount(totalPrice), cart})
  },
  setCartMemo(e){
    var that = this
    var id = e.currentTarget.id
    var value = e.detail.value
    var product = that.getProduct(id)
    if (product == null){
      return
    }
    product.cartMemo = value
    var categories = that.data.categories
    that.setData({categories})
  },
  getCartItem(productId, type){
    var that = this
    var item = null
    var cart = that.data.cart
    for(var i = 0; cart && i < cart.length; i++){
      if (cart[i].id == productId && cart[i].cartType == type){
        item = cart[i]
        break
      }
    }
    return item
  },
  getProduct(id){
    var that = this
    var product = null
    var categories = that.data.categories
    for(var i = 0; i < categories.length; i++){
      for(var j = 0; categories[i] && categories[i].products && j < categories[i].products.length; j++){
        if (categories[i].products[j] && categories[i].products[j].id == id){
          product = categories[i].products[j]
          break
        }
      }
    }
    return product
  },
  setCartType(e){
    console.log('select cart type', e)
    var that = this
    var categories = that.data.categories
    var id = parseInt(e.currentTarget.id)
    var product = that.getProduct(id)
    if (product == null){
      return
    }
    product.cartType = e.detail.value
    that.setData({categories})
  },
  setCount(e){
    console.log('set cart count', e)
    var that = this
    var id = parseInt(e.currentTarget.id)
    var product = that.getProduct(id)
    if (product == null){
      return
    }
    var value = e.detail.value
    if (isNaN(value)){
      wx.showToast({
        title: '必须是数字',
        icon: 'error'
      })
      return
    }
    product.count = parseInt(value)
    var categories = that.data.categories
    that.setData({categories})
  },
  modCartItemCount(e){
    var that = this
    var value = e.detail.value
    var id = parseInt(e.currentTarget.id)
    var cart = that.data.cart
    if (isNaN(value)){
      return
    }
    if (parseInt(value) == 0){
      that.delCart(e)
      return
    }
    var item = cart[id]
    item.count = parseInt(value)
    that.setData({cart})
    that.countCart()
  },
  delCart(e){
    var that = this
    var id = parseInt(e.currentTarget.id)
    var cart = that.data.cart
    var newCart = []
    for(var i = 0; cart && i < cart.length; i++){
      if (i != id){
        newCart.push(cart[i])
      }
    }
    that.setData({cart: newCart})
    that.countCart()
  },
  placeOrder(){
    var that = this
    var cart = that.data.cart
    var order = {
      id: 0,
      shop: '崇礼旗舰店',
      type: '餐饮',
      total_amount: that.data.totalPrice,
      single_payment: 1
    }
    var fdOrders = []
    var isOutStockOrder = true
    for(var i = 0; cart &&i < cart.length; i++){
      var fdOrder = {
        id: 0,
        order_id: order.id,
        product_id: cart[i].id,
        product_name: cart[i].name,
        unit_price: cart[i].sale_price,
        order_type: cart[i].cartType,
        count: cart[i].count,
        memo: cart[i].cartMemo?  cart[i].cartMemo : ''
      }
      if (cart[i].cartType!='出库'){
        isOutStockOrder = false
      }
      fdOrders.push(fdOrder)
    }
    if(!fdOrders || fdOrders.length <= 0){
      wx.showToast({
        title: '不允许空订单',
        icon: 'error'
      })
      return
    }
    order.fdOrders = fdOrders
    if (isOutStockOrder){
      order.sub_type = '出库订单'
    }
    else{
      order.sub_type = ''
    }
    console.log('place order', order)
    var placeUrl = app.globalData.requestPrefix + 'Order/PlaceOrder?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(placeUrl, order).then(function (resolve){
      console.log('order', resolve)
      var order = resolve
      wx.redirectTo({
        url: 'fd_order_confirm?orderId=' + order.id.toString(),
      })
    })
  }
})
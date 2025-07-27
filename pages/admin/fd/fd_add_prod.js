// pages/admin/fd/fd_add_prod.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    product:{
      id: 0,
      valid: 1,
      on_shelves: 1,
      no_entrain: 0,
      hidden: 0,
      stock_num: 0
    }
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    if (options.productId){
      that.setData({productId: options.productId})
      wx.setNavigationBarTitle({
        title: '【餐饮】修改商品信息',
      })
      that.getProudct(options.productId)
    }
    else if (options.categoryId){
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
    app.loginPromiseNew.then(function(resolve){
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
  getCategory(){
    var that = this
    var product = that.data.product
    var url = app.globalData.requestPrefix + 'Category/GetSingleLevelCategory?bizType=' + encodeURIComponent('餐饮')
    util.performWebRequest(url, null).then(function(resolve){
      var categories = resolve
      if (that.data.categoryId){
        for(var i = 0; categories && i < categories.length; i++){
          if (categories[i].id == that.data.categoryId){
            product.category_id = categories[i].id
            that.setData({selectedCategory: categories[i], product})
            break
          }
        }
      }
      that.setData({categories})
    })
  },
  selectCategory(e){
    var that = this
    var categories = that.data.categories
    var selectedCategory = categories[parseInt(e.detail.value)]
    var product = that.data.product
    product.category_id = selectedCategory.id
    that.setData({selectedCategory})
  },
  input(e){
    var that = this
    var product = that.data.product
    var id = e.currentTarget.id
    var value = e.detail.value
    switch(id){
      case 'name':
        product.name = value
        break
      case 'content':
        product.content = value
        break
      case 'price':
        product.sale_price = value
        break
      case 'stock_num':
        product.stock_num = value
        break
      case 'delta_stock_num':
        product.delta_stock_num = value  
      break
      default:
        break
    }
  },
  uploadImage(){
    var that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      sizeType:['compressed'],
      success: (res)=>{
        console.log('get image', res)
        var imagePath = res.tempFiles[0].tempFilePath
        var uploadUrl =  'https://' + app.globalData.domainName + '/api/UploadFile/UploadFile?sessionKey=' + app.globalData.sessionKey + '&purpose=' + encodeURIComponent('餐饮商品图片') + '&isWeb=true'
        wx.uploadFile({
          filePath: imagePath,
          name: 'file',
          url: uploadUrl,
          success:(res)=>{
            console.log('file uploaded', res)
            if (res.statusCode != 200){
              wx.showToast({
                title: '上传失败' + res.statusCode.toString(),
                icon: 'error'
              })
              return
            }
            var upload = JSON.parse(res.data)
            var product = that.data.product
            var imgId = 0
            if (product.images && product.images.length > 0){
              imgId = product.images[0].id
            }
            product.images = [{
              id: imgId, 
              product_id: product.id,
              upload_id: upload.id,
              valid: 1,
              is_head: 1,
              uploadFile: upload
            }]
            product.availableImages = product.images
            var productImageUrl = 'https://' + app.globalData.domainName + product.availableImages[0].uploadFile.file_path_name
            that.setData({product, productImageUrl})
          }
        })
      }
    })
  },
  setOnShelves(e){
    var that = this
    var product = that.data.product
    product.on_shelves = e.detail.value? 1: 0
    that.setData({product})
  },
  setNoStock(e){
    var that = this
    var product = that.data.product
    product.need_no_stock = e.detail.value? 1: 0
    if (product.need_no_stock == 1){
      product.stock_num = null
    }
    else{
      product.stock_num = 0
    }
    that.setData({product})
  },
  add(e){
    var that = this
    var msg = that.checkValid()
    if (msg != ''){
      wx.showToast({
        title: msg,
        icon: 'error'
      })
      return
    }
    console.log('add product', that.data.product)
    var product = that.data.product
    if (!product.images || product.images.length == 0){
      wx.showModal({
        title: '商品未上传图片',
        content: '点击确认继续添加商品，点就取消可以继续上传图片',
        complete: (res) => {
          if (res.cancel) {  
          }
          if (res.confirm) {
            that.submitAdd()
          }
        }
      })
      return
    }
    wx.showModal({
      title: '确认添加商品？',
      content: '',
      complete: (res) => {
        if (res.cancel) {  
        }
        if (res.confirm) {
          that.submitAdd()
        }
      }
    })
  },
  submitAdd(){
    var that = this
    var product = that.data.product
    if (product.need_no_stock == 1){
      product.stock_num = null
    }
    for(var i = 0; product.images && i < product.images.length; i++){
      product.images[i].uploadFile = null
    }
    var addUrl = app.globalData.requestPrefix + 'Category/AddProduct?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(addUrl, product).then(function(resolve){
      console.log('add product', resolve)
      wx.showModal({
        title: '添加商品成功',
        content: '',
        cancelText:'返回分类',
        confirmText: '继续添加',
        complete: (res) => {
          if (res.cancel) {
            wx.navigateTo({
              url: 'fd_category_prod_list_mod?categoryId=' + that.data.product.category_id,
            })
          }
      
          if (res.confirm) {
            wx.navigateTo({
              url: 'fd_add_prod?categoryId=' + that.data.product.category_id,
            })
          }
        }
      })
    })
  },
  checkValid(){
    var that = this
    var product = that.data.product
    var msg = ''
    if (isNaN(product.category_id)){
      msg = '未选分类'
    }
    if (product.name == null || product.name == undefined){
      msg = '名称不正确'
    }
    if (isNaN(product.sale_price)){
      msg = '价格必须是数字'
    }
    
    return msg
  },
  setPropertyRadioChange(e){
    console.log('property change', e)
    var that = this
    var product = that.data.product
    var id = parseInt(e.currentTarget.id)
    var value = e.detail.value
    var productProperty = {
      id: 0,
      product_id: product.id,
      category_property_id: id,
      option_id: value,
      text_value: null,
      valid: 1,
    }
    var find = false
    for(var i = 0; product.properties && i < product.properties.length; i++){
      var curProperty = product.properties[i]
      if (productProperty.category_property_id ==curProperty.category_property_id){
        curProperty.option_id = value
        find = true
        break
      }
    }
    if (!find){
      if (!product.properties){
        product.properties = []
      }
      product.properties.push(productProperty)
    }
    that.setData({product})
  },
  getProudct(id){
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Category/GetProduct/' + id.toString() + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, null).then(function (resolve){
      var product = resolve
      product.sale_priceStr = util.showAmount(product.sale_price)
      if (product.stock_num==null){
        product.need_no_stock = 1
      }
      else{
        product.need_no_stock = 0
      }
      product.stock_numStr = product.stock_num? product.stock_num.toString() : '——'
      //product.imageUrl = product.availableImages.length == 0? '' : 'https://' + app.globalData.domainName + product.availableImages[0].image_url
      var productImageUrl = null
      try{
        productImageUrl = 'https://' + app.globalData.domainName + product.availableImages[0].uploadFile.file_path_name
      }
      catch{

      }
      that.setData({product, selectedCategory: product.category, productImageUrl})
    })
  },
  mod(e){
    var that = this
    var product = that.data.product
    var updateUrl = app.globalData.requestPrefix + 'Category/ModProduct?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(updateUrl, product).then(function (resolve){
      console.log('product updated', product)
      wx.showModal({
        title: '商品信息已经更新',
        content: '',
        cancelText:'留在该页',
        confirmText:'返回列表',
        complete: (res) => {
          if (res.cancel) {
            
          }
      
          if (res.confirm) {
            wx.navigateBack()
          }
        }
      })
    }) 
  },
  showAddStock(e){
    var that = this
    that.setData({addingStock: true})
  },
  cancelAddStock(e){
    var that = this
    that.setData({addingStock: false})
  },
  confirmAddStock(e){
    var that = this
    var product = that.data.product
    if (isNaN(product.delta_stock_num)){
      wx.showToast({
        title: '必须是数字',
        icon: 'error'
      })
      return
    }
    var deltaStockNum = parseInt(product.delta_stock_num)
    var stockNum = product.stock_num == null? 0 : parseInt(product.stock_num)
    var title = '确认增加库存'
    var content = '原有库存：' + stockNum.toString() + ' 增加库存：' + deltaStockNum.toString() + ' 增加后库存：' + (deltaStockNum + stockNum).toString() + ' 点击确认立即生效。'
    wx.showModal({
      title: title,
      content: content,
      complete: (res) => {
        if (res.cancel) { 
        }
        if (res.confirm) {
          //product.stock_num = deltaStockNum + stockNum
          //that.setData({product})
          var updateUrl = app.globalData.requestPrefix + 'Category/UpdateProductStock/' + product.id.toString() + '?delta=' + deltaStockNum.toString() + '&scene=' + encodeURIComponent('界面增加库存') + '&sessionKey=' + app.globalData.sessionKey
          util.performWebRequest(updateUrl, null).then(function (resolve){
            var newProduct = resolve
            product.stock_num = newProduct.stock_num
            that.setData({product, addingStock: false})
          })
        }
      }
    }) 
  },
  setCheckbox(e){
    var that = this
    var product = that.data.product
    var optionArr = e.detail.value
    var hide = 1
    var no_entrain = 1
    var on_shelves = 0
    var sell_out = 0
    for(var i = 0; i < optionArr.length; i++){
      switch(optionArr[i]){
        case 'hidden':
          hide = 0
          break
        case 'no_entrain':
          no_entrain = 0
          break
        case 'on_shelves':
          on_shelves = 1
          break
        case 'sell_out':
          sell_out = 1
          break
        default:
          break
      }
    }
    product.hidden = hide
    product.no_entrain = no_entrain
    product.on_shelves = on_shelves
    product.sell_out = sell_out
    that.setData({product})
  }
})
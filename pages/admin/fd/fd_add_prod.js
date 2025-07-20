// pages/admin/fd/fd_add_prod.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    product:{}
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    if (options.id){
      that.setData({id: options.id})
      thatwx.setNavigationBarTitle({
        title: '【餐饮】修改商品信息',
      })
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
    var url = app.globalData.requestPrefix + 'Category/GetSingleLevelCategory?bizType=' + encodeURIComponent('餐饮')
    util.performWebRequest(url, null).then(function(resolve){
      var categories = resolve
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
            var upload = JSON.parse(res.data)
            var product = that.data.product
            product.images = [{
              id: 0, 
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
    if (product.need_no_stock){
      product.stock_num = null
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
    if (product.need_no_stock != 1 && isNaN(product.stock_num)){
      msg = '库存不正确'
    }
    return msg
  },
  setPropertyChange(e){
    console.log('property change', e)
    var that = this
    var product = that.data.product
    var id = e.currentTarget.id
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
  }
})
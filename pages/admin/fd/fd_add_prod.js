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
            var upload = res.data
            var product = that.data.product
            product.images = [{
              id: 0, 
              product_id: product.id,
              upload_id: upload.id,
              valid: 1,
              is_head: 1,
              uploadFile: JSON.parse(upload)
            }]
            product.availableImages = product.images
            var productImageUrl = 'https://' + app.globalData.domainName + product.availableImages[0].uploadFile.file_path_name
            that.setData({product, productImageUrl})

          }
        })
      }
    })
  }
})
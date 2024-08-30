// pages/admin/rent/settings/rent_product.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {

    priceArr:[
      {
        shop: '万龙',
        matrix:[['','',''],['','',''],['','','']]
      },
      {
        shop: '旗舰',
        matrix:[['','',''],['','',''],['','','']]
      },
      {
        shop: '南山',
        matrix:[['','',''],['','',''],['','','']]
      }
    ],
    formats: {},
    readOnly: false,
    placeholder: '开始输入...',
    editorHeight: 300,
    keyboardHeight: 0,
    isIOS: false,
    isBaseInfoEditing: false,
    isParameterEditing: false,
    isDescEditing: false,
    isCategoryEditing: false,
    html: '',
    images: ''
  },

  getCategories(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/RentSetting/GetCategoryById/' + that.data.product.category_id
    wx.request({
      url: url,
      method:'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          //that.setData({dataTree: [], selectedName: '', selectedCode: ''})
          return
        }
        var categoryCode = res.data.code
        that.setData({selectedCategory: res.data})
        categoryCode = categoryCode.substr(0, categoryCode.length - 2)
        url = 'https://' + app.globalData.domainName + '/core/RentSetting/GetCategory/' + categoryCode
        wx.request({
          url: url,
          method:'GET',
          success:(res)=>{
            if (res.statusCode != 200){
              that.setData({dataTree: [], selectedName: '', selectedCode: ''})
              return
            }
            var dataTree = this.convertCategoryTree(res.data.children)
            that.setData({dataTree: dataTree})
          }
        })

        
      }
    })
    
  },

  convertCategoryTree(data){
    var that = this
    var dataArr = []
    for(var i = 0; i < data.length; i++){
      var leaf = {id: data[i].id, code: data[i].code, name: data[i].name}
      if (data[i].children != undefined && data[i].children != null){
        leaf.children = that.convertCategoryTree(data[i].children)
      }
      dataArr.push(leaf)
    }
    return dataArr
  },
  getProduct(){
    var that = this
    var id = that.data.id
    var getUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/GetRentProduct/' + id.toString()
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        
        if (that.editorCtx != undefined && that.editorCtx != null){
          that.editorCtx.setContents({html: res.data.description})
        }
        //that.editorCtx.setContents({html: res.data.description})
        var images = ''
        for(var i = 0; i < res.data.images.length; i++){
          images = images + ((i == 0)?'':',') + res.data.images[i].image_url
        }

        that.setData({product: res.data, html: res.data.description, oriProduct: Object.assign({}, res.data), images: images})
        that.getProductCategoryInfo()
        that.getCategories()
      }
    })
  },
  getProductCategoryInfo(){
    var that = this
    var product = that.data.product
    var getUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/GetCategoryById/' + product.category_id.toString()
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        that.setData({category: res.data})
      }
    })
  },
  edit(e){
    var id = e.currentTarget.id
    var that = this
    var product = that.data.product
    switch(id){
      case 'baseInfo':
        that.setData({isBaseInfoEditing: true})
        break
      case 'parameter':
        that.setData({isParameterEditing: true})
        break
      case 'desc':
        that.setData({isDescEditing: true})
        //e.currentTarget.setContent({html:that.data.product.description})
        var editor = that.selectComponent('#editor')
        console.log('editor', editor)
        //.setContents({html: that.data.product.description})
        
        
        break
      case 'category':
        var dataTree = that.data.dataTree
        var selectedCategory = undefined
        for(var i = 0; i < dataTree.length; i++){
          if (dataTree[i].id == product.category_id){
            selectedCategory = dataTree[i]
            break
          }
        }
        that.setData({isCategoryEditing: true, selectedCategory: selectedCategory})
        break
      default:
        break
    }
  },
  cancel(e){
    var that = this
    var id = e.currentTarget.id
    var oriProduct = that.data.oriProduct
    var product = that.data.product
    switch(id){
      case 'baseInfo':
        product.name = oriProduct.name
        product.brand = oriProduct.brand
        product.owner = oriProduct.owner
        product.is_valid = oriProduct.is_valid
        product.is_online = oriProduct.is_online
        product.barcode = oriProduct.barcode
        product.count = oriProduct.count
        that.setData({isBaseInfoEditing: false, product: product})
        break
      case 'parameter':
        
        that.setData({isParameterEditing: false, product: product})
        break
      case 'desc':
        that.editorCtx.setContents({html: that.data.product.description})
        that.setData({isDescEditing: false, html: product.description})
        break
      case 'category':
        that.getCategories()
        that.setData({isCategoryEditing: false})
        break
      default:
        break
    }
  },
  save(e){
    var that = this
    var id = e.currentTarget.id
    var product = that.data.product
    switch(id){
      case 'baseInfo':
        that.setData({isBaseInfoEditing: false})
        that.saveBaseInfo()
        break
      case 'parameter':
        var postUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/UpdateRentProductDetailInfo/'
          + product.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
        var infos = []
        for(var i = 0; i < that.data.category.infoFields.length; i++){
          infos.push({product_id: product.id, field_id: that.data.category.infoFields[i].id, 
            info: that.data.category.infoFields[i].info})
        }
        wx.request({
          url: postUrl,
          method: 'POST',
          data: infos,
          success:(res) => {
            if (res.statusCode != 200){
              return
            }
            product = res.data
            that.setData({product: product})
          }
        })
        that.setData({isParameterEditing: false})
        break
      case 'desc':
        product.description = that.data.html
        that.setData({isDescEditing: false})
        that.saveBaseInfo()
        break
      case 'category':
        product.category_id = that.data.selectedCategory.id
        that.saveBaseInfo()

        that.setData({isCategoryEditing: false})
        break
      default:
        break
    }
  },
  inputBaseInfo(e){
    var that = this
    var product = that.data.product
    var id = e.currentTarget.id
    console.log('input', e)
    switch(id){
      case 'name':
        product.name = e.detail.value
        break
      case 'brand':
        product.brand = e.detail.value
        break
      case 'owner':
        product.owner = e.detail.value
        break
      case 'isValid':
        product.is_valid = e.detail.value?1:0
        break
      case 'isOnline':
        product.is_online = e.detail.value?1:0
        break
      case 'barcode':
        product.barcode = e.detail.value
        break
      case 'count':
        if (isNaN(e.detail.value)){
          wx.showToast({
            title: '只能填写数字',
            icon: 'error'
          })
        }
        else{
          product.count = parseInt(e.detail.value)
        }
        break
      default:
        break
    }
    that.setData({product: product})
  },
  saveBaseInfo(){
    var that = this
    var product = that.data.product
    if (isNaN(product.count) || product.count == null || product.count == ''){
      product.count = 1
    }
    var saveUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/ModRentProduct?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: saveUrl,
      method: 'POST',
      data: product,
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        that.getProduct()
      }

    })
  },
  inputHtml(e){
    console.log('input html', e)
    var that = this
    var html = that.data.html
    html = e.detail.html
    that.setData({html: html})
  },
  inputDetail(e){
    var that = this
    var id = e.currentTarget.id
    var product = that.data.product
    var value = e.detail.value
    var category = that.data.category
    var infoFields = category.infoFields
    for(var i = 0; i < infoFields.length; i++){
      if (infoFields[i].id == id){
        infoFields[i].info = value
        break
      }
    }

  },
  handleSelect(e){
    console.log('select category', e)
    var that = this
    if (that.data.isCategoryEditing){
      that.setData({selectedCategory: e.detail.item})
    }
  },
  shopSelected(e){
    console.log('shop selected', e)
    var that = this
    that.setData({selectedShop: e.detail.shop})
  },
  setShop(){
    var that = this
    var product = that.data.product
    product.shop = that.data.selectedShop
    that.saveBaseInfo()
    that.setData({product: product})
  },

  uploaded(e){
    console.log('upload file', e)
    var imageUrlArr = []
    for(var i = 0; i < e.detail.files.length; i++){
      imageUrlArr.push(e.detail.files[i].url)
    }
    var that = this
    var product = that.data.product
    var postUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/SetRentProductImage/' + product.id.toString() 
      + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: postUrl,
      method: 'POST',
      data: imageUrlArr,
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        that.getProduct()
      }
    })
  },

  del(){
    var that = this
    var product = that.data.product
    wx.showModal({
      title: '确认删除？',
      content: '此操作不可恢复。',
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          product.is_delete = 1
          that.saveBaseInfo()
          wx.navigateBack()
        }
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var id = options.id
    
    const platform = wx.getSystemInfoSync().platform
    const isIOS = platform === 'ios'
    this.setData({ isIOS, id})
   
    //this.updatePosition(0)
    let keyboardHeight = 0
    wx.onKeyboardHeightChange(res => {
      if (res.height === keyboardHeight) return
      const duration = res.height > 0 ? res.duration * 1000 : 0
      keyboardHeight = res.height
      that.updatePosition(keyboardHeight)
      that.editorCtx.scrollIntoView()
    })
    //that.getCategories()
    that.getProduct()
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
  updatePosition(keyboardHeight) {
    const toolbarHeight = 50
    const { windowHeight, platform } = wx.getSystemInfoSync()
    let editorHeight = keyboardHeight > 0 ? (windowHeight - keyboardHeight - toolbarHeight) : windowHeight
    this.setData({ editorHeight, keyboardHeight })
  },
  calNavigationBarAndStatusBar() {
    const systemInfo = wx.getSystemInfoSync()
    const { statusBarHeight, platform } = systemInfo
    const isIOS = platform === 'ios'
    const navigationBarHeight = isIOS ? 44 : 48
    return statusBarHeight + navigationBarHeight
  },
  onEditorReady() {
    const that = this
    wx.createSelectorQuery().select('#editor').context(function (res) {
      that.editorCtx = res.context
      if (that.data.product != null && that.data.product != undefined){
        that.editorCtx.setContents({html: that.data.product.description})
      }
      
    }).exec()
  },
  blur() {
    this.editorCtx.blur()
  },
  format(e) {
    let { name, value } = e.target.dataset
    if (!name) return
    console.log('format', name, value)
    this.editorCtx.format(name, value)

  },
  onStatusChange(e) {
    const formats = e.detail
    this.setData({ formats })
  },
  insertDivider() {
    this.editorCtx.insertDivider({
      success: function () {
        console.log('insert divider success')
      }
    })
  },
  clear() {
    this.editorCtx.clear({
      success: function (res) {
        console.log("clear success")
      }
    })
  },
  removeFormat() {
    this.editorCtx.removeFormat()
  },
  insertDate() {
    const date = new Date()
    const formatDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
    this.editorCtx.insertText({
      text: formatDate
    })
  },
  insertImage() {
    const that = this
    wx.chooseImage({
      count: 1,
      success: function (res) {
        that.editorCtx.insertImage({
          src: res.tempFilePaths[0],
          data: {
            id: 'abcd',
            role: 'god'
          },
          width: '80%',
          success: function () {
            console.log('insert image success')
          }
        })
      }
    })
  }
})
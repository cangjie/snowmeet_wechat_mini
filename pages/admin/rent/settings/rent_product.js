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
    isCategoryEditing: false
  },

  getCategories(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/RentSetting/GetCategory/01'
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
        that.setData({product: res.data, oriProduct: Object.assign({}, res.data)})
      }
    })
  },
  edit(e){
    var id = e.currentTarget.id
    var that = this
    switch(id){
      case 'baseInfo':
        that.setData({isBaseInfoEditing: true})
        break
      case 'parameter':
        that.setData({isParameterEditing: true})
        break
      case 'desc':
        that.setData({isDescEditing: true})
        break
      case 'category':
        that.setData({isCategoryEditing: true})
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
        that.setData({isParameterEditing: true})
        break
      case 'desc':
        that.setData({isDescEditing: true})
        break
      case 'category':
        that.setData({isCategoryEditing: true})
        break
      default:
        break
    }
  },
  save(e){
    var that = this
    var id = e.currentTarget.id
    //var product = that.data.product
    switch(id){
      case 'baseInfo':
        that.setData({isBaseInfoEditing: false})
        that.saveBaseInfo()
        break
      case 'parameter':
        that.setData({isParameterEditing: true})
        break
      case 'desc':
        that.setData({isDescEditing: true})
        break
      case 'category':
        that.setData({isCategoryEditing: true})
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
    that.getCategories()
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
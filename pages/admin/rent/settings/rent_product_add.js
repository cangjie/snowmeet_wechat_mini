// pages/admin/rent/settings/rent_product_add.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    inStock: true,
    currentShop: '',
    productName: '',
    category: undefined,
    canSubmit: false
  },
  setStock(e){
    var that = this
    var inStock = that.data.inStock
    inStock = e.detail.value
    that.setData({inStock: inStock})
    that.checkValid()
    console.log('set stock', e)
  },
  getCategories(){
    var that = this
    var getCatUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/GetAllCategories'
    wx.request({
      url: getCatUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var trees = res.data
        for(var i = 0; i < trees.length; i++){
          that.countDataTree(trees[i])
        }
        that.setData({dataTree: trees})
      }
    })
  },
  countDataTree(tree){
    var that = this
    var pCount = 0
    var pList = []
    if (tree.productList != undefined && tree.productList != null){
      pCount = tree.productList.length
      for(var i = 0; i < tree.productList.length; i++){
        var p = tree.productList[i]
        p.cateName =  tree.name + '/' 
          + ((p.cateName == null || p.cateName == undefined)? '' : p.cateName)
      }
      pList = tree.productList
    }
    else{
      tree.productList = pList
    }
    
    if (tree.children != undefined && tree.children != null){
      for(var i = 0; i < tree.children.length; i++){
        that.countDataTree(tree.children[i])
        pCount = pCount + tree.children[i].productCount
        var childPList = tree.children[i].productList
        if (childPList != undefined && childPList != null){
          for(var j = 0; j < childPList.length; j++){
            pList.push(childPList[j])
          }
        }
      }
    }
    tree.productCount = pCount
    tree.name = tree.name + '(' + pCount.toString() + ')'
  },
  checkValid(){
    var that = this
    var category = that.data.category
    if (that.data.inStock && that.data.currentShop == ''){
      that.setData({canSubmit: false})
    }
    else if (that.data.productName == ''){
      that.setData({canSubmit: false})
    }
    else if (category == undefined){
      that.setData({canSubmit: false})
    }
    else{
      that.setData({canSubmit: true})
    }
  },
  selectShop(e){
    var that = this
    console.log('shop select', e)
    var shopName = e.detail.shop
    that.setData({currentShop: shopName})
    that.checkValid()
  },
  setProductName(e){
    var that = this
    var productName = e.detail.value
    that.setData({productName: productName})
    that.checkValid()
  },
  handleSelect(e){
    var that = this
    var cate = e.detail.item
    that.setData({category: cate})
    var dataTree = that.checkCategory(that.data.dataTree)
    that.checkValid()
    that.setData({dataTree: dataTree})
    console.log('select category', e)
  },
  checkCategory(dataTree){
    var that = this
    var cate = that.data.category
    for(var i = 0; i < dataTree.length; i++){
      if (dataTree[i].children != null && dataTree[i].children != undefined 
        && dataTree[i].children.length > 0){
          dataTree[i].checked = false
          that.checkCategory(dataTree[i].children)
      }
      else if (dataTree[i].id == cate.id){
        dataTree[i].checked = true
      }
      else{
        dataTree[i].checked = false
      }
    }
    return dataTree
  },
  submit(e){
    var that = this
    var category = that.data.category
    var productName = that.data.productName
    var inStock = that.data.inStock
    var shop = that.data.currentShop
    if (!inStock){
      shop = ''
    }
    var msg = '名称：' + productName + ' 店铺：' + (inStock?shop:'未入库') + ' 分类：' + category.displayedCode + ' ' + category.name
    that.setData({canSubmit: false})
    wx.showModal({
      title: '添加租赁商品',
      content: msg,
      complete: (res) => {
        if (res.cancel) {
          that.setData({canSubmit: true})
        }
        if (res.confirm) {
          that.save()
        }
      }
    })
  },
  save(){
    var that = this
    var category = that.data.category
    var productName = that.data.productName
    var inStock = that.data.inStock
    var shop = that.data.currentShop
    if (!inStock){
      shop = null
    }
    var addUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/AddRentProduct/' + category.id + '?shop='
    + encodeURIComponent(shop) + '&name=' + encodeURIComponent(productName) + '&sessionKey=' 
    + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: addUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          that.setData({canSubmit: true})
          return
        }
        wx.showToast({
          title: '添加成功,即将进入详情页。',
          icon: 'success'
        })
        wx.redirectTo({
          url: 'rent_product?id=' + res.data.id,
        })
      }
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.getCategories()
    app.loginPromiseNew.then(function(resovle){

    })
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

  }
})
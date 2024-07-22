// pages/admin/rent/settings/rent_product_list.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    dataTree:[]
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
  handleSelect(e){
    var that = this
    var select = e.detail.item
    that.setData({selectedCategory: select})
    console.log('cat selected', select)
  },

  gotoDetail(e){
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'rent_product?id=' + id,
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.getCategories()
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
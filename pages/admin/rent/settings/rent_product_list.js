// pages/admin/rent/settings/rent_product_list.js
const app = getApp()
const data = require('../../../../utils/data.js')
const util = require('../../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    dataTree: []
  },

  getCategories() {
    var that = this
    var getCatUrl = app.globalData.requestPrefix + 'Rent/GetAllCategories'
    util.performWebRequest(getCatUrl, null).then(function (trees) {
      that.setData({ dataTree: trees })
      for (var i = 0; i < trees.length; i++) {
        var tree = trees[i]
        that.countDataTree(tree)
      }
    })
    /*
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
    */
  },

  countDataTree(tree) {
    var that = this
    var pCount = 0
    var pList = []
    data.getRentCategoryProductsPromise(tree.id).then(function (products) {
      tree.productList = products
      tree.productCount = products.length
      if (tree.productList != undefined && tree.productList != null) {
        //data.getRentCategoryProductsPromise(t)
        pCount = tree.productList.length
        for (var i = 0; i < tree.productList.length; i++) {
          var p = tree.productList[i]
          p.cateName = tree.name + '/'
            + ((p.cateName == null || p.cateName == undefined) ? '' : p.cateName)
        }
        pList = tree.productList
      }
      else {
        tree.productList = pList
      }

      if (tree.children != undefined && tree.children != null) {
        for (var i = 0; i < tree.children.length; i++) {
          var leaf = tree.children[i]
          that.countDataTree(leaf)
        }
      }
      tree.productCount = pCount
      tree.name = tree.name + '(' + pCount.toString() + ')'
      var dataTree = that.data.dataTree
      that.setData({dataTree})
    }).catch(function (exp) { })
  },
  handleSelect(e) {
    var that = this
    var select = e.detail.item
    that.setData({ selectedCategory: select })
    console.log('cat selected', select)
  },

  gotoDetail(e) {
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
    console.log('show')
    var that = this
    that.setData({ selectedCategory: null })

    that.getCategories()

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
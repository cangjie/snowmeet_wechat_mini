// pages/admin/fd/fd_category_prod_list.js
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
    app.loginPromiseNew.then(function (resovle){
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
      var vtabs = categories.map(item => ({title: item.name, id: item.id}))
      console.log('category', categories)
      console.log('vtab', vtabs)
      that.setData({categories, vtabs})
    })
  }
})
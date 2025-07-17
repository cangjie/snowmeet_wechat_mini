// pages/admin/fd/fd_category.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    newName: null
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
    app.loginPromiseNew.then(function (resolve){
      that.getData()
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
  addNewDialog(){
    var that = this
    if (!that.data.newName){
      wx.showToast({
        icon: 'error',
        title: '请填写名称'
      })
      return
    }
    wx.showModal({
      title: '确认添加新类目：',
      content: '名称：' + that.data.newName,
      complete: (res) => {
        if (res.cancel) {
          
        }
        if (res.confirm) {
          that.addNewCategory()
        }
      }
    })
  },
  setNewName(e){
    var that = this
    var newName = e.detail.value
    that.setData({newName})
  },
  addNewCategory(){
    var that = this
    var addUrl = app.globalData.requestPrefix + 'Category/AddNewCategory?name=' + encodeURIComponent(that.data.newName) + '&bizType=' + encodeURIComponent('餐饮') + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(addUrl, null).then(function(resolve){
      var categories = that.data.categories
      categories.push(resolve)
      that.setData({newName: null})
      that.renderCategories(categories)
    })
  },
  getData(){
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Category/GetSingleLevelCategory?bizType=' + encodeURIComponent('餐饮')
    util.performWebRequest(getUrl, null).then(function (resolve){
      console.log('get category', resolve)
      that.renderCategories(resolve)
    })
  },
  renderCategories(categories){
    var that = this
    that.setData({categories})
  },
  sortChange(e) {
    console.log('sortChange', e)
  },
  posChange(e) {
    console.log('posChange', e)
    wx.vibrateShort({
       type: 'heavy'
    })
  },
})
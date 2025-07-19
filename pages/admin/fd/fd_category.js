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
      that.getData()
      //that.renderCategories(categories)
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
    var that = this
    var sort = e.detail.sort
    var categories = that.data.categories
    var maxSort = categories.length * 100
    for(var i = 0; i < categories.length; i++){
      var category = categories[i]
      category.sort = maxSort - sort[i] * 100 + 100
    }
    var newCategories = categories.sort((a, b)=>b.sort - a.sort)
    for(var i = 0; i < newCategories.length; i++){
      that.updateCategory(newCategories[i], '修改排序')
    }
    that.setData({categories: newCategories})
  },
  posChange(e) {
    console.log('posChange', e)
    wx.vibrateShort({
       type: 'heavy'
    })
  },
  updateCategory(category, scene){
    var that = this
    var updateUrl = app.globalData.requestPrefix + 'Category/UpdateCategory?scene=' + encodeURIComponent(scene) + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(updateUrl, category).then(function (resolve){
      that.getData()
    }).catch(function(reject){
      wx.showToast({
        title: '更新失败',
        icon: 'error'
      })
    })
  },
  del(e){
    var that = this
    console.log('del', e)
    var id = parseInt(e.currentTarget.id)
    var categories = that.data.categories
    var newCategories = []
    var category = null
    for(var i = 0; i < categories.length; i++){
      if (categories[i].id == id){
        category = categories[i]
      }
      else{
        newCategories.push(categories[i])
      }
    }
    that.setData({categories: newCategories})
    if (category != null){
      category.valid = 0
      that.updateCategory(category, '删除')
    }
  },
  setModName(e){
    var that = this
    var id = parseInt(e.currentTarget.id)
    var value = e.detail.value
    var category = that.getCategory(id)
    if (category==null){
      return
    }
    category.modName = value
  },
  getCategory(id){
    var that = this
    var categories = that.data.categories
    var category = null
    for(var i = 0; i < categories.length; i++){
      if (categories[i].id == id){
        category = categories[i]
        break
      }
    }
    return category
  },
  saveMod(e){
    var that = this
    var id = parseInt(e.currentTarget.id)
    var category = that.getCategory(id)
    var categories = that.data.categories
    if (category == null){
      return
    }
    if (!category.modName || category.modName == category.name){
      wx.showToast({
        title: '名称未修改',
        icon: 'error'
      })
      return
    }
    var dup = false
    for(var i = 0; i < categories.length; i++){
      if (categories[i].name == category.modName){
        dup = true
        break
      }
    }
    if (dup){
      wx.showToast({
        title: '名称重复',
        icon: 'error'
      })
      return
    }
    wx.showModal({
      title: '修改名称',
      content: '名称由”' + category.name + '“修改成“' + category.modName + '”。',
      complete: (res) => {
        if (res.cancel) {
          
        }
        if (res.confirm) {
          category.name = category.modName
          that.updateCategory(category, '修改名称')
          wx.showToast({
            title: '修改成功',
            icon: 'success'
          })
        }
      }
    })
  }
})
// pages/admin/rent/settings/rent_package.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    selectedCode:[],
    
  },

  handleSelect(e){
    console.log('select', e)
  },
  handleCheck(e){
    console.log('check', e)
    var act = e.detail.checked? 'Add' : 'Del'
    var that = this
    var setUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/RentPackageCategory' 
    + act + '/' + that.data.rentPackage.id + '?code=' + e.detail.id 
    + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) 
    + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: setUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          wx.showToast({
            title: '报错失败',
            icon:'error'
          })
          return
        }
        that.getPackage()
      }
    })
  },

  getDataTree(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/RentSetting/GetAllCategories'
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var dataTree = this.convertDataTree(res.data)
        that.setData({dataTree: dataTree})
      }
    })

  },
  convertDataTree(data){
    
    var that = this
    
    var dataArr = []
    
    for(var i = 0; i < data.length; i++){
      var leaf = {id: data[i].code, name: data[i].name, checked: false, open: false}
      //var childSelected = false
      for(var j = 0; j < that.data.selectedCode.length; j++){
        var currentCode = that.data.selectedCode[j]
        if (currentCode.startsWith(leaf.id)){
          leaf.open = true
          leaf.checked = true
        }
      }
      if (data[i].children != undefined && data[i].children != null){
        leaf.children = this.convertDataTree(data[i].children)
      }
      dataArr.push(leaf)
    }
    return dataArr
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var id = options.id
    that.setData({id: id})
    app.loginPromiseNew.then(function(resolve){
      that.getPackage()
      //that.getDataTree()

    })
    
  },

  getPackage(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/GetRentPackage/' + that.data.id
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var rentPackage = res.data
        var selectedCode = []
        for(var i = 0; i < rentPackage.rentPackageCategoryList.length; i++){
          selectedCode.push(rentPackage.rentPackageCategoryList[i].category_code)
        }
        rentPackage.need_save = false
        that.setData({rentPackage: rentPackage, selectedCode: selectedCode})
        that.getDataTree()
      }
    })
  },

  keyInput(e){
    var that = this
    var v = e.detail.value
    var id = e.currentTarget.id
    var rentPackage = that.data.rentPackage
    switch(id){
      case 'name':
        rentPackage.name = v
        rentPackage.need_save = true
        break
      case 'description':
        rentPackage.description = v
        rentPackage.need_save = true
        break
      case 'deposit':
        rentPackage.deposit = v
        if (isNaN(v) || v.toString().trim() == ''){
          rentPackage.need_save = false
          wx.showToast({
            title: '押金必须是数字。',
            icon: 'error'
          })
        }
        else {
          rentPackage.deposit = parseFloat(v)
          rentPackage.need_save = true
        }
        break
      default:
        break
    }
    that.setData({rentPackage: rentPackage})
  },
  saveBaseInfo(){
    var that = this
    var pack = that.data.rentPackage
    var saveUrl = 'https://' + app.globalData.domainName 
    + '/core/RentSetting/UpdateRentPackageBaseInfo/'
    + pack.id.toString() + '?name=' + encodeURIComponent(pack.name) 
    + '&description=' + encodeURIComponent(pack.description)
    + '&deposit=' + encodeURIComponent(pack.deposit.toString())
    + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: saveUrl,
      method:'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })
        that.getPackage()
      }
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
// pages/admin/rent/settings/rent_package.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    selectedCode:[],
    priceArr:[ 
      {
        shop: '万龙',
        matrix:[['1', '2', '3'], ['4', '5','6'], ['7', '8', '9']]
      },
      {
        shop: '旗舰',
        matrix:[['10', '20', '30'], ['40', '50','60'], ['70', '80', '90']]
      },
      {
        shop: '南山',
        matrix:[['-', '-', '-'], ['-', '-','-'], ['-', '-', '-']]
      }

    ],
    priceArrayValid: false,
    currentTabIndex: 0,
    priceSaving: false
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
        that.createPriceMatrix()
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
  modPrice(e){
    console.log('mod price', e)
    var that = this
    var priceArr = that.data.priceArr
    var shopIndex = e.detail.currentShopIndex
    var x = e.detail.x
    var y = e.detail.y
    var v = e.detail.value
    priceArr[shopIndex].matrix[x][y] = v
    that.setData({priceArr: priceArr})
    that.checkPriceValid()
  },

  createPriceMatrix(){
    var that = this
    var rentPackage = that.data.rentPackage
    var priceList = rentPackage.rentPackagePriceList
    var matrix = [
      {shop: '万龙', matrix:[['','',''],['','',''],['','','']]},
      {shop: '旗舰', matrix:[['','',''],['','',''],['','','']]},
      {shop: '南山', matrix:[['','',''],['','',''],['','','']]},
    ]
    for(var i = 0; i < priceList.length; i++){
      var price = priceList[i]
      var shopIndex = -1
      switch(price.shop){
        case '万龙体验中心':
          shopIndex = 0
          break
        case '崇礼旗舰店':
          shopIndex = 1
          break
        case '南山':
          shopIndex = 2
          break
        default:
          break
      }
      var y = -1
      switch(price.scene){
        case '门市':
          y = 0
          break
        case '预约':
          y = 1
          break
        case '会员':
          y = 2
          break
        default:
          break
      }
      var x = -1
      switch(price.day_type){
        case '平日':
          x = 0
          break
        case '周末':
          x = 1
          break
        case '节假日':
          x = 2
          break
        default:
          break
      }
      if (shopIndex != -1 && x != -1 && y != -1){
        matrix[shopIndex].matrix[x][y] = price.price
      }
    }
    that.setData({priceArr: matrix})
    that.checkPriceValid()
  },
  tabChange(e){
    console.log('tab change', e)
    var that = this
    that.setData({currentTabIndex: e.detail.index})
    that.checkPriceValid()
  },
  checkPriceValid(){
    var that = this
    var matrix = that.data.priceArr[that.data.currentTabIndex].matrix
    var valid = true
    for(var i = 0; i < matrix.length; i++){
      for(var j = 0; j < matrix[i].length; j++){
        var v = matrix[i][j]
        if (isNaN(v) || v.toString().trim() == ''){
          valid = false
          break
        }
      }
      if (!valid){
        break
      }
    }
    that.setData({priceArrayValid: valid})
  },

  savePriceArr(){
    var that = this
    that.setData({priceSaving: true, saveNum: 0})
    var tabIndex = that.data.currentTabIndex
    var shop = ''
    switch(tabIndex){
      case 0:
        shop = '万龙体验中心'
        break
      case 1:
        shop = '崇礼旗舰店'
        break
      case 2:
        shop = '南山'
        break
      default:
        break
    }
    var priceArr = that.data.priceArr
    var matrix = priceArr[tabIndex].matrix
    for(var i = 0; i < matrix.length; i++){
      for(var j = 0; j < matrix[i].length; j++){
        var scene = ''
        var dayType = ''
        var v = matrix[i][j]
        switch(i){
          case 0:
            dayType = '平日'
            break
          case 1:
            dayType = '周末'
            break
          case 2:
            dayType = '节假日'
            break
          default:
            break
        }
        switch(j){
          case 0:
            scene = '门市'
            break
          case 1:
            scene = '预约'
            break
          case 2:
            scene = '会员'
            break
          default:
            break
        }
        var saveUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/SetPackageRentPrice/' 
        + that.data.rentPackage.id.toString() + '?shop=' + encodeURIComponent(shop) 
        + '&dayType=' + encodeURIComponent(dayType) + '&scene=' + encodeURIComponent(scene)
        + '&price=' + encodeURIComponent(v) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
        wx.request({
          url: saveUrl,
          method: 'GET',
          success:(res)=>{
            if (res.statusCode != 200){
              wx.showToast({
                title: '价格保存失败',
                icon: 'error'
              })
            }
            var saveNum = that.data.saveNum
            saveNum++
            that.setData({saveNum: saveNum})
            if (saveNum == matrix.length * matrix[0].length){
              that.setData({priceSaving: false})
            }
          }
        })
      }
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
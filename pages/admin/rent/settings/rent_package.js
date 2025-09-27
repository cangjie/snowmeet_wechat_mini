// pages/admin/rent/settings/rent_package.js
const app = getApp()
const data = require('../../../../utils/data.js')
Page({

  /**
   * Page initial data
   */
  data: {
    selectedCode: [],
    priceArr: [
      {
        shop: '万龙',
        matrix: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']]
      },
      {
        shop: '旗舰',
        matrix: [['10', '20', '30'], ['40', '50', '60'], ['70', '80', '90']]
      },
      {
        shop: '南山',
        matrix: [['-', '-', '-'], ['-', '-', '-'], ['-', '-', '-']]
      }

    ],
    priceArrayValid: false,
    currentTabIndex: 0,
    priceSaving: false,
    showShopMatrix: true,
    moddingBaseInfo: false,
    moddingCategory: false,
    changedCategories: []
  },

  handleSelect(e) {
    console.log('select', e)
  },
  handleCheck(e) {
    console.log('check', e)
    var that = this
    var changedCategories = that.data.changedCategories
    changedCategories.push(e.detail)
    that.setData({changedCategories})
    /*
    var act = e.detail.checked ? 'Add' : 'Del'
    var that = this
    var setUrl = 'https://' + app.globalData.domainName + '/api/Rent/RentPackageCategory'
      + act + '/' + that.data.rentPackage.id + '?categoryId=' + e.detail.id
      + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: setUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode != 200) {
          wx.showToast({
            title: '报错失败',
            icon: 'error'
          })
          return
        }
        that.getPackage()
      }
    })
    */
  },

  getDataTree() {
    var that = this
    data.getAllRentCategoriesPromise().then(function (categories) {
      that.data.categories = categories
      var dataTree = that.convertDataTree(categories, true)
      that.setData({ dataTree: dataTree })
    })
  },
  convertDataTree(data, diabled) {
    var that = this
    var dataArr = []
    for (var i = 0; i < data.length; i++) {
      var leaf = { id: data[i].id, code: data[i].code, name: data[i].name, checked: false, open: false, disabled: diabled}
      //var childSelected = false
      for (var j = 0; j < that.data.selectedCode.length; j++) {
        var currentCode = that.data.selectedCode[j]
        if (currentCode.startsWith(leaf.code)) {
          leaf.open = true
          leaf.checked = true
        }
      }
      if (data[i].children != undefined && data[i].children != null) {
        leaf.children = this.convertDataTree(data[i].children, diabled)
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
    that.setData({ id: id })
    app.loginPromiseNew.then(function (resolve) {
      that.getPackage()
    })

  },

  getPackage() {
    var that = this
    data.getPackagePromise(that.data.id).then(function (rentPackage) {
      var selectedCode = []
      for (var i = 0; i < rentPackage.rentPackageCategoryList.length; i++) {
        selectedCode.push(rentPackage.rentPackageCategoryList[i].rentCategory.code)
      }
      rentPackage.need_save = false
      that.setData({ rentPackage: rentPackage, selectedCode: selectedCode })
      that.getDataTree()
    })
  },
  keyInput(e) {
    var that = this
    var v = e.detail.value
    var id = e.currentTarget.id
    var rentPackage = that.data.rentPackage
    switch (id) {
      case 'name':
        //rentPackage.name = v
        that.data.modedName = v
        rentPackage.need_save = true
        break
      case 'description':
        //rentPackage.description = v
        that.data.modedDescription = v
        rentPackage.need_save = true
        break
      case 'deposit':
        if (isNaN(v) || v.toString().trim() == '') {
          rentPackage.need_save = false
          wx.showToast({
            title: '押金必须是数字。',
            icon: 'error'
          })
        }
        else {
          that.data.modedDeposit = parseFloat(v)
          rentPackage.need_save = true
        }
        break
      default:
        break
    }
  },
  setCancelModBaseInfo(e) {
    var that = this
    var rentPackage = that.data.rentPackage
    rentPackage.need_save = false
    that.setData({ rentPackage, modedDeposit: null, modedDescription: null, modedName: null, moddingBaseInfo: false })
  },
  setConfirmModBaseInfo(e) {
    var that = this
    wx.showModal({
      title: '确认修改？',
      content: '',
      complete: (res) => {
        if (res.cancel) {
          that.setCancelModBaseInfo(e)
        }

        if (res.confirm) {
          var rentPackage = that.data.rentPackage

          if (rentPackage.need_save) {
            if (!that.data.modedDeposit) {
              that.data.modedDeposit = rentPackage.deposit
            }
            if (!that.data.modedDescription) {
              that.data.modedDescription = rentPackage.description
            }
            if (!that.data.modedName) {
              that.data.modedName = rentPackage.name
            }

            data.updateRentPackagePromise(rentPackage.id, that.data.modedName, that.data.modedDescription,
              that.data.modedDeposit, app.globalData.sessionKey).then(function (rentPackage) {
                that.setData({ rentPackage })
                that.setCancelModBaseInfo(e)
              }).catch(function (exp) {
                that.setCancelModBaseInfo(e)
              })
          }
        }
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

  },
  setModBaseInfo() {
    var that = this
    that.setData({ moddingBaseInfo: true })
  },
  setModCategory(){
    var that = this
    var dataTree = that.convertDataTree(that.data.categories, false)
    that.setData({dataTree, moddingCategory: true, changedCategories:[]})
  },
  setCancelModCategory(e){
    var that = this
    var dataTree = that.convertDataTree(that.data.categories, true)
    that.setData({dataTree, moddingCategory: false})
  },
  setConfirmModCategory(e){
    var that = this
    var changedCategories = that.data.changedCategories
    for(var i = 0; i < changedCategories.length; i++){
      var cate = changedCategories[i]
      var act = cate.checked?'Add':'Del'
      data.modRentPackageCategory(that.data.id, cate.id, act, app.globalData.sessionKey).then(function (rentPackage){
        var categories = that.data.categories
        var selectedCode = []
        for(var i = 0; i < rentPackage.categories.length; i++){
          selectedCode.push(rentPackage.categories[i].code)
        }
        that.data.selectedCode = selectedCode
        var dataTree = that.convertDataTree(categories, true)
        that.setData({rentPackage, categories, dataTree})
        that.setCancelModCategory(e)
      }).then(function (exp){})
    }
  }
})
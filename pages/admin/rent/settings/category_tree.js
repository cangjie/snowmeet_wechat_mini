// pages/admin/rent/settings/category_tree.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    isAdmin: false,
    selectedName: '',
    dataTree:[],
    newName:'',
    isSameLevel: false,
    nowAdding: false,
    selectedCategory:undefined,
    canDelete: false,
    shops:[

      {
        title: '万龙',
        title2: '',
        img: '',
        desc: '',
        shop: '万龙体验中心'
      },
      {
        title: '旗舰',
        title2: '',
        img: '',
        desc: '',
        shop: '崇礼旗舰店'
      },
      {
        title: '南山',
        title2: '',
        img: '',
        desc: '',
        shop: '南山'
      }
    ],
    priceArr:[['-','-','-'],['-','-','-'],['-','-','-']],
    canSave: false,
    canSaveMsg: '租金押金必须设置在最终一级的分类上。',
    currentShop: '万龙体验中心',
    currentShopIndex: 0,
    depositChanged: false,
    isSaving: false
  },

  getData(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/RentSetting/GetAllCategories'
    wx.request({
      url: url,
      method:'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          that.setData({dataTree: [], selectedName: '', selectedCode: ''})
          return
        }
        var dataTree = this.convertDataTree(res.data)
        that.setData({dataTree: dataTree})
      }
    })
    var selectedCode = that.data.selectedCode
    if (selectedCode != null  && selectedCode != ''){
      that.getSingleCategory(selectedCode)
    }
  },

  getSingleCategory(code){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/RentSetting/GetCategory/' + code
    wx.request({
      url: url,
      method:'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var cat = res.data

        if (cat.children != null){
          cat.deposit = '-'
        }

        //selectedCategory = res.data
        that.setData({selectedCategory: cat})
        that.checkValid()
        if (cat.children == undefined || cat.children == null || 
            (  cat.priceList != undefined && cat.priceList != null && cat.priceList.length > 0 )){
          that.setCategoryPriceArr()
        }
        else{
            var shopPriceArr = [ [['-','-','-'],['-','-','-'],['-','-','-']],
            [['-','-','-'],['-','-','-'],['-','-','-']],[['-','-','-'],['-','-','-'],['-','-','-']],]
            cat.deposit = '-'

            that.setData({selectedCategory: cat, shopPriceArr})
        }
        
      }
    })
  },

  setCategoryPriceArr(){
    var that = this
    var shopPriceArr = [[['','',''],['','',''],['','','']],
    [['','',''],['','',''],['','','']],[['','',''],['','',''],['','','']]]
    var cat = that.data.selectedCategory
    var shop = that.data.shops[that.data.currentShopIndex].shop
    for(var i = 0; cat != null && cat != undefined && cat.priceList != null && cat.priceList != undefined
        && i < cat.priceList.length; i++ ){
      var price = cat.priceList[i]
      var shopIndex = that.data.currentShopIndex
      var dayType = price.day_type
      var scene = price.scene
      if (price.shop == shop && dayType == '平日' && scene == '门市'){
        shopPriceArr[shopIndex][0][0] = price.price
      }

      if (price.shop == shop && dayType == '平日' && scene == '预约'){
        shopPriceArr[shopIndex][0][1] = price.price
      }

      if (price.shop == shop && dayType == '平日' && scene == '会员'){
        shopPriceArr[shopIndex][0][2] = price.price
      }

      if (price.shop == shop && dayType == '周末' && scene == '门市'){
        shopPriceArr[shopIndex][1][0] = price.price
      }

      if (price.shop == shop && dayType == '周末' && scene == '预约'){
        shopPriceArr[shopIndex][1][1] = price.price
      }

      if (price.shop == shop && dayType == '周末' && scene == '会员'){
        shopPriceArr[shopIndex][1][2] = price.price
      }

      if (price.shop == shop &&  dayType == '节假日' && scene == '门市'){
        shopPriceArr[shopIndex][2][0] = price.price
      }

      if (price.shop == shop && dayType == '节假日' && scene == '预约'){
        shopPriceArr[shopIndex][2][1] = price.price
      }

      if (price.shop == shop && dayType == '节假日' && scene == '会员'){
        shopPriceArr[shopIndex][2][2] = price.price
      }
    }
    that.setData({shopPriceArr: shopPriceArr})
    that.checkValid()
  },

  getShopIndex(shopName){
    var that = this
    var shops = that.data.shops
    var index = -1
    for(var i = 0; i < shops.length; i++){
        if (shops[i].shop == shopName){
            index = i
            break
        }
    }
    return index
  },
  
  convertDataTree(data){
    var dataArr = []
    for(var i = 0; i < data.length; i++){
      var leaf = {id: data[i].code, name: data[i].name}
      if (data[i].children != undefined && data[i].children != null){
        leaf.children = this.convertDataTree(data[i].children)
      }
      dataArr.push(leaf)
    }
    return dataArr
  },

  setNewCategoryName(e){
    var newName = e.detail.value
    var that = this
    that.setData({newName: newName})
  },

  add(){
    var that = this
    var newName = that.data.newName
    that.setData({nowAdding: true})
    if (newName == ''){
      wx.showToast({
        title: '必须填写分类名称',
        icon: 'error'
      })
      that.setData({nowAdding: false})
      return
    }
    var selectedCode = that.data.selectedCode
    if (that.data.isSameLevel){
      selectedCode = selectedCode.substring(0, selectedCode.length - 2)
    }
    var addUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/AddCategory?code=' + selectedCode
      + '&name=' + encodeURIComponent(newName) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: addUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        wx.showToast({
          title: '新分类添加成功',
          icon:'success'
        })
        that.getData()
        
      },
      complete:()=>{
        that.setData({newName: '', nowAdding: false})
      }
    })
  },
  
  handleSelect(e){
    var that = this
    var select = e.detail.item
    that.setData({selectedCode: select.id, selectedName: select.name})
    that.getSingleCategory(select.id)
    //that.getSingleCategory(select.id)
  },
  onTabCLick(e){
    
  },
  onTabChange(e){
    var that = this
    that.setData({currentShopIndex: e.detail.index})
    that.getSingleCategory(that.data.selectedCategory.code)
    console.log('tab change', e)
  },
  checkSameLevel(e){
    var that = this
    if (e.detail.value.length == 1){
      that.setData({isSameLevel: true})
    }
    else{
      that.setData({isSameLevel: false})
    }
  },

  metionDelete(){
    var that = this
    var selectedCode = that.data.selectedCode
    var selectedName = that.data.selectedName
    wx.showModal({
      title: '确认删除分类：' + selectedCode + ' ' + selectedName ,
      content: '',
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          var delUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/DeleteCategory/' 
          + selectedCode + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) 
          + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
          wx.request({
            url: delUrl,
            method: 'GET',
            complete:()=>{
              that.getData()
            }
          })
        }
      }
    })
  },

  checkValid(){
    var that = this
    var canSave = that.data.canSave
    var canSaveMsg = that.data.canSaveMsg
    var cat = that.data.selectedCategory
    if (cat == null || cat == undefined || cat.children != null || cat.children != undefined){
        canSave = false
        canSaveMsg = '租金押金必须设置在最终一级的分类上。'
    }
    else if (isNaN(cat.deposit) || cat.deposit.toString() == '' || parseFloat(cat.deposit) == 0) {
        canSave = false
        canSaveMsg = '必须填写押金，且不能为0。'

    }
    else{
        var priceValid = true
        
        try{
            var priceArr = that.data.shopPriceArr[that.data.currentShopIndex]
            for(var i = 0; i < priceArr.length; i++){
                for(var j = 0; j < priceArr[i].length; j++){
                    if (isNaN(priceArr[i][j]) || priceArr[i][j].toString() == '' ){
                        priceValid = false
                    }
                }
            }
            if (!priceValid){
                canSave = false
                canSaveMsg = '9个价格必须逐一填写完整！'
            }
            else{
                canSave = true
                canSaveMsg = ''
            }
        }
        
        catch(exp){
            canSave = false
            canSaveMsg = '系统出错。'
        }
    }
    that.setData({canSave: canSave, canSaveMsg: canSaveMsg})
  },

  setNumber(e){
    var that = this
    var cat = that.data.selectedCategory
    var shopIndex = that.data.currentShopIndex
    var shopPriceArr = that.data.shopPriceArr
    var priceArr = shopPriceArr[that.data.currentShopIndex]
    var id = e.currentTarget.id
    if (id == 'deposit'){
        cat.deposit = e.detail.value
        that.setData({selectedCategory: cat, depositChanged: true})
        that.checkValid()
    }
    else if (id.indexOf('price_')==0){
        for(var i = 0; i < priceArr.length; i++){
            for(var j = 0; j < priceArr[i].length; j++){
                if (id == 'price_' + i.toString() + '_' + j.toString()){
                    priceArr[i][j] = e.detail.value
                }
            }
        }
        shopPriceArr[shopIndex] = priceArr
        that.setData({shopPriceArr: shopPriceArr, needSave: true})
        that.checkValid()
    }
  },

  save(){
    var that = this
    that.setData({isSaving: true})
    var cat = that.data.selectedCategory
    if (that.data.depositChanged){
        var saveDepositUrl = 'https://' +  app.globalData.domainName 
        + '/core/RentSetting/UpdateCategory/' + cat.code + '?name=' 
        + encodeURIComponent(cat.name) + '&deposit=' + cat.deposit.toString()
        + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) 
        + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
        wx.request({
          url: saveDepositUrl,
          method:'GET',
          success:(res)=>{
              if(res.statusCode == 200){
                wx.showToast({
                  title: '押金保存成功',
                  icon: 'success'
                })
              }
              
          }
        })
    }
    var shopName = that.data.shops[that.data.currentShopIndex].shop.trim()
    var priceArr = that.data.shopPriceArr[that.data.currentShopIndex]
    that.setData({saveNum: 0})
    for(var i = 0; i < priceArr.length; i++){
        var dayType = ''
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
        for(var j = 0; j < priceArr[i].length; j++){
            //var dayType = ''
            var scene = ''
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
            var saveUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/SetShopCategoryRentPrice/'
            + cat.code + '?shop=' + encodeURIComponent(shopName) + '&dayType=' + encodeURIComponent(dayType)
            + '&scene=' + encodeURIComponent(scene) + '&price=' + parseFloat(priceArr[i][j]).toString()
            + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
            wx.request({
              url: saveUrl,
              method: 'GET',
              success:(res)=>{
                  if (res.statusCode == 200){
                      var saveNum = that.data.saveNum
                      saveNum++
                      if (saveNum==9){
                          that.setData({saveNum: 0, isSaving: false})
                      }
                      else{
                          that.setData({saveNum: saveNum})
                      }
                  }
              }
            })


        }
    }
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function (resolve){
      if (app.globalData.memberInfo.is_admin == 1){
        that.setData({isAdmin: true})
        that.getData()
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
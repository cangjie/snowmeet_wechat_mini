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
        desc: ''
      },
      {
        title: '旗舰',
        title2: '',
        img: '',
        desc: ''
      },
      {
        title: '南山',
        title2: '',
        img: '',
        desc: ''
      }
    ],
    priceArr:[['-','-','-'],['-','-','-'],['-','-','-']],
    canSave: false,
    canSaveMsg: '租金押金必须设置在最终一级的分类上。',
    currentShop: '万龙体验中心'
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
          that.setPriceArr(that.data.currentShop)
        }
        
      }
    })
  },

  setPriceArr(shop){
   
    var that = this
    var priceArr = that.data.priceArr
    var cat = that.data.selectedCategory
    priceArr = [['','',''],['','',''],['','','']]
    for(var i = 0; i < cat.priceList.length; i++){
      var price = cat.priceList[i]
      var dayType = price.day_type
      var scene = price.scene
      if (price.shop == shop && dayType == '平日' && scene == '门市'){
        priceArr[0][0] = price.price
      }

      if (price.shop == shop && dayType == '平日' && scene == '预约'){
        priceArr[0][1] = price.price
      }

      if (price.shop == shop && dayType == '平日' && scene == '会员'){
        priceArr[0][2] = price.price
      }

      if (price.shop == shop && dayType == '周末' && scene == '门市'){
        priceArr[1][0] = price.price
      }

      if (price.shop == shop && dayType == '周末' && scene == '预约'){
        priceArr[1][1] = price.price
      }

      if (price.shop == shop && dayType == '周末' && scene == '会员'){
        priceArr[1][2] = price.price
      }

      if (price.shop == shop &&  dayType == '节假日' && scene == '门市'){
        priceArr[2][0] = price.price
      }

      if (price.shop == shop && dayType == '节假日' && scene == '预约'){
        priceArr[2][1] = price.price
      }

      if (price.shop == shop && dayType == '节假日' && scene == '会员'){
        priceArr[2][2] = price.price
      }
      that.setData({priceArr: priceArr})
      that.checkValid()
    }
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
  onTabChange(e){
    var that = this
    switch(e.detail.index){
        case 0:
            that.setData({shop: '万龙体验中心'})
            break
        case 1:
            that.setData({shop: '崇礼旗舰店'})
            break
        case 2:
            that.setData({shop: '南山'})
            break
        default:
            break
    }
    that.setPriceArr(that.data.shop)
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
        var priceArr = that.data.priceArr
        try{
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
    var priceArr = that.data.priceArr
    var id = e.currentTarget.id
    if (id == 'deposit'){
        cat.deposit = e.detail.value
        that.setData({selectedCategory: cat})
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
        that.setData({priceArr: priceArr})
        that.checkValid()
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
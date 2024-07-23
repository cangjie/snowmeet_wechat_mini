// pages/admin/rent/settings/category_tree.js
const app = getApp()
const util = require('../../../../utils/util')
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
    newSeq: '',
    newName: '',
    canSave: false,
    canSaveMsg: '租金押金必须设置在最终一级的分类上。',
    currentShop: '万龙体验中心',
    currentShopIndex: 0,
    depositChanged: false,
    isSaving: false,
    modName: '',
    priceArr:[
      {
        shop: '万龙',
        matrix:[['','',''],['','',''],['','','']]
      },
      {
        shop: '旗舰',
        matrix:[['','',''],['','',''],['','','']]
      },
      {
        shop: '南山',
        matrix:[['','',''],['','',''],['','','']]
      }
    ],
    matrixDisabled: true,
    newFieldName: ''
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
        var dataTree = that.convertDataTree(res.data)
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
          that.setData({matrixDisabled: false})
        }
        else{
            var shopPriceArr = [ ['-','-','-'],['-','-','-'],['-','-','-']]
            cat.deposit = '-'
            var priceArr = that.data.priceArr
            for(var i = 0; i < priceArr.length; i++){
              priceArr[i].matrix = shopPriceArr
            }


            that.setData({selectedCategory: cat, priceArr: priceArr, matrixDisabled: true})
        }
        
      }
    })
  },
  setCategoryPriceArr(){
    var that = this
    var priceArr = that.data.priceArr
    var cat = that.data.selectedCategory
    for(var i = 0; i < priceArr.length; i++){
      priceArr[i].matrix = [['','',''],['','',''],['','','']]
    }
    for(var i = 0; i < cat.priceList.length; i++){
      var price = cat.priceList[i]
      var shop = ''
      switch(price.shop){
        case '万龙体验中心':
          shop = '万龙'
          break
        case '崇礼旗舰店':
           shop = '旗舰'
           break
        case '南山':
          shop = '南山'
          break
        default:
          break   
      }
      var matrix = undefined
      for(var j = 0; j < priceArr.length; j++){
        if (priceArr[j].shop == shop){
          matrix = priceArr[j].matrix
          break
        }
      }
      if (matrix == undefined){
        continue
      }
      var rowIndex = -1
      var colIndex = -1
      switch(price.scene)
      {
        case '门市':
          colIndex = 0
          break
        case '预约':
          colIndex = 1
          break
        case '会员':
          colIndex = 2
          break
        default:
          break
      }
      switch(price.day_type)
      {
        case '平日':
          rowIndex = 0
          break
        case '周末':
          rowIndex = 1
          break
        case '节假日':
          rowIndex = 2
          break
        default:
          break
      }
      matrix[rowIndex][colIndex] = ((price.price == null)? '-' : price.price.toString())
    }
    that.setData({priceArr: priceArr})
  },
  tabChange(e){
    console.log('tab change', e)
    var that = this
    that.setData({currentShopIndex: e.detail.index})
  },
  modPrice(e){
    console.log('mod price', e)
    var shopIndex = e.detail.currentShopIndex
    var rowIndex = e.detail.row
    var colIndex = e.detail.col
    var price = e.detail.value
    var that = this
    var priceArr = that.data.priceArr
    priceArr[shopIndex].matrix[rowIndex][colIndex] = price
    that.setData({priceArr: priceArr})
    that.checkValid()
  },

/*
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
*/
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
      var leaf = {id: data[i].id, code: data[i].code, name: data[i].name}
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
  addCategory(){
    var that = this
    var newSeq = that.data.newSeq.trim()
    var newName = that.data.newName
    var msg = ''
    if (isNaN(newSeq) || newSeq.trim() == ''){
      msg = '序号必须是两位数字。'
    }
    else if (newName.trim() == ''){
      msg = '必须填写名称'
    }
    newSeq = newSeq.length >= 2? newSeq : '0' + newSeq
    var fatherCode = that.data.selectedCategory.code
    if (that.data.isSameLevel){
      fatherCode = fatherCode.substr(0, fatherCode.length - 2)
    }
    var newCode = fatherCode + newSeq
    var sameLevelLeaf = []
    var codeDup = false
    var nameDup = false
    if (fatherCode==''){
      sameLevelLeaf = that.data.dataTree
    }
    else{
      var fatherNode = that.getCategoryFromDataTree(fatherCode, that.data.dataTree)
      if (fatherNode == null || fatherNode == undefined 
        || fatherNode.children == null || fatherNode.children == undefined){
        sameLevelLeaf = []
      }
      else{
        sameLevelLeaf = fatherNode.children
      }
    }
    for(var i = 0; i < sameLevelLeaf.length; i++){
      if (sameLevelLeaf[i].code == newCode){
        codeDup = true
        break
      }
      if (sameLevelLeaf[i].name == newName){
        nameDup = true
        break
      }
    }
    if (codeDup){
      msg = '序号重复'
    }
    if (nameDup){
      msg = '名称重复'
    }
    console.log('father', fatherCode)
    if (msg != ''){
      wx.showToast({
        title: msg,
        icon: 'error'
      })
      return
    }
    var addUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/AddCategoryManual/' + newCode
      + '?name=' + encodeURIComponent(newName) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
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
        that.setData({newName: '', newSeq: ''})
        that.getData()
        
      },
      complete:()=>{
        that.setData({newName: '', nowAdding: false})
      }
    })
  },

  getCategoryFromDataTree(code, dataTree){
    var that = this
    that.setData({nowAdding: true})
    //var dataTree = that.data.dataTree
    for(var i = 0; i < dataTree.length; i++){
      if (code.indexOf(dataTree[i].code) == 0){
        if (code == dataTree[i].code){
          return dataTree[i]
        }
        else {
          that.getCategoryFromDataTree(code, dataTree[i])
        }
      }
    }
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
        that.setData({newName: '',newSeq: '', nowAdding: false})
      }
    })
  },
  
  handleSelect(e){
    var that = this
    var select = e.detail.item
    var selectedDisplayedCode = util.getDisplayedCode(select.code)
    var isSameLevel = that.data.isSameLevel
    var fatherCode = isSameLevel ? select.code.substr(0, select.code.length - 2) : select.code
    var grandpaCode = select.code.substr(0, select.code.length - 2)
    var fatherDisplayedCode = util.getDisplayedCode(fatherCode) 
    var grandpaDisplayedCode = util.getDisplayedCode(grandpaCode)
    grandpaDisplayedCode = grandpaDisplayedCode != '' ? grandpaDisplayedCode + '-' : grandpaDisplayedCode
    if (fatherDisplayedCode != ''){
      fatherDisplayedCode = fatherDisplayedCode + '-'
    }
    var seq = select.code.substr(select.code.length - 2, 2)
    that.setData({selectedCategory: select, selectedDisplayedCode: selectedDisplayedCode, 
    fatherDisplayedCode: fatherDisplayedCode, modName: select.name, grandpaDisplayedCode: grandpaDisplayedCode, seq: seq})
    that.getSingleCategory(select.code)
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
    console.log('check same level', e)
    var that = this
    var isSameLevel = e.detail.value
    var fatherCode = isSameLevel ?  
      that.data.selectedCategory.code.substr(0, that.data.selectedCategory.code.length - 2) 
      : that.data.selectedCategory.code
    var fatherDisplayedCode = util.getDisplayedCode(fatherCode) 
    if (fatherDisplayedCode != ''){
      fatherDisplayedCode = fatherDisplayedCode + '-'
    }
    that.setData({isSameLevel: isSameLevel, fatherDisplayedCode: fatherDisplayedCode})
  },

  metionDelete(){
    var that = this
    var selectedCode = that.data.selectedCategory.code
    var selectedName = that.data.selectedCategory.name
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
            var priceArr = that.data.priceArr[that.data.currentShopIndex].matrix
            for(var i = 0; i < priceArr.length; i++){
                for(var j = 0; j < priceArr[i].length; j++){
                  var p = priceArr[i][j]
                  if (p != '-' && ((isNaN(priceArr[i][j]) || priceArr[i][j].toString() == '' ))){
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
    var shopPriceArr = that.data.priceArr
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
                that.setData({depositChanged: false})
              }
              
          }
        })
    }
    var shopName = that.data.priceArr[that.data.currentShopIndex].shop.trim()
    switch(shopName){
      case '万龙':
        shopName = '万龙体验中心'
        break
      case '旗舰':
        shopName = '崇礼旗舰店'
        break
      default:
        break
    }
    var priceArr = that.data.priceArr[that.data.currentShopIndex].matrix
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
            + cat.id.toString() + '?shop=' + encodeURIComponent(shopName) + '&dayType=' + encodeURIComponent(dayType)
            + '&scene=' + encodeURIComponent(scene) + '&price=' + priceArr[i][j].toString()
            + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' 
            + encodeURIComponent('wechat_mini_openid')
            wx.request({
              url: saveUrl,
              method: 'GET',
              success:(res)=>{
                  if (res.statusCode == 200){
                      var saveNum = that.data.saveNum
                      saveNum++
                      if (saveNum==9){
                          that.setData({saveNum: 0, isSaving: false})
                          wx.showToast({
                            title: '租金保存成功。',
                            icon:'success'
                          })
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

  setNewCategory(e){
    var that = this
    var v = e.detail.value
    switch(e.currentTarget.id){
      case 'newSeq':
        
        that.setData({newSeq: v})
        break
      case 'newSeqName':
        that.setData({newName: v})
        break
      default:
        break
    }
  },
  setModName(e){
    var that = this
    var id = e.currentTarget.id
    switch(id){
      case 'modName':
        that.setData({modName: e.detail.value})
        break
      case 'modSeq':
        that.setData({seq: e.detail.value})
        break
      default:
        break
    }
    
  },
  modCategoryName(e){
    var that = this
    var selectedCategory = that.data.selectedCategory
    var modName = that.data.modName.trim()
    if (modName == undefined || modName == null || modName == ''){
      wx.showToast({
        title: '分类名称必须填写',
        icon: 'error'
      })
      return
    }
    var newCode = that.data.selectedCategory.code
    newCode = newCode.substr(0, newCode.length - 2) + that.data.seq

    var modUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/ModCategory/' + selectedCategory.id.toString() + '?code=' + newCode + '&name=' + encodeURIComponent(modName) 
    + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: modUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        wx.showToast({
          title: '修改成功',
          icon: 'success'
        })
        that.getData()
      }
    })
  },
  setNewFieldName(e){
    var that = this
    that.setData({newFieldName: e.detail.value})
  },
  addNewField(e){
    var that = this
    var infoFieldList = that.data.selectedCategory.infoFields
    var sort = 1
    if (infoFieldList.length > 0){
      sort = infoFieldList[infoFieldList.length - 1].sort
      sort++
    }
    var addUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/CategoryInfoFieldAdd/' + that.data.selectedCategory.id.toString() + '?fieldName=' + encodeURIComponent(that.data.newFieldName) + '&sort=' + sort.toString() + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: addUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          wx.showToast({
            title: '添加失败',
            icon: 'error'
          })
          return
        }
        that.setData({newFieldName: ''})
        that.getSingleCategory(that.data.selectedCategory.code)
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        })
      }
    })
  },
  modFields(e){
    var that = this
    var id = e.currentTarget.id
    var act = id.split('_')[0]
    id = id.split('_')[1]
    var fieldSet = that.getFieldsById(parseInt(id))
    var currentField = fieldSet.currentField
    var nextField = fieldSet.nextField
    var prevField = fieldSet.prevField
    
    switch(act){
      case 'del':
        wx.showModal({
          title: '确认删除字段：' + currentField.field_name+ '?',
          content: '',
          complete: (res) => {
            if (res.cancel) {
              return
            }
        
            if (res.confirm) {
              currentField.is_delete = 1
              that.saveField(currentField)
            }
          }
        })
        
        break
      case 'name':
        currentField.mod = false
        that.saveField(currentField)
        break
      case 'up':
        if (prevField != undefined){
          var sort = currentField.sort
          currentField.sort = prevField.sort
          prevField.sort = sort
          that.saveField(currentField)
          
          setTimeout(()=>{
            that.saveField(prevField)
          }, 100)
        }
        break
      case 'down':
        if (nextField != undefined){
          var sort = currentField.sort
          currentField.sort = nextField.sort
          nextField.sort = sort
          that.saveField(currentField)
        
          setTimeout(()=>{
            that.saveField(nextField)
          }, 100)
        }
        break
      default:
        break
    }
  },
  saveField(field){
    var that = this
    var categoryId = that.data.selectedCategory.id
    var saveUrl = 'https://' + app.globalData.domainName + '/core/RentSetting/CategoryInfoFieldMod/' + field.id.toString() + '?fieldName=' + encodeURIComponent(field.field_name) + '&sort=' + field.sort.toString() + '&delete=' + (field.is_delete == 1 ? 'True' : 'False') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: saveUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          wx.showToast({
            title: '保存失败',
            icon: 'success'
          })
          return
        }
        that.getSingleCategory(that.data.selectedCategory.code)
      }
    })
  },
  setFieldName(e){
    var id = e.currentTarget.id
    var v = e.detail.value
    var that = this
    var currentField = that.getFieldsById(parseInt(id.toString())).currentField
    currentField.field_name = v
    currentField.mod = true
    /*
    var fieldList = that.data.selectedCategory.infoFields
    for(var i = 0; i < fieldList.length; i++){
      if (fieldList[i].id == currentField.id){
        fieldList[i] = currentField
        break
      }
    }
    */
    that.setData({selectedCategory: that.data.selectedCategory})
  },
  getFieldsById(id){
    var that = this
    var fieldList = that.data.selectedCategory.infoFields
    var currentIndex = -1
    var prevIndex = -1
    var nextIndex = -1
    for(var i = 0; i < fieldList.length; i++){
      if (fieldList[i].id==id){
        currentIndex = i
        break
      }
    }
    for(var i = currentIndex - 1; i >= 0; i--){
      if (fieldList[i].is_delete==0){
        prevIndex = i
        break
      }
    }
    for(var i = currentIndex + 1; i < fieldList.length; i++){
      if (fieldList[i].is_delete==0){
        nextIndex = i
        break
      }
    }
    var currentField = undefined
    var nextField = undefined
    var prevField = undefined
    if (currentIndex>=0){
      currentField = fieldList[currentIndex]
    }
    if (nextIndex>=0){
      nextField = fieldList[nextIndex]
    }
    if (prevIndex>=0){
      prevField = fieldList[prevIndex]
    }

    return {currentField: currentField, prevField: prevField, nextField: nextField} 
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
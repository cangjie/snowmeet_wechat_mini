// pages/admin/maintain/recept.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    scene: '查看用户基本信息',
    equipArr:[],
    selectedEquipArr:[],
    maintainLogArr:[],
    maintainWholeLog:[],
    relationItems:['本人', '配偶', '朋友', '长辈'],
    payOptionList:['立即支付', '稍后支付', '次卡支付', '无需支付'],
    payOptionSelectedIndex: 0,
    othersDiscount: 0,
    ticketDiscount: 0,
    payMethod: '微信支付'
  },

  

  userInfoUpdate(e){
    console.log('user info update', e)
    var that = this
    var userInfo = e.detail.user_info
    that.setData({userInfo: userInfo})
    if (userInfo != null && e.detail.user_found){
      var equipArr = []
      var maintainLogArr = []
      var getEquipUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetEquip?openId=' + encodeURIComponent(userInfo.open_id) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getEquipUrl,
        method: 'GET',
        success:(res)=>{
          console.log('equip find', res)
          equipArr = res.data
          var getLogArr = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetMaintainLog?openId=' + encodeURIComponent(userInfo.open_id) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: getLogArr,
            method: 'GET',
            success:(res)=>{
              console.log('maintain log', res)
              for(var i = 0; i < 3 && i < res.data.length; i++){
                maintainLogArr[i] = res.data[i]
              }
              
              for(var i = 0; i < maintainLogArr.length; i++){
                var desc = maintainLogArr[i].confirmed_equip_type + ' ' + maintainLogArr[i].confirmed_brand + ' ' + maintainLogArr[i].confirmed_scale + ' ' + ((maintainLogArr[i].confirmed_edge == 1)?('修刃' + maintainLogArr[i].confirmed_degree): ' ') + (maintainLogArr[i].confirmed_candle == 1? '打蜡' : ' ') + maintainLogArr[i].confirmed_more
                maintainLogArr[i].date = util.formatDate(new Date(maintainLogArr[i].create_date))
                maintainLogArr[i].desc = desc
              }

              that.setData({equipArr: equipArr, maintainLogArr: maintainLogArr, maintainWholeLog: res.data})
            }
          })
        }
      })
    }
  },
  checkEquip(e){
    console.log('check equip', e)
    var that = this
    var wholeLog = that.data.maintainWholeLog
    var that = this
    var selectedEquipArr = []
    var equipArr = that.data.equipArr
    for(var i = 0; i < e.detail.value.length; i++){
      var index = parseInt(e.detail.value[i].toString())
      selectedEquipArr[i] = equipArr[index]
      selectedEquipArr[i].relation = '本人'
      for(var j = 0; j < wholeLog.length; j++){
        var log = wholeLog[j]
        var equip = selectedEquipArr[i]
        if (equip.type == log.confirmed_equip_type && equip.brand == log.confirmed_brand && equip.scale == log.confirmed_scale ){

          equip.footLength = log.confirmed_foot_length
          equip.front = log.confirmed_front

          equip.height = log.confirmed_height
          
          equip.weight = log.confirmed_weight
          equip.binderGap = log.confirmed_binder_gap

          equip.angle = log.confirmed_angle
          equip.dinFront = log.confirmed_front_din
          equip.dinRear = log.confirmed_rear_din

          equip.relation = log.confirmed_relation

          equip.othersCharge = 0

          
          
          break

        }
      }
    }
    that.setData({selectedEquipArr: selectedEquipArr})
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var getBrandUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetBrand?type=' + encodeURIComponent('双板')
    wx.request({
      url: getBrandUrl,
      method: 'GET',
      success:(res)=>{
        
        var skiBrands = []
        for(var i = 0; i < res.data.length; i++){
          var brand = res.data[i].brand_name.trim()
          if (res.data[i].chinese_name.trim()!=''){
            brand = brand + '/' + res.data[i].chinese_name.trim()
          }
          skiBrands.push(brand)
          
        }
        that.setData({skiBrands: skiBrands})
        getBrandUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetBrand?type=' + encodeURIComponent('单板')
        wx.request({
          url: getBrandUrl,
          method: 'GET',
          success:(res)=>{
            var boardBrands = []
            for(var i = 0; i < res.data.length; i++){
              var brand = res.data[i].brand_name.trim()
              if (res.data[i].chinese_name.trim()!=''){
                brand = brand + '/' + res.data[i].chinese_name.trim()
              }
              boardBrands.push(brand)
            }
            that.setData({boardBrands: boardBrands})
          }
        })
      }
    })
  },
  shopSelected(e){
    console.log('shop selected', e)
    var that = this
    that.setData({shop: e.detail.shop})
  },
  payOptionChange(e){
    console.log('pay option change', e)
    var that = this
    that.setData({payOptionSelectedIndex: e.detail.value})
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
  gotoPlaceOrder(){
    var that = this
    var getProductUrl = 'https://' + app.globalData.domainName + '/core/Product/GetMaintainProduct?shop=' + encodeURIComponent(that.data.shop)
    wx.request({
      url: getProductUrl,
      method:'GET',
      success:(res)=>{
        console.log('maintian products', res)
        that.setData({productList: res.data})
      }
    })
    that.setData({scene: '确定养护项目'})
    var selectedEquipArr = that.data.selectedEquipArr
    if (selectedEquipArr.length == 0){
      selectedEquipArr[0] = {type: '双板', brand: '请选择。。。', scale: '', serial: '', year: ''}
      that.setData({selectedEquipArr: selectedEquipArr})
    }
    
  },
  gotoConfirm(){
    var that = this
    that.setData({scene: '确认订单'})
    var selectedEquipArr = that.data.selectedEquipArr
    var totalSummary = 0
    for(var i = 0; i < selectedEquipArr.length; i++){
      var equip = selectedEquipArr[i]
      var productId = 0
      var price = 0
      if (equip.urgent == 1){
        if (equip.edge && equip.candle){
          for(var i = 0; i < that.data.productList.length; i++){
            var name = that.data.productList[i].name
            if (name.indexOf('立等')>=0 && name.indexOf('修刃')>=0 && name.indexOf('打蜡')>=0 ){
              productId = that.data.productList[i].id
              price = that.data.productList[i].sale_price
              break
            }
          }
        }
        else{
          if (equip.edge){
            for(var i = 0; i < that.data.productList.length; i++){
              var name = that.data.productList[i].name
              if (name.indexOf('立等')>=0 && name.indexOf('修刃')>=0 && name.indexOf('打蜡')<0 ){
                productId = that.data.productList[i].id
                price = that.data.productList[i].sale_price
                break
              }
            }
          }
          if (equip.candle){
            for(var i = 0; i < that.data.productList.length; i++){
              var name = that.data.productList[i].name
              if (name.indexOf('立等')>=0 && name.indexOf('修刃')<0 && name.indexOf('打蜡')>=0 ){
                productId = that.data.productList[i].id
                price = that.data.productList[i].sale_price
                break
              }
            }
          }
        }
      }
      else {
        if (equip.edge && equip.candle){
          for(var i = 0; i < that.data.productList.length; i++){
            var name = that.data.productList[i].name
            if (name.indexOf('次日')>=0 && name.indexOf('修刃')>=0 && name.indexOf('打蜡')>=0 ){
              productId = that.data.productList[i].id
              price = that.data.productList[i].sale_price
              break
            }
          }
        }
        else{
          if (equip.edge){
            for(var i = 0; i < that.data.productList.length; i++){
              var name = that.data.productList[i].name
              if (name.indexOf('次日')>=0 && name.indexOf('修刃')>=0 && name.indexOf('打蜡')<0 ){
                productId = that.data.productList[i].id
                price = that.data.productList[i].sale_price
                break
              }
            }
          }
          if (equip.candle){
            for(var i = 0; i < that.data.productList.length; i++){
              var name = that.data.productList[i].name
              if (name.indexOf('次日')>=0 && name.indexOf('修刃')<0 && name.indexOf('打蜡')>=0 ){
                productId = that.data.productList[i].id
                price = that.data.productList[i].sale_price
                break
              }
            }
          }
        }
      }
      equip.productId = productId
      equip.productPrice = price
      
      if (equip.othersCharge == undefined){
        equip.othersCharge = 0;
      }
      var othersCharge = parseFloat(equip.othersCharge)
      equip.othersCharge = othersCharge
      equip.summary = equip.productPrice + equip.othersCharge
      totalSummary += equip.summary

    }
    that.setData({totalSummary: totalSummary})
  },
  gotoRecept(){
    var that = this
    that.setData({scene: '查看用户基本信息'})
  },
  changed(e){
    console.log('select changed', e)
    var that = this
    var targetIdArr = e.currentTarget.id.split('_')
    var targetType = targetIdArr[0]
    var targetId = parseInt(targetIdArr[1])
    var selectedEquipArr = that.data.selectedEquipArr
    var currentEquip = selectedEquipArr[targetId]
    var value = e.detail.value
    switch(targetType){
      case 'type':
        currentEquip.type = value
        currentEquip.brand = ''
        break
      case 'brand':
        var brandList = that.data.skiBrands
        if (currentEquip.type == '单板'){
          brandList = that.data.boardBrands
        }
        currentEquip.brand = brandList[parseInt(value)]
        break
      case 'scale':
        currentEquip.scale = value
        break
      case 'front':
        currentEquip.front = value
        break
      case 'footLength':
        currentEquip.footLength = value
        break
      case 'height':
        currentEquip.height = value
        break
      case 'weight':
        currentEquip.weight = value
        break
      case 'binderGap':
        currentEquip.binderGap = value
        break
      case 'binderAngle':
        currentEquip.angle = value
        break
      case 'dinFront':
        currentEquip.dinFront = value
        break
      case 'dinRear':
        currentEquip.dinRear = value
        break
      case 'relation':
        var relation = that.data.relationItems[parseInt(value)]
        currentEquip.relation = relation
        break
      case 'item':
        var edge = false
        var candle = false
        for(var i = 0; i < value.length; i++){
          switch(value[i].trim()){
            case '打蜡':
              candle = true
              break
            case '修刃':
              edge = true
              break
            default:
              break
          }
        }
        currentEquip.candle = candle
        currentEquip.edge = edge
        if (edge && (currentEquip.degree == undefined || currentEquip.degree == '')){
          currentEquip.degree = '89'
        }
        break;
      case 'degree':
        currentEquip.degree = value
        break
      case 'others':
        var v = ''
        for(var i = 0; i < value.length; i++){
          v = v + (v==''?'':',') + value[i].trim()
        }
        currentEquip.more = v
        break
      case 'memo':
        currentEquip.memo = value
        break
      case 'othersCharge':
        currentEquip.othersCharge = value
        break
      case 'urgent':
        currentEquip.urgent = value.length.toString()
        break
      default:
        break
    }
    that.setData({selectedEquipArr: selectedEquipArr})
  },
  addNew(){
    var that = this
    var selectedEquipArr = that.data.selectedEquipArr
    selectedEquipArr.push({type: '双板'})
    that.setData({selectedEquipArr: selectedEquipArr})
  },
  setDiscount(e){
    var that = this
    var discount = parseFloat(e.detail.value)
    if (discount == undefined){
      discount = 0
    }
    that.setData({othersDiscount: discount})
    
  },
  setTicketDiscount(e){
    var that = this
    var discount = parseFloat(e.detail.value)
    if (discount==undefined){
      discount = 0
      //that.setData({ticketDiscount: discount})
    }
    that.setData({ticketDiscount: discount})
  },
  gotoFinish(){
    var that = this
    var openId = ''
    var cell = ''
    var name = ''
    var gender = ''
    if (that.data.userInfo != undefined && that.data.userInfo != null){
      cell = that.data.userInfo.cell_number
      name = that.data.userInfo.real_name
      gender = that.data.userInfo.gender
      openId = that.data.userInfo.open_id
    }
    var submitData = {
      shop: that.data.shop,
      payMethod: that.data.payMethod,
      payOption: that.data.payOptionList[that.data.payOptionSelectedIndex],
      summaryPrice: that.data.totalSummary,
      ticketDiscount: that.data.ticketDiscount,
      discount: that.data.discount,
      ticketCode: that.data.ticketCode,
      orderId: 0,
      customerOpenId: openId,
      cell: cell,
      name: name,
      gender: gender
    }
    var items = []
    for(var i = 0; i < that.data.selectedEquipArr.length; i++){
      var equip = that.data.selectedEquipArr[i]
      var items = []
      var item = {
        id: 0,
        shop: that.data.shop,
        open_id: that.data.userInfo.open_id,
        confirmed_cell: that.data.cell,
        confirmed_equip_type: equip.type,
        confirmed_brand: equip.brand,
        confirmed_serial: equip.serial,
        confirmed_scale: equip.scale,
        confirmed_year: equip.year,
        confirmed_edge: equip.edge?1:0,
        confirmed_degree: equip.degree==undefined?'':equip.degree,
        confirmed_candle: equip.candle?1:0,
        confirmed_more: equip.more,
        confirmed_memo: equip.memo,
        confirmed_additional_fee: parseFloat(equip.othersCharge)==undefined?0:parseFloat(equip.othersCharge),
        confirmed_cell: that.data.cell,
        confirmed_name: that.data.userInfo.real_name,
        confirmed_gender: that.data.userInfo.gender,
        confirmed_product_id: equip.productId,
        confirmed_images: equip.images,
        confirmed_urgent: equip.urgent?1:0,
        confirmed_foot_length: equip.footLength,
        confirmed_front: equip.front,
        confirmed_height: equip.height,
        confirmed_weight: equip.weight,
        confirmed_binder_gap: equip.binderGap,
        confirmed_front_din: equip.dinFront,
        confirmed_rear_din: equip.dinRear,
        confirmed_angle: equip.angle,
        confirmed_relation: equip.relation,
        pay_method: that.data.payMethod
      }
      items.push(item)
    }
    submitData.items = items

    var submitUrl = 'https://' + app.globalData.domainName + '/core/maintainlive/recept?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: submitUrl,
      method: 'POST',
      data: submitData,
      success: (res)=>{
        console.log(res)
      }
    })

  },
  setPayMethod(e){
    console.log('set pay method', e)
    var that = this
    that.setData({payMethod: e.detail.payMethod})
  }
})
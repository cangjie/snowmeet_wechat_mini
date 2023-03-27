// pages/admin/rent/rent_admit_new.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    isToday: true,
    scene: 0,
    classSelectIndex: 0,
    rentItemList:[],
    currentRentItemIndex: -1,
    currentRentItem:{
      index: -1,
      code:'',
      isNoCode: false,
      class:'',
      classSelectedIndex: 0,
      name: '',
      rental: 0,
      deposit: 0,
      depositType:'',
      startDate: util.formatDate(new Date()),
      memo: '',
      
    },
    realName: '',
    gender: '',
    openId: '',
    name: '',
    shop: '',
    cell: '',
    haveCredit: false,
    totalDepositReal: 0,
    depositReduce: 0,
    payOption: '现场支付',
    rentDays: 1,
    ticketCode: '',
    creditImages: '',
    memo: ''
  },

  goBack(){
    wx.redirectTo({
      url: 'rent_admit',
    })
  },

  changeNoCode(e){
    var that = this
    var value = e.detail.value
    var currentRentItem = that.data.currentRentItem
    currentRentItem.isNoCode = e.detail.value
    if (currentRentItem.isNoCode){
      currentRentItem.code = ''
    }
    that.setData({currentRentItem: currentRentItem})
  },

  scan(){
    var that = this
    wx.scanCode({
      onlyFromCamera: false,
      success:(res)=>{
        console.log('scan result', res)
        var code = res.result
        var currentRentItem = that.data.currentRentItem
        currentRentItem.code = code
        that.getItemInfo(code)
      }
    })
  },

  getItemInfo(code){
    var that = this
    var currentRentItem = that.data.currentRentItem
    var classList = that.data.classList
    var getItemUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentItem/' + code + '?shop=' + encodeURIComponent('万龙')
    wx.request({
      url: getItemUrl,
      success:(res)=>{
        if (res.statusCode == 200){
          currentRentItem.name = res.data.name
          currentRentItem.class = res.data.class
          currentRentItem.classSelectIndex = 0
          for(var i = 0; i < classList.length; i++){
            if (classList[i] == currentRentItem.class){
              currentRentItem.classSelectedIndex = i
              break
            }
          }
          currentRentItem.rental = res.data.rental
          currentRentItem.deposit = res.data.deposit
          that.setData({currentRentItem: currentRentItem})
          /*
          rentItem.code = code
          rentItem.name = res.data.name
          rentItem.deposit = res.data.deposit
          rentItem.rental = res.data.rental
          rentItem.noCode = false
          rentItemList[index] = rentItem
          that.setData({rentItemList: rentItemList})
          that.checkValid()
          */
        }
      }
    })
  },
  inputCode(e){
    var code = e.detail.value
    var that = this
    var currentRentItem = that.data.currentRentItem
    currentRentItem.code = code
    that.getItemInfo(code)
  },
  selectClass(e){
    var that = this
    var currentRentItem = that.data.currentRentItem
    var currentClass = that.data.classList[e.detail.value]
    currentRentItem.class = currentClass
    currentRentItem.classSelectedIndex = e.detail.value
    that.setData({currentRentItem: currentRentItem})
  },
  setDepositType(e){
    var that = this
    var currentRentItem = that.data.currentRentItem
    currentRentItem.depositType = e.detail.value
    if (currentRentItem.depositType == '预付押金'){
      currentRentItem.name = ''
      currentRentItem.code = ''
      currentRentItem.rental = 0
      currentRentItem.isNoCode = false
    }
    
    that.setData({currentRentItem: currentRentItem})
  },


  setNumber(e){
    var that = this
    var fieldName = ''
    switch(e.currentTarget.id){
      case 'rental':
        fieldName = '租金'
        break
      case 'deposit':
        fieldName = '押金'
        break
      default:
        break
    }
    var message = ''
    if (fieldName!=''){
      var amount = parseFloat(e.detail.value)
      var currentRentItem = that.data.currentRentItem
      if (!isNaN(amount)){
        var displayedValue = amount
        if (amount.toString() != e.detail.value){
          displayedValue = e.detail.value
        }
        switch(fieldName){
          case '租金':
            currentRentItem.rental = displayedValue
            break
          case '押金':
            currentRentItem.deposit = displayedValue
            break
          default:
            break
        }
        that.setData({currentRentItem: currentRentItem})
      }
      else{
        message = '请填正确' + fieldName
        wx.showToast({
          title: message,
          icon: 'error',
          success:(res)=>{
            switch(fieldName){
              case '租金':
                currentRentItem.rental = e.detail.value
                break
              case '押金':
                currentRentItem.deposit = e.detail.value
                break
              default:
                break
            }
            that.setData({currentRentItem: currentRentItem})
          }
        })
      }
    }
  },
  setMemo(e){
    var that = this
    var currentRentItem = that.data.currentRentItem
    currentRentItem.memo = e.detail.value
    that.setData({currentRentItem: currentRentItem})
  },
  setName(e){
    var that = this
    var currentRentItem = that.data.currentRentItem
    currentRentItem.name = e.detail.value
    that.setData({currentRentItem: currentRentItem})
  },
  save(){
    var that = this
    var rentItemList = that.data.rentItemList
    var currentRentItem = that.data.currentRentItem
    var valid = true
    var message = ''
    if (currentRentItem.isNoCode && currentRentItem.code != ''){
      message = '无码物品无编码'
      valid = false
    }
    else if(!currentRentItem.isNoCode && currentRentItem.code == ''){
      message = '请填写编码'
      valid = false
    }
    else if (currentRentItem.name == ''){
      message = '请填写名称'
      valid = false
    }
    else if (currentRentItem.class == '' || currentRentItem.classSelectedIndex == 0){
      message = '请选择分类'
      valid = false
    }
    else if (currentRentItem.depositType == ''){
      message = '请选择押金类型'
      valid = false
    }
    else{
      message = ''
      valid = true
    }
    if (currentRentItem.depositType == '预付押金'){
      var deposit = parseFloat(currentRentItem.deposit)
      if (isNaN(deposit) || deposit <= 0){
        message = '预付押金不为0'
        valid = false
      }
      else if (currentRentItem.class == '' || currentRentItem.classSelectedIndex == 0){
        message = '请选择分类'
        valid = false
      }
  
      else {
        message = ''
        valid = true
      }


      
    }
    if (!valid){
      wx.showToast({
        title: message,
        icon: 'error'
      })
      return
    }




    currentRentItem.depositStr = util.showAmount(parseFloat(currentRentItem.deposit))
    currentRentItem.rentalStr = util.showAmount(parseFloat(currentRentItem.rental))
    if (currentRentItem.index == -1){
      currentRentItem.index = rentItemList.length
      rentItemList.push(currentRentItem)
    }
    else{
      for(var i = 0; i < rentItemList.length; i++){
        if (rentItemList[i].index == currentRentItem.index){
          rentItemList[i] = currentRentItem
          break;
        }
      }
    }
    
    currentRentItem = {
      index: -1,
      code:'',
      isNoCode: false,
      class:'',
      classSelectedIndex: 0,
      name: '',
      rental: 0,
      deposit: 0,
      depositType:'',
      startDate: util.formatDate(new Date()),
      memo: ''
    }
    that.setData({rentItemList: rentItemList, currentRentItem: currentRentItem, isToday: true})
  },

  selectItem(e){
    var that = this
    var id = e.currentTarget.id
    var rentItemList = that.data.rentItemList
    var currentRentItem = rentItemList[parseInt(id)]
    var isToday = false
    var now = new Date()
    var startDate = new Date(currentRentItem.startDate)
    if (now.getFullYear() == startDate.getFullYear() && now.getMonth() == startDate.getMonth() && startDate.getDate() == now.getDate()){
      isToday = true
    }
    that.setData({currentRentItem: currentRentItem, isToday: isToday})
  },

  del(){
    var that = this
    var currentRentItem = that.data.currentRentItem
    var rentItemList = that.data.rentItemList
    var rentItemListNew = []
    var j = 0
    for(var i = 0; i < rentItemList.length; i++){
      if (currentRentItem.index != rentItemList[i].index){
        rentItemList[i].index = j
        j++
        rentItemListNew.push(rentItemList[i])
      }
    }
    currentRentItem = {
      index: -1,
      code:'',
      isNoCode: false,
      class:'',
      classSelectedIndex: 0,
      name: '',
      rental: 0,
      deposit: 0,
      depositType:'立即租赁',
      startDate: util.formatDate(new Date()),
      memo: ''
    }
    that.setData({currentRentItem: currentRentItem, rentItemList: rentItemListNew})
  },

  shopSelected(e){
    var that = this
    that.setData({shop: e.detail.shop})
  },

  userInfoUpdate(e){
    var that = this
    var cell = ''
    var name = ''
    var openId = that.data.openId
    var realName = ''
    var gender = ''
    if (e.detail.user_info != null){
      if (e.detail.user_info.cell_number != undefined){
        cell = e.detail.user_info.cell_number
      }
      if (e.detail.user_info.real_name != undefined){
        name = e.detail.user_info.real_name
        realName = name
      }
      if (e.detail.user_info.gender != undefined){
        if (e.detail.user_info.gender == '男'){
          name = name + ' 先生'
          gender = '先生'
        }
        else if (e.detail.user_info.gender == '女'){
          name = name + ' 女士'
          gender = '女士'
        }
      }
      if (e.detail.user_found != undefined && e.detail.user_found == true){
        openId = e.detail.user_info.open_id
      }
      that.setData({cell: cell, name: name, openId: openId, gender: gender, realName: realName})
    }
  },

  setCredit(e){
    var that = this
    var haveCredit = false
    if (e.detail.value == '0'){
      haveCredit = false
    }
    else if (e.detail.value == '1'){
      haveCredit = true
    }
    that.setData({haveCredit: haveCredit})
  },

  

  gotoNext(){
    var that = this
    var scene = that.data.scene
    scene++
    that.setData({scene: scene})
    that.setSceneData()
  },

  gotoPrev(){
    var that = this
    var scene = that.data.scene
    scene--
    that.setData({scene: scene})
    that.setSceneData()
  },

  setSceneData(){
    var that = this
    var scene = that.data.scene
    switch(scene){
      case 2:
        that.computeTotal()
        break
      default:
        break
    }
  },


  setTotalDepositReal(e){
    var that = this
    var value = parseFloat(e.detail.value)
    if (!isNaN(value)){
      var d = parseFloat(value)
      that.setData({totalDepositReal: d})
      that.computeTotal()
    }
  },

  computeTotal(){
    var that = this
    var rentItemList = that.data.rentItemList
    var totalDeposit = 0
    var totalRental = 0
    for(var i = 0; i < rentItemList.length; i++){
      if (!isNaN(rentItemList[i].deposit)){
        totalDeposit = totalDeposit + rentItemList[i].deposit
      }
      if (!isNaN(rentItemList[i].rental)){
        totalRental = totalRental + rentItemList[i].rental
      }
    }
    var totalDepositStr = util.showAmount(totalDeposit)
    var totalRentalStr = util.showAmount(totalRental)
    var totalDepositReal = that.data.totalDepositReal == 0? totalDeposit : that.data.totalDepositReal
    var depositReduce = that.data.depositReduce
    var finalPayStr = util.showAmount(totalDepositReal - depositReduce)

    that.setData({totalDeposit: totalDeposit, totalDepositStr: totalDepositStr, 
      totalRental: totalRental, totalRentalStr: totalRentalStr,
      totalDepositReal: totalDepositReal, finalPayStr: finalPayStr})
  },
  setTicketCode(e){
    var that = this
    var code = e.detail.code
    that.setData({ticketCode: code})
  },
  setDueEndTime(e){
    var nowDate = new Date()
    var days = parseInt(e.detail.value)
    nowDate.setDate(nowDate.getDate() + days)
    var that = this
    that.setData({dueEndDate: nowDate, rentDays: days})
  },
  setPayOption(e){
    var that = this
    var v = e.detail.value
    that.setData({payOption: v})
  },

  setPayMethod(e){
    var that = this
    console.log('pay method changed', e)
    that.setData({payMethod: e.detail.payMethod})
  },

  modPayMethod(e){
    var that = this
    var payMethod = e.detail.payMethod
    that.setData({payMethod: payMethod})
    var rentOrder = that.data.rentOrder
    var payment = rentOrder.order.payments[0]
    
    if (payment != undefined && payment.status == '待支付'){
      var modPayMethodUrl = 'https://' + app.globalData.domainName + '/core/OrderPayment/ModPayMethod/' + payment.id + '?paymethod=' + encodeURIComponent(payMethod) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: modPayMethodUrl,
        method: 'GET',
        success:(res)=>{
          that.setData({payMethod: payMethod})
        }
      })
    }
    
    console.log('rent order', rentOrder)
  },

  submit(){
    var that = this
    var scene = that.data.scene
    scene++
    that.setData({scene: scene, isValid: false})
    var rentOrder = {
      id: 0,
      open_id: that.data.openId,
      cell_number: that.data.cell,
      real_name: that.data.name,
      shop: that.data.shop,
      order_id: 0,
      deposit: that.data.totalDeposit,
      deposit_real: that.data.totalDepositReal,
      deposit_reduce: that.data.depositReduce,
      deposit_reduce_ticket: 0,
      deposit_final: that.data.totalDepositReal - that.data.depositReduce,
      start_date: util.formatDateString(new Date()),
      due_end_date: util.formatDateString(that.data.dueEndDate),
      rental: 0,
      rental_real: 0,
      rental_reduce: 0,
      rental_reduce_ticket: 0,
      rental_final: 0,
      ticket_code: that.data.ticketCode,
      has_guarantee_credit: (that.data.haveCredit? 1 : 0),
      guarantee_credit_photos: that.data.creditImages,
      memo: that.data.memo,
      pay_option: that.data.payOption,
      payMethod: that.data.payMethod
    }
    var rentDetails = []
    var rentItemList = that.data.rentItemList
    for(var i = 0; i < rentItemList.length; i++){
      var memo = rentItemList[i].memo
      if (memo == undefined || memo == ''){
        memo = ''
      }
      var images = rentItemList[i].images
      if (images == undefined || images == ''){
        images = ''
      }
      var item = {id: 0, rent_list_id: 0, rent_item_name: rentItemList[i].name, rent_item_class: rentItemList[i].class, 
        rent_item_code: rentItemList[i].code, deposit: rentItemList[i].deposit, deposit_type: rentItemList[i].depositType,
        unit_rental: rentItemList[i].rental, memo: memo, images: images, start_date: util.formatDate(new Date(rentItemList[i].startDate))}
        rentDetails.push(item)
    }
    rentOrder.details = rentDetails
    var submitUrl = 'https://' + app.globalData.domainName + '/core/Rent/Recept?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: submitUrl,
      method: 'POST',
      data: rentOrder,
      success:(res)=>{
        console.log('rent order', res)
        var rentOrder = res.data
        var order = res.data.order
        if (order == null){
          that.setData({needPay: false, rentOrder: rentOrder})
        }
        else{
          wx.redirectTo({
            url: 'rent_pay?id=' + rentOrder.id,
          })
          
        }
      }
    })
    console.log('rent order', rentOrder)
  },

  checkOrderPaymentStatus(){
    var that = this
    var orderId = that.data.rentOrder.id
    var getUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentOrder/' + orderId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){
          var rentOrder = res.data
          if (rentOrder.order_id > 0 && rentOrder.order != undefined && rentOrder.order != null && rentOrder.order.pay_state == 1){
            clearInterval(that.data.interval)
            wx.showToast({
              title: '支付成功',
              icon: 'success',
              duration: 1000,
              success:()=>{
                wx.redirectTo({
                url: '../admin'
                })
              }
            })
          }
        }
      }
    })
  },
  setPaid(){
    var that = this
    var rentOrder = that.data.rentOrder
    var setUrl = 'https://' + app.globalData.domainName + '/core/Rent/SetPaid/' + rentOrder.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){
          wx.showToast({
            title: '支付成功',
            icon: 'success',
            duration: 1000,
            success:()=>{
              wx.redirectTo({
                url: '../admin',
              })
            }
          })
        }
      }
    })
  },

  setDepositReduce(e){
    var that = this
    var value = parseFloat(e.detail.value)
    if (!isNaN(value)){
      var d = parseFloat(value)
      that.setData({depositReduce: d})
      that.computeTotal()
    }
  },

  setStartDate(e){
    console.log('set start date', e)
    var that = this
    var currentRentItem = that.data.currentRentItem
    var now = new Date()
    var selectedDate = new Date(e.detail.value)
    var isToday = false
    if (selectedDate.getFullYear() == now.getFullYear() && selectedDate.getMonth() == now.getMonth() && selectedDate.getDate() == now.getDate()){
      isToday = true
    }
    currentRentItem.startDate = util.formatDate(selectedDate)
    that.setData({currentRentItem: currentRentItem, isToday: isToday})
  },
  
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var nowDate = new Date()
    var days = 1
    nowDate.setDate(nowDate.getDate() + days)
    that.setData({dueEndDate: nowDate, rentDays: days})
    app.loginPromiseNew.then(function (resolve){
      var getClassUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetClassList'
      wx.request({
        url: getClassUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          var classList = ['请选择...']
          for(var i = 0; i < res.data.length; i++){
            classList.push(res.data[i])
          }
          that.setData({classList: classList})
        }
      })
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
  scroll(e){
    console.log(e)
  }
})
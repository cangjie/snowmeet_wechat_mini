// pages/admin/rent/rent_admit_new.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
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
      depositType:'立即租赁',
      startDate: util.formatDate(new Date()),
      memo: ''
    },
    openId: '',
    name: '',
    shop: '',
    cell: '',
    haveCredit: false,
    totalDepositReal: 0,
    depositReduce: 0,
    payOption: '现场支付',
    rentDays: 2,
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
    currentRentItem.name = ''
    currentRentItem.code = ''
    currentRentItem.rental = 0
    currentRentItem.isNoCode = false
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
      if (!isNaN(amount)){
        var currentRentItem = that.data.currentRentItem
        switch(fieldName){
          case '租金':
            currentRentItem.rental = amount
            break
          case '押金':
            currentRentItem.deposit = amount
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
          icon: 'error'
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
    else{
      
      message = ''
      valid = true
    }
    if (currentRentItem.depositType == '预付押金'){
      if (currentRentItem.deposit > 0){
        message = ''
        valid = true
      }
      else{
        message = '预付押金不为0'
        valid = false
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
      depositType:'立即租赁',
      startDate: util.formatDate(new Date()),
      memo: ''
    }
    that.setData({rentItemList: rentItemList, currentRentItem: currentRentItem})
  },

  selectItem(e){
    var that = this
    var id = e.currentTarget.id
    var rentItemList = that.data.rentItemList
    var currentRentItem = rentItemList[parseInt(id)]
    that.setData({currentRentItem: currentRentItem})
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
    if (e.detail.user_info != null){
      if (e.detail.user_info.cell_number != undefined){
        cell = e.detail.user_info.cell_number
      }
      if (e.detail.user_info.real_name != undefined){
        name = e.detail.user_info.real_name
      }
      if (e.detail.user_info.gender != undefined){
        if (e.detail.user_info.gender == '男'){
          name = name + ' 先生'
        }
        else if (e.detail.user_info.gender == '女'){
          name = name + ' 女士'
        }
      }
      if (e.detail.user_found != undefined && e.detail.user_found == true){
        openId = e.detail.user_info.open_id
      }
      that.setData({cell: cell, name: name, openId: openId})
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
    var totalDepositReal = totalDeposit//that.data.totalDepositReal == 0? totalDeposit : that.data.totalDepositReal
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
      var item = {id: 0, rent_list_id: 0, rent_item_name: rentItemList[i].name, 
        rent_item_code: rentItemList[i].code, deposit: rentItemList[i].deposit,
        unit_rental: rentItemList[i].rental, memo: memo, images: images}
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
          if (order.payments != null && order.payments.length > 0){
            var payment = order.payments[0]
            if (payment.pay_method == '微信支付'){
              var wxaCodeUrl = 'http://weixin.snowmeet.top/show_wechat_temp_qrcode.aspx?scene=pay_payment_id_' + payment.id
              that.setData({needPay: true, rentOrder: rentOrder, wxaCodeUrl: wxaCodeUrl})
              var interval = setInterval(() => {
                that.checkOrderPaymentStatus()
              }, 1000);
              that.setData({interval: interval})
            }
            else{
              if (rentOrder.open_id == ''){
                var wxaCodeUrl = 'http://weixin.snowmeet.top/show_wechat_temp_qrcode.aspx?scene=bind_rent_' + rentOrder.id
                that.setData({needPay: true, rentOrder: rentOrder, wxaCodeUrl: wxaCodeUrl})
              }
              else{
                that.setData({needPay: true, rentOrder: rentOrder})
              }
              
            }
          }
        }
      }
    })
    console.log('rent order', rentOrder)
  },


  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var nowDate = new Date()
    var days = 2
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

  }
})
// pages/admin/rent/rent_admit.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    scene: 0,
    cell: '',
    name: '',
    shop: '南山',
    openId: '',
    //rentItemList: []
    rentItemList: [{name:'', code:'', deposit: 5000, rental: 0, memo:'填写备注', noCode: false, images:''}],
    isValid: false,
    totalDeposit:0,
    totalDepositStr:'',
    totalRental:0,
    totalRentalStr:'',
    haveCredit: false,
    creditImages: '',
    totalDepositReal: 0,
    depositReduce: 0,
    finalPayStr: '',
    payOption: '现场支付',
    rentDays: 1,
    ticketCode: '',
    memo: '',
    payOption: '现场支付',
    payMethod: '微信支付',
    checkInterval: 0
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
  delItem(e){
    var that = this
    var ctrlId = e.currentTarget.id.split('_')
    var ctrlIndex = parseInt(ctrlId[1])
    var rentItemList = that.data.rentItemList
    var newList = []
    for(var i = 0; i < rentItemList.length; i++){
      if (i != ctrlIndex){
        newList.push(rentItemList[i])
      }
    }
    that.setData({rentItemList: newList})
    that.checkValid()
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

  checkValid(){
    var that = this
    switch(that.data.scene){
      case 0:
        if (that.data.shop != '' && that.data.cell != '' && that.data.name != ''){
          that.setData({isValid: true})
        }
        break
      case 1:
        var valid = true
        var rentItemList = that.data.rentItemList
        for(var i = 0; i < rentItemList.length; i++){
          if (rentItemList[i].name == '' || isNaN(rentItemList[i].deposit) || isNaN(rentItemList[i].rental)){
            valid = false
            break
          }
        }
        if (rentItemList.length == 0){
          valid = false
        }
        that.setData({isValid: valid})
      default:
        that.setData({isValid: true})
        break
    }
    that.computeTotal()
  },

  scan(e){
    var ctrlId = e.currentTarget.id.split('_')
    var ctrlIndex = parseInt(ctrlId[1])
    var that = this
    wx.scanCode({
      onlyFromCamera: false,
      success:(res)=>{
        console.log('scan result', res)
        var code = res.result
        var rentItemList = that.data.rentItemList
        that.getItemInfo(code, ctrlIndex)
      }
    })
  },
  next(){
    var that = this
    var scene = that.data.scene
    scene++
    that.setData({scene: scene, isValid: false})
    that.checkValid()
  },

  prev() {
    var that = this
    var scene = that.data.scene
    scene--
    that.setData({scene: scene})
    that.checkValid()
  },
  userInfoUpdate(e){
    console.log('user info update', e)
    var that = this
    var cell = ''
    var name = ''
    var openId = ''
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
    that.checkValid()
  },
  shopSelected(e){
    var that = this
    that.setData({shop: e.detail.shop})
    that.checkValid()
  },
  addMore(e){
    var that = this
    var rentItemList = that.data.rentItemList
    rentItemList.push({name:'', code:'', deposit: 5000, rental: 0, memo:'填写备注', noCode: false, images:''})
    that.setData({rentItemList: rentItemList})
    that.checkValid()
  },

  getItemInfo(code, index){
    var that = this
    var rentItemList = that.data.rentItemList
    var rentItem = rentItemList[index];
    var getItemUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentItem/' + code + '?shop=' + encodeURIComponent(that.data.shop)
    wx.request({
      url: getItemUrl,
      success:(res)=>{
        if (res.statusCode == 200){
          rentItem.code = code
          rentItem.name = res.data.name
          rentItem.deposit = res.data.deposit
          rentItem.rental = res.data.rental
          rentItem.noCode = false
          rentItemList[index] = rentItem
          that.setData({rentItemList: rentItemList})
          that.checkValid()
        }
      }
    })
  },

  modItem(e){
    console.log('mod item', e)
    var ctrlId = e.currentTarget.id.split('_')
    var ctrlIndex = parseInt(ctrlId[1])
    var ctrlName = ctrlId[0]
    var that = this
    var rentItemList = that.data.rentItemList
    var rentItem = rentItemList[ctrlIndex]
    var value = e.detail.value
    switch(ctrlName){
      case 'code':
        rentItem.code = value
        rentItem.noCode = false
        that.getItemInfo(rentItem.code, ctrlIndex)
        break
      case 'name':
        rentItem.name = value
        rentItem.code = ''
        break
      case 'deposit':
        rentItem.deposit = parseFloat(value)
        break
      case 'rental':
        rentItem.rental = parseFloat(value)
        break
      case 'nocode':
        rentItem.noCode = value
        rentItem.code = ''
        break
      case 'memo':
        rentItem.memo = value
        break
      default:
        break
    }
    rentItemList[ctrlIndex] = rentItem
    that.setData({rentItemList: rentItemList})
    that.checkValid()
  },
  uploadItemImages(e){
    console.log('image upload', e)
    var ctrlId = e.currentTarget.id.split('_')
    var ctrlIndex = parseInt(ctrlId[1])
    var that = this
    var rentItemList = that.data.rentItemList
    var images = ''
    var imagesArr = e.detail.files
    for(var i = 0; i < imagesArr.length; i++){
      images = images + (images == '' ? '' : ',') + imagesArr[i].url
    }
    rentItemList[ctrlIndex].images = images
    that.setData({rentItemList: rentItemList})
    that.checkValid()
  },
  uploadCreditImages(e){
    var that = this
    var images = ''
    var imagesArr = e.detail.files
    for(var i = 0; i < imagesArr.length; i++){
      images = images + (images == '' ? '' : ',') + imagesArr[i].url
    }
    that.setData({creditImages: images})
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
  setDepositReduce(e){
    var that = this
    var value = parseFloat(e.detail.value)
    if (!isNaN(value)){
      var d = parseFloat(value)
      that.setData({depositReduce: d})
      that.computeTotal()
    }
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
    var v = e.dtail.value
    that.setData({payOption: v})
  },
  setTicketCode(e){
    var that = this
    var code = e.detail.code
    that.setData({ticketCode: code})
  },
  setMemo(e){
    var that = this
    that.setData({memo: e.detail.value})
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
  setPayMethod(e){
    var that = this
    console.log('pay method changed', e)
    that.setData({payMethod: e.detail.payMethod})
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
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var nowDate = new Date()
    var dueEndDate = nowDate
    dueEndDate.setDate(dueEndDate.getDate() + 1)
    var that = this
    that.setData({dueEndDate: dueEndDate})
    app.loginPromiseNew.then(function (resolve){

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
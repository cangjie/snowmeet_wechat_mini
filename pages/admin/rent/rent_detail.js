// pages/admin/rent/rent_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    showCreditGallery: false,
    rentalReduce: 0,
    rentalReduceTicket: 0
  },

  showGallery(e){
    var that = this
    var id = e.currentTarget.id
    if (id.indexOf('credit')>=0){
      that.setData({showCreditGallery: true})
    }
  },

  getData(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentOrder/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){

          var rentOrder = res.data
          console.log('rent order', rentOrder)

          var startDate = new Date(rentOrder.start_date)
          var currentTime = new Date()

          if (rentOrder.end_date != null){
            currentTime = new Date(rentOrder.end_date)
          }

          rentOrder.guarantee_credit_photos_arr = rentOrder.guarantee_credit_photos.split(',')
          
          rentOrder.deposit_real_str = util.showAmount(rentOrder.deposit_real)
          rentOrder.deposit_reduce_str = util.showAmount(rentOrder.deposit_reduce)
          rentOrder.deposit_final_str = util.showAmount(rentOrder.deposit_final)
          var dueEndTime = new Date(rentOrder.due_end_date)
          rentOrder.due_end_time_str = util.formatDate(dueEndTime) + ' ' + util.formatTimeStr(dueEndTime)
          if (rentOrder.order_id > 0){
            var payTime = new Date(rentOrder.order.payments[0].create_date)
            var orderDate = new Date(rentOrder.create_date)
            rentOrder.paidTimeStr = util.formatDate(payTime) + ' ' + util.formatTimeStr(payTime)
            rentOrder.outTradeNo = rentOrder.order.payments[0].out_trade_no
            rentOrder.create_date_str = util.formatDate(orderDate) + ' ' + util.formatTimeStr(orderDate)
          }
          else{
            rentOrder.paidTimeStr = '-'
            rentOrder.outTradeNo = '-'
          }
          var totalRental = 0
          for(var i = 0; i < rentOrder.details.length; i++)
          {
            var detail = rentOrder.details[i]
            detail.suggestRental_str = util.showAmount(detail.suggestRental)
            if (detail.status == '未归还'){
              detail.real_rental = detail.suggestRental
              detail.real_rental_str = util.showAmount(detail.real_rental)
            }
            else{
              detail.real_rental_str = util.showAmount(detail.real_rental)
            }
            totalRental = totalRental + detail.real_rental
            detail.unit_rental_str = util.showAmount(detail.unit_rental)
            detail.deposit_str = util.showAmount(detail.deposit)
            detail.refund_str = util.showAmount(detail.deposit - detail.real_rental - detail.overtime_charge - detail.reparation)
            detail.imageArr = detail.images.split(',')
            detail.reparationStr = util.showAmount(detail.reparation)
            detail.showGallery = false
            detail.overtime_charge_str = util.showAmount(detail.overtime_charge)

            /*
            if (startDate.getHours() >= 16 && currentTime.getDate() == startDate.getDate()){
              detail.overTime = false
            }
            else if (currentTime.getHours()>=11){
              detail.overTime = true
            }
            else{
              detail.overTime = false
            }
            */
            rentOrder.details[i] = detail

          }
          rentOrder = that.computeAmount(rentOrder)
          that.setData({rentOrder: rentOrder, 
            rentalReduce: rentOrder.rental_reduce, rentalReduceStr: util.showAmount(rentOrder.rental_reduce),
            rentalReduceTicket: rentOrder.rental_reduce_ticket, rentalReduceTicketStr: util.showAmount(rentOrder.rental_reduce_ticket)})
          that.computeTotal()
        }
      }
    })
  },
  setRental(e){
    console.log('input rental', e)
    var that = this
    var id = parseInt(e.currentTarget.id.split('_')[1])
    var value = parseFloat(e.detail.value)
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]

    if (isNaN(value)){
      detail.real_rental = detail.suggestRental
      detail.filled_rental = ''
    }
    
    else {
      detail.filled_rental = value
      detail.real_rental = value
    }
    
    detail.refund_str = util.showAmount(detail.deposit - detail.filled_rental - detail.reparation - detail.overtime_charge)
    that.setData({rentOrder: rentOrder})
    that.computeTotal()
  },

  setReparation(e){
    var that = this
    var id = parseInt(e.currentTarget.id.split('_')[1])
    var value = parseFloat(e.detail.value)
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]

    if (!isNaN(value)){
      detail.reparation = value
    }
    var filledRental = parseFloat(detail.filled_rental)
    if (isNaN(filledRental)){
      filledRental = detail.real_rental
    }
    detail.refund_str = util.showAmount(detail.deposit - filledRental - detail.reparation - detail.overtime_charge)
    that.setData({rentOrder: rentOrder})
    that.computeTotal()
  },

  setRentalReduce(e){
    var value = parseFloat(e.detail.value)
    if (isNaN(value)){
      value = 0
    }
    var that = this
    that.setData({rentalReduce: value})
    that.computeTotal()
  },
  setRentalReduceTicket(e){
    var value = parseFloat(e.detail.value)
    if (isNaN(value)){
      value = 0
    }
    var that = this
    that.setData({rentalReduceTicket: value})
    that.computeTotal()
  },
  computeTotal(){
    var that = this
    var rentOrder = that.data.rentOrder
    var totalRental = 0
    var totalReparation = 0
    var totalOvertimeCharge = 0
    for(var i = 0; i < rentOrder.details.length; i++){
      var rental = 0
      var detail = rentOrder.details[i]
      var filledRental = parseFloat(detail.filled_rental)
      if (isNaN(filledRental)){
        rental = parseFloat(detail.real_rental)
      }
      else {
        rental = filledRental
      }
      totalRental = totalRental + rental
      totalReparation = totalReparation + detail.reparation
      totalOvertimeCharge = totalOvertimeCharge + detail.overtime_charge
    }
    var refundAmount = that.data.rentOrder.deposit_final - totalRental + that.data.rentalReduce + that.data.rentalReduceTicket - totalReparation - totalOvertimeCharge
    that.setData({refundAmount: refundAmount, refundAmountStr: util.showAmount(refundAmount),
      totalRental: totalRental, totalRentalStr: util.showAmount(totalRental), totalReparationStr: util.showAmount(totalReparation), totalOvertimeCharge: totalOvertimeCharge, totalOvertimeChargeStr: util.showAmount(totalOvertimeCharge)})
  },
  
//////set buttons/////////////
  computeAmount(rentOrder){
    var details = rentOrder.details
    for(var i = 0; i < details.length; i++){
      var unit_rental = parseFloat(details[i].unit_rental)
      var real_rental = parseFloat(details[i].real_rental)
      var deposit = parseFloat(details[i].deposit)
      var overtime_charge = parseFloat(details[i].overtime_charge)
      var reparation = parseFloat(details[i].reparation)
      var refund = parseFloat(details[i].refund)
      if (isNaN(unit_rental)){
        details[i].unit_rental_str = "¥0.00"
      }
      else{
        details[i].unit_rental_str = util.showAmount(unit_rental)
      }
      if (isNaN(real_rental)){
        details[i].real_rental_str = "¥0.00"
      }
      else {
        details[i].real_rental_str = util.showAmount(real_rental)
      }
      if (isNaN(deposit)){
        details[i].deposit_str = "¥0.00"
      }
      else{
        details[i].deposit_str = util.showAmount(deposit)
      }
      if (isNaN(overtime_charge)){
        details[i].overtime_charge_str = "¥0.00"
      }
      else{
        var overtime_charge_str = util.showAmount(overtime_charge)
        details[i].overtime_charge_str = overtime_charge_str
      }
      if (isNaN(reparation)){
        details[i].reparationStr = "¥0.00"
      }
      else{
        details[i].reparationStr = util.showAmount(reparation)
      }
      refund = deposit - overtime_charge - reparation - real_rental
      
      details[i].refund_str = util.showAmount(refund)
      details[i].refund = refund
      
    }
    return rentOrder
  },


  setRentStart(e){
    var id = parseInt(e.currentTarget.id)
    if (isNaN(id)){
      return 
    }
    var that = this
    var detail = that.data.rentOrder.details[id]
    var setUrl = 'https://' + app.globalData.domainName + '/core/Rent/SetRentStart/' + detail.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){
          detail = res.data
          var rentOrder = that.data.rentOrder
          rentOrder.details[id] = detail
          
          wx.showToast({
            title: '租赁开始',
            icon: 'success',
            duration: 1000,
            success:()=>{
              rentOrder = that.computeAmount(rentOrder)
              that.setData({rentOrder: rentOrder})
              that.getData()
            }
          })
        }
      }
    })
  },


  setReturn(e){
    var id = parseInt(e.currentTarget.id.split('_')[1])
    if (isNaN(id)){
      return 
    }

    var that = this
    var detail = that.data.rentOrder.details[id]
    var nowDate = util.formatDateString(new Date())
    var realRental = parseFloat(detail.filled_rental)
    var reparation = parseFloat(detail.reparation)
    if (isNaN(realRental)){
      realRental = parseFloat(detail.suggestRental)
    }
    var filledOvertimeCharge = parseFloat(detail.filled_overtime_charge)
    if (detail.overTime && isNaN(filledOvertimeCharge)){
      wx.showToast({
        title: '装备归还超时，请确认超时费用。',
        icon: 'error'

      })
      return false
    }
    var setUrl = 'https://' + app.globalData.domainName + '/core/Rent/SetReturn/' + detail.id
      + '?rental=' + encodeURIComponent(realRental) 
      + '&returnDate=' + encodeURIComponent(nowDate) + '&reparation=' + encodeURIComponent(reparation)
      + '&memo=' + encodeURIComponent(detail.memo) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      + '&overTimeCharge=' + encodeURIComponent(detail.overtime_charge)
    wx.request({
      url: setUrl,
      method: 'GET',
      success:(res) => {
        if (res.statusCode == 200){
          that.getData()
        }
      }
    })
    return true
  },
  setMod(e){
    var id = parseInt(e.currentTarget.id)
    if (isNaN(id)){
      return 
    }
    var that = this
    var rentOrder = that.data.rentOrder
    rentOrder.details[id].isEdit = true
    var classStr = rentOrder.details[id].rent_item_class
    var classId = 0
    var classList = that.data.classList
    for(var i = 0; i < classList.length; i++){
      if (classList[i] == classStr){
        classId = i
        break
      }
    }
    rentOrder.details[id].classIndex = classId
    rentOrder = that.computeAmount(rentOrder)
    that.setData({rentOrder: rentOrder})
  },
  setAppend(e){
    var id = parseInt(e.currentTarget.id)
    var that = this
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    if (detail.id != 0){
      return
    }
    //detail.images = ''
    if (!that.checkValid(detail)){
      return
    }
    var updateUrl = 'https://' + app.globalData.domainName + '/core/Rent/AppendDetail?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method: 'POST',
      data: detail,
      success:(res)=>{
        if (res.statusCode == 200){
          console.log('append detail', res)
          detail = res.data
          rentOrder.details[id] = detail
          rentOrder = that.computeAmount(rentOrder)
          that.setData({rentOrder: rentOrder})
          that.setRentStart(e)
        }
      }
    })
  },
  setInstance(e){
    var id = parseInt(e.currentTarget.id)
    var that = this
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    if (!that.checkValid(detail)){
      return
    }
    var updateUrl = 'https://' + app.globalData.domainName + '/core/Rent/UpdateDetail?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method: 'POST',
      data: detail,
      success:(res)=>{
        if (res.statusCode == 200){
          console.log('update detail', res)
          that.setRentStart(e)
        }
      }
    })
  },
  setKeep(e){
    var id = parseInt(e.currentTarget.id)
    var that = this
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    detail.editType = '暂存'
    detail.isEdit = true
    detail.unit_rental_str = util.showAmount(detail.unit_rental)
    rentOrder.details[id] = detail

    that.setData({rentOrder: rentOrder})
  },

  reserveMore(e){
    var that = this
    var id = parseInt(e.currentTarget.id.split('_')[1])
    
    var detail = that.data.rentOrder.details[id]
    if (that.setReturn(e)){
      var reserveUrl = 'https://' + app.globalData.domainName + '/core/Rent/ReserveMore/' + detail.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: reserveUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode == 200){
            that.getData()
          }
        }
      })
    }

  },

////set buttons end/////


  setMemo(e){
    var id = parseInt(e.currentTarget.id.split('_')[1])
    if (isNaN(id)){
      return 
    }
    var that = this
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    detail.memo = e.detail.value
    that.setData({rentOrder: rentOrder})
  },
  setOrderMemo(e){
    var that = this
    var rentOrder = that.data.rentOrder
    rentOrder.memo = e.detail.value
    that.setData({rentOrder: rentOrder})
  },
  setRefundAmount(e){
    var value = parseFloat(e.detail.value)
    var that = this
    if (isNaN(value)){
      return
    }
    that.setData({refundAmount: value})
  },
  refund(){
    var that = this
    var refundUrl = 'https://' + app.globalData.domainName + '/core/Rent/Refund/' + that.data.rentOrder.id 
    + '?amount=' + encodeURIComponent(that.data.refundAmount) + '&memo=' + encodeURIComponent(that.data.rentOrder.memo)
    + '&rentalReduce=' + encodeURIComponent(that.data.rentalReduce) 
    + '&rentalReduceTicket=' + encodeURIComponent(that.data.rentalReduceTicket)
    + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: refundUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode == 200){
          that.getData()
        }
      }
    })
  },
  showDetailGallery(e){
    var id = parseInt(e.currentTarget.id)
    var that = this
    if (isNaN(id)){
      return
    }
    var rentOrder = that.data.rentOrder
    rentOrder.details[id].showGallery = true
    that.setData({rentOrder: rentOrder})
    rentOrder.details[id].showGallery = false
  },
  setOvertimeCharge(e){
    var id = parseInt(e.currentTarget.id)
    var that = this
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    
    var value = parseFloat(e.detail.value)
    if (isNaN(value)){
      return
    }
    detail.filled_overtime_charge = value
    detail.overtime_charge = value
    detail.refund_str = util.showAmount(detail.deposit - detail.real_rental - detail.reparation - detail.overtime_charge)
    that.setData({rentOrder: rentOrder})
    that.computeTotal()

  },

  

  setCode(e){
    console.log('input code', e)
  },

  setTextValue(e){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var id = parseInt(idArr[1])
    var name = idArr[0]
    var rentOrder = that.data.rentOrder
    var v = e.detail.value
    var detail = rentOrder.details[id]
    switch(name){
      case 'name':
        detail.rent_item_name = v
        break
      case 'code':
        detail.rent_item_code = v
        break
      default:
        break
    }
    that.setData({rentOrder: rentOrder})
  },

  selectClass(e){
    var that = this
    var id = e.currentTarget.id
    var v = parseInt(e.detail.value)
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    var classList = that.data.classList
    var className = classList[v]
    detail.classIndex = v
    detail.rent_item_class = className
    that.setData({rentOrder: rentOrder})
  },

  setCharge(e){
    var id = parseInt(e.currentTarget.id)
    if (isNaN(id)){
      return 
    }
    var that = this
    var detail = that.data.rentOrder.details[id]

    var realRental = parseFloat(detail.filled_rental)
    var reparation = parseFloat(detail.reparation)
    if (isNaN(realRental)){
      realRental = parseFloat(detail.real_rental)
    }
    

    var modUrl = 'https://' + app.globalData.domainName + '/core/Rent/ModItemInfo/' + detail.id
      + '?rental=' + encodeURIComponent(realRental) 
      + '&reparation=' + encodeURIComponent(reparation)
      + '&memo=' + encodeURIComponent(detail.memo) 
      + '&overTimeCharge=' + encodeURIComponent(detail.overtime_charge)
      + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    console.log('modurl', modUrl)
  
    wx.request({
      url: modUrl,
      method:'GET',
      success:(res)=>{
        if (res.statusCode == 200)
        {
          wx.showToast({
            title: '修改成功',
            icon: 'success',
            success:()=>{
              var rentOrder = that.data.rentOrder
              rentOrder.details[id].isEdit = false
              that.setData({rentOrder: rentOrder})
            }

          })
        
        }
      }
    })


    
  },

  gotoPay(){
    var that = this
    wx.navigateTo({
      url: 'rent_pay?id=' + that.data.id,
    })
  },

  scan(e){
    var id = e.currentTarget.id
    var that = this
    wx.scanCode({
      onlyFromCamera: false,
      success:(res)=>{
        console.log('scan result', res)
        var code = res.result

        //var currentRentItem = that.data.currentRentItem
        //currentRentItem.code = code
        that.getItemInfo(code, id)
      }
    })
  },
  getItemInfo(code, index){
    var that = this
    var currentRentItem = that.data.currentRentItem
    var classList = that.data.classList
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[index]
    var getItemUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentItem/' + code + '?shop=' + encodeURIComponent('万龙')
    wx.request({
      url: getItemUrl,
      success:(res)=>{
        if (res.statusCode == 200){
          detail.rent_item_name = res.data.name
          detail.rent_item_class = res.data.class
          detail.rent_item_code = code
          detail.classIndex = 0
          for(var i = 0; i < classList.length; i++){
            if (classList[i] == detail.rent_item_class){
              detail.classIndex = i
              break;
            }
          }
          detail.unit_rental = res.data.rental
          //detail.deposit = res.data.deposit
          that.setData({rentOrder: rentOrder})
        
        }
      }
    })
  },

  addMore(){
    var that = this
    var rentOrder = that.data.rentOrder
    var detail = {
      rent_item_code: '',
      rent_item_name: '',
      rent_item_class: '',
      rent_list_id: rentOrder.id,
      classIndex: 0,
      status: '未领取',
      deposit_type: '立即租赁',
      due_end_time_str: util.formatDateString(new Date()),
      unit_rental: 0,
      unit_rental_str: '¥0.00',
      timeLength: '1天',
      deposit: 0,
      deposit_str: '¥0.00',
      real_rental: 0,
      real_rental_str: '¥0.00',
      overTime: false,
      overtime_charge: 0,
      overtime_charge_str: '¥0.00',
      reparation: 0,
      reparationStr: '¥0.00',
      refund: 0,
      refund_str: '¥0.00',
      id: 0,
      isEdit: true,
      images: '',
      memo: ''

    }
    rentOrder.details.push(detail)
    that.setData({rentOrder: rentOrder})
  },

  restore(){
    var that = this
    var rentOrder = that.data.rentOrder
    for(var i = 0; i < rentOrder.details.length; i++){
      rentOrder.details[i].isEdit = false
    }
    that.setData({rentOrder: rentOrder})
  },

  


  setUnitRental(e){
    var that = this
    var id = parseInt(e.currentTarget.id)
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    var v = parseFloat(e.detail.value)
    if (!isNaN(v)){
      detail.unit_rental = v
      detail.unit_rental_str = util.showAmount(v)
      that.setData({rentOrder: rentOrder})
    }
  },

  save(e){
    var that = this
    var rentOrder = that.data.rentOrder
    var id = parseInt(e.currentTarget.id)
    var detail = rentOrder.details[id]
    var updateUrl = 'https://' + app.globalData.domainName + '/core/Rent/UpdateDetail?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method: 'POST',
      data: detail,
      success:(res)=>{
        if (res.statusCode == 200){
          detail.isEdit = false
          rentOrder.details[id] = detail
          that.computeAmount(rentOrder)
          that.setData({rentOrder: rentOrder})
        }
      }
    })
  },

  checkValid(detail){
    var msg = ''
    if (detail.rent_item_name == ''){
      msg = '请填写名称'
    }
    else if (detail.rent_item_class == ''){
      msg = '请选择分类'
    }
    if (msg != ''){
      wx.showToast({
        title: msg,
        duration: 1000,
        success: (res)=>{

        }
      })
      return false
    }
    else{
      return true
    }
  },

  change(e){
    var that = this
    var id = e.currentTarget.id
    var rentOrder = that.data.rentOrder
    var detail = rentOrder.details[id]
    var detailId = detail.id


  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var id = options.id
    that.setData({id: id})
    app.loginPromiseNew.then(function(resolve){
      var getClassUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetClassList'
      wx.request({
        url: getClassUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          var classList = []
          for(var i = 0; i < res.data.length; i++){
            classList.push(res.data[i])
          }
          that.setData({classList: classList})
          that.getData()
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
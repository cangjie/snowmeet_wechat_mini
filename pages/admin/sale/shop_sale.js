// pages/admin/sale/shop_sale.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    payMethodList:['微信支付', '支付宝转账', '微信转账','多拉宝', 'POS刷卡', '现金'],
    payMethodSelectedIndex: 0,
    showCustomerInfo: false,
    payOptionList:['全额支付', '部分支付', '暂缓支付', '无需付款'],
    payOptionSelectedIndex: 0,
    role:'',
    open_id: '',
    cell: '',
    code:'',
    userInfoDisplay: true,
    ticketsRefresh: false,
    mi7Orders:[{mi7OrderNo: null, mi7OrderSalePrice: null, mi7OrderChargePrice: null}],
    ticketDiscount:0,
    othersDiscount:0,
    totalSalePrice:0,
    totalChargePrice:0,
    currentCharge: 0,
    soreRate: 0,
    score:0,
    orderId: 0,
    isGiveUpScore: false
  },

  computeScore(){
    var that = this
    var finalPrice = that.data.totalChargePrice - that.data.ticketDiscount - that.data.othersDiscount
    var getScoreRate = 'https://' + app.globalData.domainName + '/core/OrderOnlines/GetScoreRate?orderPrice=' + encodeURIComponent(that.data.totalSalePrice) + '&finalPrice=' + encodeURIComponent(finalPrice)
    wx.request({
      url: getScoreRate,
      method: 'GET',
      success:(res)=>{
        var scoreRate = parseFloat(res.data)
        if (!isNaN(scoreRate)){
          var score = finalPrice * scoreRate
          that.setData({scoreRate: scoreRate, score:score})
        }
      }
    })
  },

  addMi7Order(e){
    var that = this
    var mi7Orders = that.data.mi7Orders
    mi7Orders.push({mi7OrderNo: null, mi7SalePrice: null, mi7ChargePrice: null})
    that.setData({mi7Orders: mi7Orders})
  },
  ticketDiscount(e){
    var that = this
    var discount = parseFloat(e.detail.value)
    if (!isNaN(discount)){
      that.setData({ticketDiscount: discount})
    }
    else{
      that.setData({ticketDiscount: 0})
    }
    that.computeScore()
  },
  othersDiscount(e){
    var that = this
    var discount = parseFloat(e.detail.value)
    if (!isNaN(discount)){
      that.setData({othersDiscount: discount})
    }
    else{
      that.setData({othersDiscount: 0})
    }
    that.computeScore()
  },
  cellChanged(e){
    this.setData({open_id: ''})
    console.log('cell changed:', e)
    this.setData({open_id: e.detail.value})
  },

  setCurrentCharge(e){
    var that = this
    var currentCharge = parseFloat(e.detail.value)
    if (!isNaN(currentCharge)){
      that.setData({currentCharge: currentCharge})
    }
    else{
      //that.setData({currentCharge: 0})
      wx.showToast({
        title: '请填写正确的当前支付金额',
        icon: 'none'
      })
      return
    }
  },
  payMethodChanged(e){
    var that = this
    console.log('pay method changed', e)
    that.setData({payMethod: e.detail.payMethod})
    /*
    console.log('pay method changed', e)
    var that = this
    var selectedValue = e.detail.value
    var showCustomerInfo = that.data.showCustomerInfo
    if (selectedValue >0){
      showCustomerInfo = true
    }
    else{
      showCustomerInfo = false
    }
    var displayUserInfo = that.data.userInfoDisplay
    if (selectedValue != 0){
      displayUserInfo = true
    }
    that.setData({payMethodSelectedIndex: selectedValue, showCustomerInfo: showCustomerInfo,
      userInfoDisplay: displayUserInfo})
      */
  },
  payOptionChanged(e){
    var that = this
    var selectedValue = e.detail.value
    that.setData({payOptionSelectedIndex: selectedValue})
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    if (options.cell != undefined || options.cell != null){
      that.setData({cell: options.cell})
    }
    if (options.code != undefined || options.code != null){
      that.setData({code: options.code})
    }
    if (options.openid != undefined || options.openid != null){
      that.setData({open_id: options.openid})
    }

    if (options.mi7OrderStr != undefined || options.mi7OrderStr != null){
      that.setData({mi7OrderStr: options.mi7OrderStr})
      
    }

    app.loginPromiseNew.then(function(resolve){
      that.setData({role: app.globalData.role})
    })
  },


  changeMi7Order(e){
    console.log('mi7 order changed:', e)
    var that = this
    that.setData({mi7OrderStr: e.detail.mi7OrderStr, mi7Orders: e.detail.mi7Orders, totalSalePrice: e.detail.totalSalePrice, totalChargePrice: e.detail.totalChargePrice})
    that.computeScore()
  },

  userFound(e){
    console.log('User Found', e)
    var that = this
    var code = that.data.code.trim()
    if (e.detail.user_found){
      that.setData({user_info: e.detail.user_info})
      var getTicketsUrl = 'https://' + app.globalData.domainName + '/core/ticket/GetTicketsByUser/0?openId=' 
      + encodeURIComponent(e.detail.user_info.open_id) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getTicketsUrl,
        method: 'GET',
        success:(res)=>{
          console.log('current tickets', res)
          for(var i = 0; i < res.data.length; i++){
            code = code + ((code == '')? '' : ',') + res.data[i].code
          }
          that.setData({code: code, ticketsRefresh: false})
          that.setData({ticketsRefresh: true})
        }
      })
    }
    else {
      if (that.data.payMethodSelectedIndex == 0){
        that.setData({userInfoDisplay: false})
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

  },

  submit(){
    //wx.navigateBack()
    var that = this
    var order = {}
    order.id = 0
    order.open_id = ''
    order.type = '店销现货'
    if (that.data.shop == ''){
      wx.showToast({
        title: '请选择门店',
        icon: 'none'
      })
      return
    }
    order.shop = that.data.shop
    if (that.data.user_info != undefined && that.data.user_info != null){
      if (that.data.user_info.open_id != null){
        order.open_id = that.data.user_info.open_id
      }
      if (that.data.user_info.cell_number != null){
        order.cell_number = that.data.user_info.cell_number
      }
      var name = ''
      if (that.data.user_info.real_name != null){
        name = that.data.user_info.real_name
      }
      if (that.data.user_info.gender != null){
        if (that.data.user_info.gender == '女'){
          name = name + '女士'
        }
        else {
          name = name + '先生'
        }
      }
      if (name == ''){
        name = that.data.user_info.nick
      }
      order.name = name
    }
    else{
      order.cell_number = ''
      order.open_id = ''
      order.name = ''
    }
    
    order.pay_method = that.data.payMethod
    if (!isNaN(that.data.totalChargePrice)){
      order.order_price = that.data.totalSalePrice
    }
    else{
      wx.showToast({
        title: '零售总价不对。',
        icon: 'none'
      })
      return
    }
    if (!isNaN(that.data.totalChargePrice)){
      order.order_real_pay_price = that.data.totalChargePrice
    }
    else{
      wx.showToast({
        title: '订单总价不对。',
        icon: 'none'
      })
      return
    }
    order.pay_state = 0
    order.code = ''
    order.ssyn = ''
    order.memo = ''
    order.shop = that.data.shop
    order.mchid = '0'
    order.ticket_amount = that.data.ticketDiscount
    order.have_score = (that.data.isGiveUpScore?0:1)
    order.score_rate = 0
    order.generate_score = 0
    order.ticket_code = that.data.ticketCode
    order.out_trade_no = ''
    order.pay_memo = that.data.payOptionList[that.data.payOptionSelectedIndex]
    order.other_discount = that.data.othersDiscount
    order.final_price = that.data.totalChargePrice - that.data.ticketDiscount - that.data.othersDiscount

    if (order.totalSalePrice == 0){
      wx.showToast({
        title: '请正确填写销售总价。',
        icon: 'none'
      })
      return
    }
    if (order.totalChargePrice == 0){
      wx.showToast({
        title: '请正确填写成交总价。',
        icon: 'none'
      })
      return
    }

    if (order.final_price == 0){
      wx.showToast({
        title: '订单最终支付金额不对。',
        icon: 'none'
      })
      return
    }
    switch(order.pay_memo){
      case '全额支付':
        var payment = {}
        payment.order_id = 0
        payment.pay_method = order.pay_method
        payment.amount = order.final_price
        order.payments = []
        order.payments.push(payment)
        break
      case '部分支付':
        var payment = {}
        payment.order_id = 0
        payment.pay_method = order.pay_method
        payment.amount = that.data.currentCharge
        order.payments = []
        order.payments.push(payment)
        break
      case '无需支付':
        break
        
    }
    var mi7Orders = that.data.mi7Orders
    order.mi7Orders = []
    for(var i = 0; i < mi7Orders.length; i++){
      var mi7 = {}
      mi7.id = 0
      mi7.order_id = 0
      mi7.mi7_order_id = mi7Orders[i].mi7OrderNo
      mi7.sale_price = mi7Orders[i].mi7SalePrice
      mi7.real_charge = mi7Orders[i].mi7ChargePrice
      mi7.barCode = mi7Orders[i].barCode
      order.mi7Orders.push(mi7)
    }
    order.user = that.data.user_info
    var submitUrl = 'https://' + app.globalData.domainName + '/core/orderonlines/placeorderbystaff?staffSessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: submitUrl,
      method: 'POST',
      data: order,
      success:(res)=>{
        console.log('submit order', res)
        var qrCodeUrl = 'https://' + app.globalData.domainName + '/core/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=confirm_order_id_' + res.data.id)
        if (res.data.payments != null && res.data.payments.length > 0 && res.data.payments[0].pay_method == '微信支付'){
          qrCodeUrl = 'https://' + app.globalData.domainName + '/core/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=pay_payment_id_' + res.data.payments[0].id)
        }
        
        //var intervalId = setInterval(that.checkPayment, 1000)
        that.setData({orderId: res.data.id, submitedOrder: res.data, qrCodeUrl: qrCodeUrl})
        if (res.data.pay_method == '微信支付' && res.data.pay_memo != '无需付款'){
          var intervalId = setInterval(that.checkPayment, 1000)
          that.setData({intervalId: intervalId})
        }
        if (order.ticket_code != undefined && order.ticket_code != null && order.ticket_code != ''){
          var ticketUrl = 'https://' + app.globalData.domainName + '/core/Ticket/GetTicket/' + order.ticket_code
          wx.request({
            url: ticketUrl,
            method: 'GET',
            success:(res)=>{
              that.setData({orderTicket: res.data})
            }
          })
        }
      }
    })
  },
  checkPayment(){
    var that = this
    var getOrderUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/GetWholeOrderByStaff/' + that.data.orderId + '?staffSessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getOrderUrl,
      method: 'GET',
      success:(res)=>{
        console.log('check order payment info', res)
        var order = res.data
        if (order.payments[0].status == '支付成功'){
          wx.showToast({
            title: '顾客支付完成',
            icon: 'success',
            success:(res)=>{
              clearInterval(that.data.intervalId)
              that.data.intervalId = 0
              wx.redirectTo({
                url: 'order_list',
              })
            }
          })
        }
      }
    })
  },
  shopSelected(e){
    console.log('shop selected', e)
    var that = this
    that.setData({shop: e.detail.shop})
  },
  ticketSelected(e){
    console.log('ticket selected', e)
    var that = this
    that.setData({ticketCode: e.detail.code})
  },
  userUpdate(e){
    console.log('user info update:', e)
    var that = this
    that.setData({user_info: e.detail.user_info})
  },
  giveUpScore(e){
    var that = this
    if (e.detail.value) {
      that.setData({isGiveUpScore: true, scoreRate: 0, score: 0})
    }
    else {
      that.setData({isGiveUpScore: false})
      that.computeScore()
    }
  },
  setPaymentSucess(){
    var that = this
    var order = that.data.submitedOrder
    if (order.payments == null || order.payments == undefined || order.payments.length == 0){
      wx.showToast({
        title: '无法确认收款',
        icon: 'none'
      })
      return
    }
    var payment = order.payments[order.payments.length - 1]
    var setSuccessUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/SetPaymentSuccess/' + payment.id + '?staffSessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setSuccessUrl,
      method: 'GET',
      success: (res)=>{
        var orderRefresh = res.data
        if (orderRefresh != undefined && orderRefresh != null){
          wx.showToast({
            title: '订单已确认收款',
            icon: 'none',
            success:()=>{
              wx.navigateTo({
                url: '/pages/admin/sale/shop_sale_entry',
              })
            }
          })
          
        }
      }
    })
  },
  confirmNonPaidOrder(){
    var that = this
    var setSuccessUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/SetPaymentSuccess/' + that.data.submitedOrder.id + '?staffSessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setSuccessUrl,
      method: 'GET',
      success:(res)=>{
        var orderRefresh = res.data
        if (orderRefresh != undefined && orderRefresh != null){
          wx.showToast({
            title: '订单已确认无需付款',
            icon: 'none',
            success:()=>{
              wx.navigateTo({
                url: '/pages/admin/sale/shop_sale_entry',
              })
            }
          })
          
        }
      }
    })
  }
})
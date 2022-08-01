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
    payOptionList:['全额支付', '部分支付', '无需付款'],
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
    score:0
  },

  modMi7Order(e){
    console.log('input mi7 order', e)
    var that = this
    var mi7Orders = that.data.mi7Orders
    var index = -1
    var sourceId = e.currentTarget.id
    var sourceName = ''
    try{
      index = parseInt(sourceId.split('_')[1])
      sourceName = sourceId.split('_')[0]
    }
    catch{
      return;
    }
    switch(sourceName.trim()){
      case 'mi7OrderNo':
        var orderNo = e.detail.value
        if (orderNo.trim() == ''){
          wx.showToast({
            title: '订单号不能为空。',
            icon: 'none'
          })
        }
        else{
          mi7Orders[index].mi7OrderNo = orderNo
        }
        break
      case 'mi7OrderSalePrice':
        var salePrice = parseFloat(e.detail.value)
        if (isNaN(salePrice)){
          wx.showToast({
            title: '请填写正确格式的价格。',
            icon: 'none'
          })
          mi7Orders[index].mi7OrderSalePrice = null
        }
        else{
          mi7Orders[index].mi7OrderSalePrice = salePrice.toString()
        }
        break
      case 'mi7OrderChargePrice':
        var chargePrice = parseFloat(e.detail.value)
        if (isNaN(chargePrice)){
          wx.showToast({
            title: '请填写正确格式的价格。',
            icon:'none'
          })
          mi7Orders[index].mi7OrderChargePrice = null
        }
        else{
          mi7Orders[index].mi7OrderChargePrice = chargePrice.toString()
        } 
        break
      default:
        break
    }
    var totalSalePrice = 0
    var totalChargePrice = 0;
    for(var i = 0; i < mi7Orders.length; i++){
      var salePrice = parseFloat(mi7Orders[i].mi7OrderSalePrice)
      if (!isNaN(salePrice)){
        totalSalePrice = totalSalePrice + salePrice
      }
      var chargePrice = parseFloat(mi7Orders[i].mi7OrderChargePrice)
      if (!isNaN(chargePrice)){
        totalChargePrice = totalChargePrice + chargePrice
      }
    }
    that.setData({mi7Orders: mi7Orders, totalChargePrice: totalChargePrice, totalSalePrice: totalSalePrice})
    that.computeScore()
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
    if (options.cell != null){
      that.setData({cell: options.cell})
    }
    if (options.code != null){
      that.setData({code: options.code})
    }
    if (options.openid != null){
      that.setData({open_id: options.openid})
    }
    app.loginPromiseNew.then(function(resolve){
      that.setData({role: app.globalData.role})
    })
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
    order.type = '店销现货'
    order.shop = that.data.shop
    if (that.data.user_info != null){
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
      order.pay_method = that.data.payMethodList[that.data.payMethodSelectedIndex]
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
      order.mchid = 0
      order.ticket_amount = that.data.ticketDiscount
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
        mi7.sale_price = mi7Orders[i].mi7OrderSalePrice
        mi7.real_charge = mi7Orders[i].mi7OrderChargePrice
        order.mi7Orders.push(mi7)
      }

      var submitUrl = 'https://' + app.globalData.domainName + '/core/orderonlines/placeorderbystaff?staffSessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: submitUrl,
        method: 'POST',
        data: order,
        success:(res)=>{
          console.log('submit order', res)
        }

      })

    }
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
  }
})
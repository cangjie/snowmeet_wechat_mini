const app = getApp()
const util = require("../../utils/util")
const data = require('../../utils/data.js')
// components/care/care_back_drop.js
Component({

  /**
   * Component properties
   */
  properties: {
    order: Object
  },

  /**
   * Component initial data
   */
  data: {
    allWellFormed: false,
    paying: false,
    useDeposit: false
  },
  lifetimes:{
    ready(){
      var that = this
      app.loginPromiseNew.then(function(resolve){
        var order = that.properties.order
        //order.paying_amountStr = util.showAmount(order.paying_amount)
        that.setData({order})
        if (order.member_id){
          data.getMemberPromise(order.member_id, app.globalData.sessionKey).then(function (member){
            var availableDeposit = (member && member.availableDeposit && !isNaN(member.availableDeposit))? 
              parseFloat(member.availableDeposit) : 0
            that.setData({member, availableDeposit, availableDepositStr: util.showAmount(availableDeposit)})
          })
        }
        
        
        that.renderData()
      })
    }
  },

  /**
   * Component methods
   */
  methods: {
    renderData(){
      var that = this
      var order = that.data.order
      var total = 0
      var allWellFormed = true
      for(var i = 0; i < order.cares.length; i++){
        var care = order.cares[i]
        var services = ''
        if (care.need_edge == 1){
          services += (services==''?'':',') + '修刃' + care.edge_degree
        }
        if (care.need_wax == 1){
          services += (services==''?'':',') + '热蜡' 
        }
        if (care.need_unwax == 1){
          services += (services==''?'':',') + '刮蜡' 
        }
        if (care.repair_memo && care.repair_memo != ''){
          services += care.repair_memo
        }
        if (care.free_wax==1){
          services += (services==''?'':',') + '机打蜡' 
        }
        if (care.urgent == 1){
          services += '加急'
        }
        care.services = services
        if (!care.summary && care.ticket 
          && (care.ticket.template_id == 17 || care.ticket.template_id == 18)){
            care.summary = 0
          }
        total += care.summary
        if (util.getCareWellFormMessage(care) != ''){
          allWellFormed = false
        }
      }
      that.setData({order, total, totalStr: util.showAmount(total), allWellFormed})
    },
    setCurrent(e){
      var that = this
      var order = that.data.order
      var id = parseInt(e.currentTarget.id)
      for(var i = 0; order && order.cares && i < order.cares.length; i++){
        if (i == id){
          order.cares[i].current = 1
        }
        else{
          order.cares[i].current = 0
        }
      }
      that.setData({order})
      that.triggerEvent('UpdateCare', {order})
    },
    del(e){
      var that = this
      var id = parseInt(e.currentTarget.id)
      var order = that.data.order
      var newCares = []
      for(var i = 0; order && order.cares && order.cares.length > 1 && i < order.cares.length; i++){
        if (i != id){
          newCares.push(order.cares[i])
        }
      }
      if (newCares.length >= 1){
        order.cares = newCares
      }
      that.setData({order})
      that.triggerEvent('CareOrderUpdate', {order, refreshSelf: true})
    },
    placeOrder(e){
      var that = this
      var order = that.data.order
      order.id = 0
      order.valid = 1
      var haveFreeRepair = false
      for(var i = 0; order.cares && i < order.cares.length; i++){
        var care = order.cares[i]
        care.id = 0
        care.order_id = order.id
        care.valid = 1
        if (care.repair_memo && care.repair_memo != ''){
          care.need_repair = 1
        }
        if (care.need_repair == 1 && (!care.repair_charge || care.repair_charge == 0 )){
          haveFreeRepair = true
        }
        for(var j = 0; order.cares[i].careImages && j < order.cares[i].careImages.length; j++){
          order.cares[i].careImages[j].id = 0
          order.cares[i].careImages[j].care_id = order.cares[i].id
          if (order.cares[i].careImages[j].image){
            order.cares[i].careImages[j].image_id = order.cares[i].careImages[j].image.id
          }
          order.cares[i].careImages[j].valid = true
          order.cares[i].careImages[j].image = null
        }
      }
      console.log('place order', that.data.order)
      if (haveFreeRepair){
        wx.showModal({
          title: '订单确认',
          content: '当前订单包含了免费的维修项目，是否确认？',
          complete: (res) => {
            if (res.cancel) { 
            }
            if (res.confirm) {
              that.confirmOrder(e)
            }
          }
        })
      }
      else{
        that.confirmOrder(e)
      }
    },
    confirmOrder(e){
      var that = this
      var order = that.data.order
      var msg = ''
      for(var i = 0; order.cares != null && i < order.cares.length; i++){
        if (order.cares[i].careImages == null || order.cares[i].careImages.length == 0){
          msg = order.cares[i].brand + ' ' + order.cares[i].scale + ' 未上传照片，是否继续下单？'
          break
        }
      }
      if (msg!=''){
        wx.showModal({
          title: '缺少照片',
          content: msg,
          complete: (res) => {
            if (res.cancel) {
              
            }
            if (res.confirm) {
              that.placeOrderReal(e)
            }
          }
        })
      }
      else{
        that.placeOrderReal(e)
      }
    },
    placeOrderReal(e){
      var that = this
      that.setData({paying: true})
      var postUrl = app.globalData.requestPrefix + 'Order/PlaceOrder?sessionKey=' + app.globalData.sessionKey
      util.performWebRequest(postUrl, that.data.order).then(function (order){
        console.log('order', order)
        that.setData({order})
        order.paying_amountStr = util.showAmount(order.paying_amount)
        that.setData({order})
        if (order.paying_amount == 0){
          wx.navigateTo({
            url: '/pages/admin/care/order_detail?orderId=' + order.id,
          })
        }
      })
    },
    dealPaidResult(e) {
      var that = this
      var orderId = e.detail.id
      data.getOrderByStaffPromise(orderId, app.globalData.sessionKey).then(function (order) {
        var paid = util.orderPaid(order)
        if (paid) {
          wx.showToast({
            title: '支付成功',
            icon: 'success',
            success:()=>{
              /*
              wx.navigateTo({
                url: '/pages/admin/care/care_order_detail?id=' + order.id,
              })
              */
              that.triggerEvent('Jump', { url: '/pages/admin/care/order_detail?orderId=' + order.id })
            }
          })
          
        }
      })

    },
    setUseDeposit(e){
      var that = this
      if (e.detail.value.length > 0){
        that.setData({useDeposit: true, paying: false})
      }
      else{
        that.setData({useDeposit: false, paying: false})
      }
    },
    payWithDeposit(e){
      var that = this
      var order = that.data.order
      var title = '储值消费确认'
      var content = '顾客现有可用储值' + that.data.availableDepositStr + '  本次消费' + that.data.order.paying_amountStr
      wx.showModal({
        title: title,
        content: content,
        complete: (res) => {
          if (res.cancel) {
            
          }
          if (res.confirm) {
            that.setData({paying: true})
            data.payWithDepositPromise(order.id, app.globalData.sessionKey).then(function (order){
              wx.showToast({
                title: '支付成功',
              })
              wx.redirectTo({
                url: '/pages/admin/care/order_detail?orderId=' + order.id ,
              })
            })
          }
        }
      })
    }
  }
})
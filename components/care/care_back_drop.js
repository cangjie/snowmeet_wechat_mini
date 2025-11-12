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
    paying: false
  },
  lifetimes:{
    ready(){
      var that = this
      app.loginPromiseNew.then(function(resolve){
        that.setData({order: that.properties.order})
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
      //var cares = order.cares
      var total = 0
      var allWellFormed = true
      for(var i = 0; i < order.cares.length; i++){
        var care = order.cares[i]
        var services = ''
        if (care.need_edge == 1){
          services += (services==''?'':',') + '修刃' + care.edge_degree
        }
        if (care.need_wax == 1){
          services += (services==''?'':',') + '打蜡' 
        }
        if (care.need_unwax == 1){
          services += (services==''?'':',') + '刮蜡' 
        }
        if (care.repair_memo && care.repair_memo != ''){
          services += care.repair_memo
        }
        if (care.urgent == 1){
          services += '加急'
        }
        care.services = services
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
      for(var i = 0; order.cares && i < order.cares.length; i++){
        var care = order.cares[i]
        care.id = 0
        care.order_id = order.id
        care.valid = 1
        if ((care.repair_memo && care.repair_memo != '' ) || (care.repair_charge && care.repair_charge > 0)){
          care.need_repair = 1
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
      that.setData({paying: true})
      var postUrl = app.globalData.requestPrefix + 'Order/PlaceOrder?sessionKey=' + app.globalData.sessionKey
      util.performWebRequest(postUrl, that.data.order).then(function (order){
        console.log('order', order)
        that.setData({order})
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

    }
  }
})
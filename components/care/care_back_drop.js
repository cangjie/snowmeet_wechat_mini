const util = require("../../utils/util")

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
    allWellFormed: false
  },
  lifetimes:{
    ready(){
      var that = this
      that.setData({order: that.properties.order})
      that.renderData()
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
        if (care.need_vax == 1){
          services += (services==''?'':',') + '打蜡' 
        }
        if (care.need_unvax == 1){
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
    }
  }
})
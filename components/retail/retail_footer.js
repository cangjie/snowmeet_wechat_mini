// components/retail/retail_footer.js
const app = getApp()
const data = require('../../utils/data.js')
const util = require('../../utils/util.js')
Component({
  properties: {
    order: Object
  },
  data: {
    wellForm: false,
    ordering: false
  },
  lifetimes:{
    ready(){
      var that = this
      var order = that.properties.order
      that.setData({order})
      app.loginPromiseNew.then(function (resolve){
        if (order && order.retails && order.retails.length > 0 ){
          that.checkWellForm()
        }

      })
      
    }
  },
  /**
   * Component methods
   */
  methods: {
    checkMi7Code(code){
      var that = this
      data.getRetailOrderByMi7CodePromise(code, app.globalData.sessionKey).then(function(orders){
        if (orders && orders.length>0){
          that.setData({wellForm: false})
          wx.showToast({
            title: '七色米重复',
            icon: 'error'
          })
        }
      })
    },
    checkWellForm(){
      var that = this
      var order = that.data.order
      var retail = order.retails[0]
      if (!retail){
        that.setData({wellForm: false})
        return
      }
      var wellForm = true
      if (isNaN(retail.deal_price)){
        wellForm = false
      }
      else if (retail.urgent == 0){
        var code = retail.mi7_code
        if (!code){
          that.setData({wellForm: false})
          return
        }
        if (code.length == 15 && code.indexOf('XSD20') == 0 && (code[14] == 'I' || code[14] == 'A')){
          that.checkMi7Code(code)
        }
        else{
          wellForm = false
        }
      }
      else{
        wellForm = true
      }
      that.setData({wellForm})
    },
    placeOrder(){
      var that = this
      var order = that.data.order
      var totalAmout = 0
      for(var i = 0; order && order.retails && i < order.retails.length; i++){
        var retail = order.retails[i]
        if (retail.urgent == 1){
          retail.mi7_code = null
        }
        if (retail.entertain == 1)
        {

        }
        else{
          totalAmout += retail.deal_price
        }
      }
      order.total_amount = totalAmout
      that.setData({ordering: true})
      var postUrl = app.globalData.requestPrefix + 'Order/PlaceOrder?sessionKey=' + app.globalData.sessionKey
      util.performWebRequest(postUrl, order).then(function (order){
        console.log('place order', order)
        that.setData({ordering: false, order})
        that.triggerEvent('PlaceOrderFinish', order )
      }).catch(function(exp){
        that.setData({ordering: false})
      })
    },
    showOrder(){
      var that = this
      var order = that.data.order
      that.triggerEvent('PlaceOrderFinish', order)
    }
  }
})
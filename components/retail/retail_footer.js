// components/retail/retail_footer.js
const app = getApp()
const data = require('../../utils/data.js')
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

  },
  lifetimes:{
    ready(){
      var that = this
      var order = that.properties.order
      that.setData({order})
      if (order && order.retail && order.retail.mi7_code){
        var code = order.retail.mi7_code.toUpperCase();
        if (code.length == 15 && code.indexOf('XSD20') == 0 && (code[14] == 'I' || code[14] == 'A')){
          that.checkMi7Code(code)
        }
        else{
          that.setData({wellForm: false})
        }
      }
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
    }
  }
})
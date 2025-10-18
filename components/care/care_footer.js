const util = require("../../utils/util")

// components/care/care_footer.js
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
      if (!order ){
        order = {}
      }
      if (!order.cares){
        order.cares = []
      }
      var total = 0
      for(var i = 0; i < order.cares.length; i++){
        var care = order.cares[i]
        if (!isNaN(care.summary)){
          total += parseFloat(care.summary)
        }
      }
      that.setData({order, total, totalStr: util.showAmount(total)})
    }
  },

  /**
   * Component methods
   */
  methods: {
    onClickIcon(e){
      var that = this
      that.triggerEvent('ShowCareBackDrop', {order: that.data.order})
    }
  }
})
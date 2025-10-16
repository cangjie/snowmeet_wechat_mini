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
      that.setData({order})
    }
  },

  /**
   * Component methods
   */
  methods: {

  }
})
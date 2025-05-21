// components/rent/order_summary.js
Component({

  /**
   * Component properties
   */
  properties: {
    orderInfo:{
      type: Object,
      value:{}
    }
  },

  /**
   * Component initial data
   */
  data: {

  },
  lifetimes:{
    ready(){
      console.log('order info', this.properties.orderInfo)
    }
  },

  /**
   * Component methods
   */
  methods: {

  }
})
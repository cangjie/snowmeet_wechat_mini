// components/order_type/order_type.js
Component({

  /**
   * Component properties
   */
  properties: {
    default:{
      type: String,
      value:'普通'
    },
    disabled:{
      type: Boolean,
      value: false
    }
  },

  /**
   * Component initial data
   */
  data: {
    orderType:['普通', '招待', '挂账', '质保'],
    selectedIndex: 0,
    disabled: false
  },

  /**
   * Component methods
   */
  methods: {
    ready(){
      var that = this
      that.setData({disabled: that.properties.disabled})
      that.triggerEvent('OrderTypeSelected', {value:that.properties.default})
    },
    change(e){
      var that = this
      that.setData({selectedIndex: e.detail.value})
      that.triggerEvent('OrderTypeSelected', {value:that.data.orderType[that.data.selectedIndex]})
    }
  }
})
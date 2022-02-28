// components/pay_method_selector/pay_method_selector.js
Component({
  /**
   * Component properties
   */
  properties: {
    readOnly:{
      type: Boolean,
      value: false
    },
    payMethod:{
      type: String,
      value: "微信"
    },
    payMethodList:{
      type: String,
      value: "微信,现金,支付宝,招待"
    }
  },

  /**
   * Component initial data
   */
  data: {
    list:["微信","现金","支付宝","招待"],
    readOnly: false,
    payMethod: '微信',
    selectedIndex: 0
  },

  lifetimes:{
    attached: function(e){
      var that = this
      //var payMethodList = that.properties.payMethodList.split(',')
      //that.setData({readOnly: that.properties.readOnly, payMethod: that.properties.payMethod})
    }
  },

  /**
   * Component methods
   */
  methods: {
    changePayMethod: function(e){
      var that = this
      that.setData({selectedIndex: e.detail.value})
      that.triggerEvent('PayMethodChanged', {payMethod: that.data.list[e.detail.value]})
    }
  }
})

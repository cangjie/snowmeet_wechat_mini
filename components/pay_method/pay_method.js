// components/pay_method/pay_method.js
Component({
  /**
   * Component properties
   */
  properties: {
    payMethod:{
      type: String,
      value: '微信支付'
    }
  },

  /**
   * Component initial data
   */
  data: {
    payMethodList:['微信支付', '支付宝转账', '微信转账','京东收银', 'POS刷卡', '现金'],
    payMethodSelectedIndex: 0
  },
  lifetimes:{
    ready: function(){
      var that = this
      this.triggerEvent('PayMethodSelected', {payMethod: that.properties.payMethod})
    }
  },
  /**
   * Component methods
   */
  methods: {
    
    selectChanged: function(e){
      var that = this
      that.setData({payMethodSelectedIndex: e.detail.value})
      that.triggerEvent('PayMethodSelected', {payMethod: that.data.payMethodList[e.detail.value]})
    }
    
  }
  
})

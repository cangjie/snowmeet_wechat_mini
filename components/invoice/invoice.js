// components/invoice/invoice.js
const app = getApp()
Component({
  /**
   * Component properties
   */
  properties: {
    item:{
      type: String,
      value:''
    },
    itemId: {
      type: String,
      value: '0'
    }
  },

  /**
   * Component initial data
   */
  data: {
    item: '',
    id: 0,
    role:'',
    amount:0,
    orderPrice: 0,
    orderRealPayPrice: 0,
    dataset:{}
  },

  lifetimes:{
    attached: function(){
      var that = this
      app.loginPromiseNew.then(function(resolve){
        var id = parseInt(that.properties.itemId)
        that.setData({role: app.globalData.role, id: id, item: that.properties.item})
        switch(that.data.item){
          case "summermaintain":
            that.getSummerMaintain()
            break
          default:
            break
        }
      })
    }
  },

  

  /**
   * Component methods
   */
  methods: {
    getSummerMaintain: function(){
      var that = this
      var getUrl = 'https://' + app.globalData.domainName + '/core/SummerMaintain/GetSummerMaintain/' + that.data.id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getUrl,
        method: 'GET',
        success:(res)=>{
          that.setData({dataset: res.data})
          var getProductUrl = 'https://' + app.globalData.domainName + '/core/Product/Get/144'
          wx.request({
            url: getProductUrl,
            method: 'GET',
            success:(res)=>{
              var price = res.data.sale_price
              that.setData({orderPrice: price, orderRealPayPrice: price})
              that.triggerEvent('invoice', {productArr:[{productId: 144, salePrice: price, count:1}], orderPrice: price, orderRealPayPrice: price})
            }
          })
          
        }
      })
    },
  }
})

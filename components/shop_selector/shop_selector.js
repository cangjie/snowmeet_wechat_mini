// components/shop_selector/shop_selector.js
const app = getApp()
const util = require('../../utils/util.js')
Component({
  /**
   * Component properties
   */
  properties: {
    defaultShop: {
      type: String,
      value: ''
    }
  },

  /**
   * Component initial data
   */
  data: {
    currentSelectedIndex: 0
  },
  lifetimes:{
    ready: function(){
      var that = this
      app.loginPromiseNew.then(function(resolve){
        var url = app.globalData.requestPrefix + 'Order/GetShops'
        util.performWebRequest(url, undefined).then(function(resovleData){
          console.log('get shop list:', resovleData)
          var name_list = ['全部店铺']
          for(var i = 0; i < resovleData.length; i++){
            name_list.push(resovleData[i].name)
          }
          that.setData({shop_list: resovleData, name_list: name_list})
          that.triggerEvent('ShopSelected', {shop: that.properties.defaultShop})

          if (that.properties.defaultShop == undefined || that.properties.defaultShop == null || that.properties.defaultShop == ''){
            wx.getFuzzyLocation({
              type: 'wgs84',
              success:(res)=>{
                var lat = parseFloat(res.latitude)
                var lon = parseFloat(res.longitude)
                var shopList = that.data.shop_list
                for(var i = 0; i < shopList.length; i++){
                  var currentShop = shopList[i]
                  if (parseFloat(currentShop.lat_from) < lat && parseFloat(currentShop.lat_to) > lat
                    && parseFloat(currentShop.long_from) < lon && parseFloat(currentShop.long_to) > lon){
                      that.setData({currentSelectedIndex: i + 1})
                      that.triggerEvent('ShopSelected', {shop: currentShop.name})
                      break
                    }
                }
              }
            })
          }
          else{
            for(var i = 0; i < name_list.length; i++){
              if (name_list[i]==that.properties.defaultShop){
                that.setData({currentSelectedIndex: i})
              }
            }
          }
        })
        
      })
    }
  },
  /**
   * Component methods
   */
  methods: {
    
    selectChanged:function(e){
      console.log('shop select changed:', e)
      var that = this
      that.setData({currentSelectedIndex: e.detail.value})
      if (e.detail.value == 0){
        that.triggerEvent('ShopSelected', {shop: ''})
      }
      else{
        that.triggerEvent('ShopSelected', {shop: that.data.name_list[e.detail.value]})
      }
      
    }
  }
})

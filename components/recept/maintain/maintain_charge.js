// components/recept/maintain/maintain_charge.js
const app = getApp()
const util = require('../../../utils/util.js')
Component({
  /**
   * Component properties
   */
  properties: {
    receptId: Number
  },



  /**
   * Component initial data
   */
  data: {

  },

  lifetimes:{
    
    ready(){
      var that = this
      app.loginPromiseNew.then(function(resolve){
        that.getData()
      })
    }

  },

  /**
   * Component methods
   */
  methods: {
    setDiscount(e){
      var that = this
      var value = isNaN(e.detail.value)? 0 : parseFloat(e.detail.value)
      var recept = that.data.recept
      switch(e.currentTarget.id){
        case 'discount':
          recept.maintainOrder.discount = value
          break
        case 'ticket_discount':
          recept.maintainOrder.ticketDiscount = value
          break
        default:
          break
      }
      that.computeCharge()
    },
    getProductList(){
      var that = this
      var recept = that.data.recept
      var shop = recept.shop
      var getProductUrl = 'https://' + app.globalData.domainName + '/core/Product/GetMaintainProduct?shop=' + encodeURIComponent(shop)
      wx.request({
        url: getProductUrl,
        method:'GET',
        success:(res)=>{
          console.log('maintian products', res)
          that.setData({productList: res.data})
          that.fixItems()
        }
      })
    },
    getData(){
      var that = this
      var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + that.data.receptId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getUrl,
        method: 'GET',
        success:(res)=>{
          
          if (res.statusCode != 200){
            return
          }
          var recept = res.data
          that.setData({recept: recept})
          that.getProductList()
        }
      })
    },
    getProductList(){
      var that = this
      var recept = that.data.recept
      var shop = recept.shop
      var getProductUrl = 'https://' + app.globalData.domainName + '/core/Product/GetMaintainProduct?shop=' + encodeURIComponent(shop)
      wx.request({
        url: getProductUrl,
        method:'GET',
        success:(res)=>{
          console.log('maintian products', res)
          that.setData({productList: res.data})
          that.computeCharge()
          //that.fixItems()
        }
      })
    },

    computeCharge(){
      var that = this
      var recept = that.data.recept
      var maintainOrder = recept.maintainOrder
      var items = maintainOrder.items
      var totalCharge = 0
      for(var i = 0; i < items.length; i++){
        items[i].standardCharge = that.computeStandardCharge(items[i])
        totalCharge += items[i].standardCharge
        if (!isNaN(items[i].confirmed_additional_fee)){
          totalCharge += parseFloat(items[i].confirmed_additional_fee)
        }
      }
      if (isNaN(maintainOrder.discount)){
        maintainOrder.discount = 0
      }
      if (isNaN(maintainOrder.ticketDiscount)){
        maintainOrder.ticketDiscount = 0
      }
      var totalChargeReal = totalCharge - maintainOrder.discount - maintainOrder.ticketDiscount
      that.setData({totalCharge: totalCharge, totalChargeStr: util.showAmount(totalCharge), 
        totalChargeReal: totalChargeReal, totalChargeRealStr: util.showAmount(totalChargeReal)})
      that.triggerEvent('CheckValid', {Goon: true, recept: that.data.recept})
    },

    computeStandardCharge(item){
      var that = this
      var productList = that.data.productList
      var pid = 0
      var charge = 0
      if (item.confirmed_urgent == 0){
        if (item.confirmed_edge == 1 && item.confirmed_candle == 1){
          pid = 139
        }
        else if (item.confirmed_edge == 1){
          pid = 140
        }
        else if (item.confirmed_candle == 1){
          pid = 143
        }
      }
      else{
        if (item.confirmed_edge == 1 && item.confirmed_candle == 1){
          pid = 137
        }
        else if (item.confirmed_edge == 1){
          pid = 138
        }
        else if (item.confirmed_candle == 1){
          pid = 142
        }
      }

      if (pid > 0){
        var productList = that.data.productList
        for(var i = 0; i < productList.length; i++){
          if (pid == productList[i].id){
            charge = productList[i].sale_price
            break
          }
        }
      }

      return charge

    }




  }
})

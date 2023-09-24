// components/recept/maintain/maintain_foot_summary.js
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
      app.loginPromiseNew.then(function (resolve){
        that.getData()
      })
    }
  },

  /**
   * Component methods
   */
  methods: {
    getCharge(item){
      var that = this
      var additionalCharge = 0
      if (item.confirmed_additional_fee != undefined && !isNaN(item.confirmed_additional_fee))
        additionalCharge = parseFloat(item.confirmed_additional_fee)
      var charge = 0
      var pid = 0
      if (item.confirmed_urgent == 1){
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
      else{
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
      if (pid > 0 && that.data.productList != undefined){
        var prodList = that.data.productList
        for(var i = 0; i < prodList.length; i++){
          if (pid == prodList[i].id){
            charge = prodList[i].sale_price
            break
          }
        }
      }
      item.confirmed_product_id = pid
      item.charge = additionalCharge + charge
      item.chargeStr = util.showAmount(item.charge)
      return item
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
          var recept = that.data.recept
          var total = 0
          var discount = 0
          var ticketDiscount = 0
          if (recept.maintainOrder != undefined && recept.maintainOrder != null){
            for(var i = 0; i < recept.maintainOrder.items.length; i++){
              var item = recept.maintainOrder.items[i]
              item = that.getCharge(item)
              total += item.charge
            }
            discount = recept.maintainOrder.discount
            ticketDiscount = recept.maintainOrder.ticketDiscount
          }
          that.setData({recept: recept, total: total, totalStr: util.showAmount(total),
            othersDiscount: discount, othersDiscountStr: util.showAmount(discount),
            ticketDiscount: ticketDiscount, ticketDiscountStr: util.showAmount(ticketDiscount),
            realPay: total - discount - ticketDiscount, 
            realPayStr: util.showAmount(total - discount - ticketDiscount)})



        }
      })
    },
    getData(){
      var that = this
      var id = that.properties.receptId
      var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
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
/*

          var total = 0
          var discount = 0
          var ticketDiscount = 0
          if (recept.maintainOrder != undefined && recept.maintainOrder != null){
            total = recept.maintainOrder.summaryPrice
            discount = recept.maintainOrder.discount
            ticketDiscount = recept.maintainOrder.ticketDiscount
          }
          that.setData({recept: recept, total: total, totalStr: util.showAmount(total),
            othersDiscount: discount, othersDiscountStr: util.showAmount(discount),
            ticketDiscount: ticketDiscount, ticketDiscountStr: util.showAmount(ticketDiscount),
            realPay: total - discount - ticketDiscount, 
            realPayStr: util.showAmount(total - discount - ticketDiscount)})
            */
        }
      })
    }
  }
})

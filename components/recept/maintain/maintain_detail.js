// components/recept/maintain/maintain_detail.js
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
          if (recept.maintainOrder != undefined && recept.maintainOrder != null 
            && recept.maintainOrder.items != undefined && recept.maintainOrder.items != null){
              for(var i = 0; i < recept.maintainOrder.items.length; i++){
                var item = recept.maintainOrder.items[i]
                item = that.getCharge(item)
                var urgent = false
                if (item.confirmed_urgent == 1){
                  urgent = true
                }
                item.serviceDesc = (item.confirmed_edge == 1? '修刃':'') + ' ' + (item.confirmed_candle == 1? '打蜡':'' + ' ') + item.confirmed_more + (urgent? '（加急）':'')
                item.headImage = item.confirmed_images.split(',')[0]
                if (!isNaN(item.charge)){
                  item.chargeStr = util.showAmount(item.charge)
                }
              }
              recept.maintainOrder.summaryPriceStr = util.showAmount(recept.maintainOrder.summaryPrice)
              recept.maintainOrder.discountStr = util.showAmount(recept.maintainOrder.discount)
              recept.maintainOrder.ticketDiscountStr = util.showAmount(recept.maintainOrder.ticketDiscount)
              recept.maintainOrder.realPayAmount = recept.maintainOrder.summaryPrice 
                - recept.maintainOrder.discount - recept.maintainOrder.ticketDiscount
              recept.maintainOrder.realPayAmountStr = util.showAmount(recept.maintainOrder.realPayAmount)
            }
            var detailTitle = "总共数量：" + recept.maintainOrder.items.length
            that.setData({recept: recept, detailTitle: detailTitle})


        }
      })
    },
    getData(){
      var that = this
      var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + that.properties.receptId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          var recept = res.data
          console.log('maintain detail recept', recept)
          that.setData({recept: recept})
          that.getProductList()
          /*
          if (recept.maintainOrder != undefined && recept.maintainOrder != null 
          && recept.maintainOrder.items != undefined && recept.maintainOrder.items != null){
            for(var i = 0; i < recept.maintainOrder.items.length; i++){
              var item = recept.maintainOrder.items[i]
              var urgent = false
              if (item.confirmed_urgent == 1){
                urgent = true
              }
              item.serviceDesc = (item.confirmed_edge == 1? '修刃':'') + ' ' + (item.confirmed_candle == 1? '打蜡':'' + ' ') + item.confirmed_more + (urgent? '（加急）':'')
              item.headImage = item.confirmed_images.split(',')[0]
              if (!isNaN(item.charge)){
                item.chargeStr = util.showAmount(item.charge)
              }
            }
            recept.maintainOrder.summaryPriceStr = util.showAmount(recept.maintainOrder.summaryPrice)
            recept.maintainOrder.discountStr = util.showAmount(recept.maintainOrder.discount)
            recept.maintainOrder.ticketDiscountStr = util.showAmount(recept.maintainOrder.ticketDiscount)
            recept.maintainOrder.realPayAmount = recept.maintainOrder.summaryPrice 
              - recept.maintainOrder.discount - recept.maintainOrder.ticketDiscount
            recept.maintainOrder.realPayAmountStr = util.showAmount(recept.maintainOrder.realPayAmount)
          }
          var detailTitle = "总共数量：" + recept.maintainOrder.items.length
          that.setData({recept: recept, detailTitle: detailTitle})
          */
        }
      })
    }
  }
})

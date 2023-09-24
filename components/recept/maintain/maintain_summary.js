// components/recept/maintain/maintain_summary.js
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
    ticketDesc: '--'
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
    getTicket(code){
      var that = this
      var getTicketUrl = 'https://' + app.globalData.domainName + '/core/Ticket/GetTicket/' + code
      wx.request({
        url: getTicketUrl,
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          var ticketDesc = res.data.name + '(' + res.data.code + ')' + (res.data.used == 1 ? '已核销':'')
          that.setData({ticketDesc: ticketDesc})
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
          if (recept.maintainOrder != undefined && recept.maintainOrder != null 
            && recept.maintainOrder.items != undefined && recept.maintainOrder.items != null){
              for(var i = 0; i < recept.maintainOrder.items.length; i++){
                var item = recept.maintainOrder.items[i]
                var urgent = false
                if (item.confirmed_urgent == 1){
                  urgent = true
                }
                item.serviceDesc = item.confirmed_edge == 1? '修刃':'' + ' ' + item.confirmed_candle == 1? '打蜡':'' + ' ' + item.confirmed_more + urgent? '（加急）':''
                
              }
              recept.maintainOrder.summaryPriceStr = util.showAmount(recept.maintainOrder.summaryPrice)
              recept.maintainOrder.discountStr = util.showAmount(recept.maintainOrder.discount)
              recept.maintainOrder.ticketDiscountStr = util.showAmount(recept.maintainOrder.ticketDiscount)
              recept.maintainOrder.realPayAmount = recept.maintainOrder.summaryPrice 
                - recept.maintainOrder.discount - recept.maintainOrder.ticketDiscount
              recept.maintainOrder.realPayAmountStr = util.showAmount(recept.maintainOrder.realPayAmount)
            }
          
          that.setData({recept: recept})
          if (!util.isBlank(recept.code)){
            that.getTicket(recept.code)
          }
        }
      })
    }
  }
})

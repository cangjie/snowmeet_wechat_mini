// components/payment/balance.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
Component({

  /**
   * Component properties
   */
  properties: {
    orderId: Number
  },

  /**
   * Component initial data
   */
  data: {

  },
  lifetimes:{
    ready(){
      var that = this
      var orderId = that.properties.orderId
      if (!isNaN(orderId)){
        data.getOrderBalancePromise(orderId, app.globalData.sessionKey).then(function (balances){
          for(var i = 0; balances != null && i < balances.length; i++){
            var balance = balances[i]
            var transDate = new Date(balance.transDate)
            balance.transDateStr = util.formatDate(transDate)
            balance.transTimeStr = util.formatTimeStr(transDate)
            balance.amountStr = util.showAmount(balance.amount)
            switch (balance.transType){
              case '支付':
                balance.color = 'green'
                break
              case '退款' :
                balance.color = 'red'
                break
              default:
                break
            }
          }
          that.setData({balances})
        })
      }
      

      
    }
  },

  /**
   * Component methods
   */
  methods: {

  }
})
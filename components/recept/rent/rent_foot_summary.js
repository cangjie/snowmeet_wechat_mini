// components/recept/rent/rent_foot_summary.js
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
    totalDeposit: 0,
    totalDepositStr: '¥0.00',
    ticketDiscount: 0,
    ticketDiscountStr: '¥0.00',
    othersDiscount: 0,
    othersDiscountStr: '¥0.00',
    realPay: 0,
    realPayStr: '¥0.00'
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
          var deposit = 0
          var discount = 0
          var ticketDiscount = 0
          if (recept.rentOrder != undefined && recept.rentOrder != null){
            deposit = recept.rentOrder.deposit
            discount = recept.rentOrder.deposit_reduce
            ticketDiscount = recept.rentOrder.deposit_reduce_ticket
          }
          that.setData({recept: recept, totalDeposit: deposit, totalDepositStr: util.showAmount(deposit),
            othersDiscount: discount, othersDiscountStr: util.showAmount(discount),
            ticketDiscount: ticketDiscount, ticketDiscountStr: util.showAmount(ticketDiscount),
            realPay: deposit - discount - ticketDiscount, 
            realPayStr: util.showAmount(deposit - discount - ticketDiscount)})
        }
      })
    }

  }
})

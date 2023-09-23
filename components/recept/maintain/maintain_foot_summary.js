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
        }
      })
    }
  }
})

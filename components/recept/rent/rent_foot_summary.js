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
      app.loginPromiseNew.then(function (resolve){

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
      var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + id.toString() + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          var recept = res.data
          that.setData({recept: recept})
        }
      })
    }

  }
})

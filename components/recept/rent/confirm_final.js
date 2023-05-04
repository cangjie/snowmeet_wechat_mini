// components/recept/rent/confirm_final.js
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
        var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + that.properties.receptId + '?sessionKey=' + app.globalData.sessionKey
        wx.request({
          url: getUrl,
          success:(res)=>{
            if (res.statusCode != 200){
              return
            }
            var recept = res.data
            var rentOrder = recept.rentOrder
            var rentDays = 1
            if (rentOrder.rentDays != undefined && !isNaN(entOrder.rentDays)){
              rentDays = parseInt(rentOrder.rentDays)
            }
            //var payMethod = rentOrder.pay_method
            var payOption = rentOrder.pay_option
            var payMethod = rentOrder.payMethod
            that.setData({recept: recept, payOption: payOption, payMethod: payMethod, rentDays: rentDays})
          }
        })
      })
    }
  },

  /**
   * Component methods
   */
  methods: {
    setDueEndTime(e){
      var nowDate = new Date()
      var days = parseInt(e.detail.value)
      nowDate.setDate(nowDate.getDate() + days)
      var that = this
      that.setData({dueEndDate: nowDate, rentDays: days})
    },
    setPayOption(e){
      var that = this
      var v = e.detail.value
      that.setData({payOption: v})
    },
    setPayMethod(e){
      var that = this
      console.log('pay method changed', e)
      that.setData({payMethod: e.detail.payMethod})
    },
  }
})

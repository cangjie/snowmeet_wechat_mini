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
            var startDate = new Date(rentOrder.start_date)
            var endDate = new Date(rentOrder.due_end_date)
            var rentDays = endDate.getDate() - startDate.getDate()
            if (rentDays < 1){
              rentDays = 1
            }
            if (startDate.getFullYear()< 2000){
              startDate = new Date()
              endDate = new Date()
              endDate.setDate(startDate.getDate() + rentDays - 1)
            }
            rentOrder.start_date = util.formatDate(startDate)
            rentOrder.due_end_date = util.formatDate(endDate)
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
      
      var days = parseInt(e.detail.value)
      
      var that = this
      var recept = that.data.recept
      var rentOrder = recept.rentOrder
      var startDate = new Date(rentOrder.start_date)
      var endDate = new Date(rentOrder.due_end_date)
      if (startDate.getFullYear() < 2000){
        startDate = new Date()
        endDate = new Date()
       
      }
      else{
        startDate = new Date(rentOrder.start_date)
        endDate = new Date(rentOrder.due_end_date)

      }
      endDate.setDate(endDate.getDate() + days - 1)
      rentOrder.start_date = util.formatDate(startDate)
      rentOrder.due_end_date = util.formatDate(endDate)
      that.setData({rentDays: days, recept: recept})
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

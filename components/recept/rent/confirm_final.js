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
            var dateDiff = endDate - startDate
            var rentDays = dateDiff / 86400000 + 1
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
            var payAmount = util.showAmount(parseFloat(rentOrder.deposit_final))
            var memo = (rentOrder.memo == undefined || rentOrder.memo == null)? '' : rentOrder.memo
            that.setData({recept: recept, payOption: payOption, payMethod: payMethod, rentDays: rentDays, payAmount: payAmount, memo: memo})
            that.checkValid()
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
      that.checkValid()
    },
    setPayOption(e){
      var that = this
      
      that.setData({payOption: e.detail.value})
      if (that.data.recept != undefined && that.data.recept != null
        && that.data.recept.rentOrder != undefined && that.data.recept.rentOrder != null){
          that.checkValid()
      }
    },
    setPayMethod(e){
      var that = this
      console.log('pay method changed', e)
     
      that.setData({payMethod: e.detail.value})
      if (that.data.recept != undefined && that.data.recept != null
        && that.data.recept.rentOrder != undefined && that.data.recept.rentOrder != null){
          that.checkValid()
      }
      
    },
    checkValid(){
      var valid = true
      var that = this
      var recept = that.data.recept
      var rentOrder = that.data.recept.rentOrder

      var start = new Date(rentOrder.start_date)
      var end = new Date(rentOrder.due_end_date)
      var dateDiff = end - start
      var rentDays = dateDiff / 86400000 + 1
      if (rentDays < 1 || end < start || end.getFullYear() < 2000 )
      {
        valid = false
        return
      }
      if (that.data.payOption == undefined || that.data.payOption == null ||that.data.payOption == ''){
        valid = false
        return
      }
      if (that.data.payMethod == undefined || that.data.payMethod == null || that.data.payMethod == ''){
        valid = false
        return
      }
      if (valid){
        rentOrder.pay_option = that.data.payOption
        rentOrder.payMethod = that.data.payMethod
        that.triggerEvent('CheckValid', {Goon: valid, recept: recept})
      }
    }
  }
})

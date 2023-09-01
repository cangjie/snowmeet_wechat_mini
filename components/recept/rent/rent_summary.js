// components/recept/rent/rent_summary.js
const app = getApp()
const util = require('../../../utils/util.js')
Component({
  /**
   * Component properties
   */
  properties: {
    rentId: Number
  },

  /**
   * Component initial data
   */
  data: {

  },

  pageLifetimes:{
    show(){
      var that = this
      app.loginPromiseNew.then(function(resolve){
        var rentId = that.properties.rentId
        that.setData({rentId: rentId})
        that.getData()
      })
    },
    
  },

  lifetimes:{
    ready(){
      var that = this
      app.loginPromiseNew.then(function(resolve){
        var rentId = that.properties.rentId
        that.setData({rendId: rentId})
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
      var rentId = that.data.rentId
      var getUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentOrder/' + rentId.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getUrl,
        method: 'GET',
        success:(res)=>{
          console.log('get rent order', res)
          if (res.statusCode != 200){
            return
          }
          var rentOrder = res.data
          for(var i = 0; i < rentOrder.details.length; i++){
            rentOrder.details[i].unit_rental_str = util.showAmount(rentOrder.details[i].unit_rental)
            rentOrder.details[i].deposit_str = util.showAmount(rentOrder.details[i].deposit) 
            rentOrder.details[i].start_date_str = util.formatDate(new Date(rentOrder.details[i].start_date))
          }
          rentOrder.deposit_str = util.showAmount(rentOrder.deposit)
          rentOrder.deposit_reduce_str = util.showAmount(rentOrder.deposit_reduce)
          rentOrder.deposit_reduce_ticket_str = util.showAmount(rentOrder.deposit_reduce_ticket)
          rentOrder.deposit_final_str = util.showAmount(rentOrder.deposit_final)
          
          that.setData({rentOrder: rentOrder})
        }
      })
    }
  }
})

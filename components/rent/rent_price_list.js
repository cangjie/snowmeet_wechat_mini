// components/rent/rent_price_list.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
Component({

  /**
   * Component properties
   */
  properties: {
    shopName: String,
    type: String,
    dayType: String,
    targetId: Number
  },
  data: {

  },
  lifetimes:{
    ready(){
      var that = this
      app.loginPromiseNew.then(function (resolve){
        data.getShopByNamePromise(that.properties.shopName).then(function (shop){
          that.setData({shop})
        })
      })
    }
  },
  methods: {

  }
})
// components/rent/price_matrix.js
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
const app = getApp()
Component({

  /**
   * Component properties
   */
  properties: {
    shopId: Number,
    priceType: String,
    id: Number
  },

  /**
   * Component initial data
   */
  data: {

  },
  lifetimes:{
    ready(){
      var that = this
      that.setData({shopId: that.properties.shopId, 
        priceType: that.properties.priceType, 
        id: that.properties.id})
      console.log('shop id', that.properties.shopId)
      app.loginPromiseNew.then(function (resolve){
        data.getEnumListPromise('RentType').then(function (rentTypeList){
          that.setData({rentTypeList})
        }).catch(function (reject){

        })
        data.getEnumListPromise('GetDayType').then(function (dayTypeList){
          that.setData({dayTypeList, colSpan: parseInt(24/(dayTypeList.length + 1))})
        }).catch(function (reject){

        })
        
      })
    }
  },
  /**
   * Component methods
   */
  methods: {

  }
})
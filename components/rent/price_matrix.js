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
    id: Number,
    scene: String
  },

  /**
   * Component initial data
   */
  data: {

  },
  lifetimes: {
    ready() {
      var that = this
      that.setData({
        shopId: that.properties.shopId,
        priceType: that.properties.priceType,
        id: that.properties.id,
        scene: that.properties.scene
      })
      console.log('shop id', that.properties.shopId)
      app.loginPromiseNew.then(function (resolve) {
        data.getEnumListPromise('RentType').then(function (rentTypeList) {
          that.setData({ rentTypeList })
          data.getEnumListPromise('GetDayType').then(function (dayTypeList) {
            that.setData({ dayTypeList, colSpan: parseInt(24 / (dayTypeList.length + 1)) })
            that.getData()
          }).catch(function (reject) {

          })
        }).catch(function (reject) {

        })


      })
    }
  },
  /**
   * Component methods
   */
  methods: {
    getData() {
      var that = this
      data.getRentPriceListPromise(that.data.shopId, that.data.priceType, that.data.id, that.data.scene)
      .then(function (list) {
        var rentTypeList = that.data.rentTypeList
        var dayTypeList = that.data.dayTypeList
        var matrix = []
        for(var i = 0; i < rentTypeList.length; i++){
          var line = []
          for(var j = 0; j < dayTypeList.length; j++){
            var value = null
            var priceId = 0
            var find = false
            var rentType = rentTypeList[i]
            var dayType = dayTypeList[j]
            for(var k = 0; i < list.length; k++){
              if (list.day_type == dayType && list.rent_type == rentType){
                find = true
                value = list[k].price == null ? '-':list[k].price
                priceId = list[k].id
                break
              }
            }
            if (!find){
              value = ''
            }
            var priceObj = {id: priceId, price: value, type: that.data.priceType, 
              scene: that.data.scene, day_type: dayType, rent_type: rentType}
            if (that.data.priceType == '分类'){
              priceObj.category_id = that.data.id
            }
            else if (that.data.priceType == '套餐'){
              priceObj.package_id = that.data.id
            }
            line.push(priceObj)
          }
          matrix.push(line)
        }
        that.setData({matrix})
      })
    }
  }
})
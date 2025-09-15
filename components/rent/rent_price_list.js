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
    targetId: Number,
    memberId: Number
  },
  data: {

  },
  lifetimes:{
    ready(){
      var that = this
      app.loginPromiseNew.then(function (resolve){
        data.getShopByNamePromise(that.properties.shopName).then(function (shop){
          that.setData({shop})
          that.getProductName()
          data.getEnumListPromise('RentType').then(function(rentType){
            that.setData({rentType})
            data.getEnumListPromise('GetDayType').then(function (dayType){
              that.setData({dayType})
              data.getEnumListPromise('RentSceneType').then(function(RentSceneType){
                that.setData({RentSceneType})
                if (that.properties.memberId){
                  that.setData({currentTag: 2})
                }
                else{
                  that.setData({currentTag: 0})
                }
                var scene = that.data.RentSceneType[that.data.currentTag]
                data.getRentPriceListPromise(that.data.shop.id, that.properties.type, that.properties.targetId, scene).then(function (matrix){
                  that.setData({matrix})
                })
              })
            })
          })
        })
      })
    }
  },
  methods: {
    getProductName(){
      var that = this
      var id = parseInt(that.properties.targetId)
      switch(that.properties.type){
        case '套餐':
          data.getPackagePromise(id).then(function (resolve){
            that.setData({productName: '【套餐】' + resolve.name, package: resolve})
          })
          break
        case '分类':
          data.getRentCategoryPromise(id).then(function (category){
            that.setData({productName: '【分类】' + category.name})
          })
          break
        default:
          break
      }
    },
    onTabChange(e){
      var that = this
      console.log('current tab', e)
      var scene = e.detail.title
      data.getRentPriceListPromise(that.data.shop.id, that.properties.type, that.properties.targetId, scene).then(function (matrix){
        that.setData({matrix})
      })
    }
    
  }
})
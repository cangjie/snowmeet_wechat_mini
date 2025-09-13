// components/rent/shop_price_matrix.js
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
const app = getApp()
Component({

  /**
   * Component properties
   */
  properties: {
    priceType: String,
    targetId: Number
  },

  /**
   * Component initial data
   */
  data: {
    shops:[
      {id: 10, name: '万龙体验中心', scene: '门市' },
      {id: 9,  name: '崇礼旗舰店', scene: '门市' },
      {id: 4,  name: '南山', scene: '门市' }
    ],
    active: 0,
    scene: '门市',
    showMatrix: true
  },
  lifetimes: {
    ready(){
      var that = this
      app.loginPromiseNew.then(function (resovle){
        that.setData({currentShop: that.data.shops[0]})
        data.getEnumListPromise('RentSceneType').then(function (rentSceneTypeList){
          that.setData({rentSceneTypeList})
        }).catch(function (reject){

        })
        that.setData({priceType: that.properties.priceType, targetId: that.properties.targetId})
      })
      
    }
  },
  /**
   * Component methods
   */
  methods: {
    onChange(e){
      var that = this
      that.setData({currentShop: that.data.shops[e.detail.index]})
      console.log('change tab', e)
    },
    changeScene(e){
      var that = this
      var currentShop = that.data.currentShop
      currentShop.scene = e.detail.value
      that.setData({currentShop})
    }
  }
})
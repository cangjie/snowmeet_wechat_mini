// components/rent/search_product_fuzzy.js
const util = require('../../utils/util')
const coreData = require('../../utils/data.js')
Component({

  /**
   * Component properties
   */
  properties: {
    barCode: String,
    categoryId: Number
  },

  /**
   * Component initial data
   */
  data: {

  },
  lifetimes:{
    ready(){
      var that = this
      coreData.searchBarCodeFuzzyPromise(that.properties.barCode, 
        that.properties.categoryId==0?null:that.properties.categoryId)
        .then(function(resolve){
          console.log('get products', resolve)
          that.setData({products: resolve})
        })
        .catch(function (reject){

        })
    }
  },
  /**
   * Component methods
   */
  methods: {
    close(){
      var that = this
      that.triggerEvent('Cancel', {})
    },
  }
})
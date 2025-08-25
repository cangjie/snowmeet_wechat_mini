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
          var products = resolve
          that.setData({products})
          if (products.length == 1){
            that.data.selectedItem = products[0]
          }
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
    selectItem(e){
      var that = this
      var value = parseInt(e.detail.value)
      that.data.selectedItem = that.data.products[value]
    },
    confirm(){
      var that = this
      if (!that.data.selectedItem){
        wx.showToast({
          title: '未选择商品',
          icon: 'error'
        })
        return
      }
      that.triggerEvent('Confirm', that.data.selectedItem)
    }
  }
})
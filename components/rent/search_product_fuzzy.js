// components/rent/search_product_fuzzy.js
const util = require('../../utils/util')
const coreData = require('../../utils/data.js')
Component({

  /**
   * Component properties
   */
  properties: {
    categoryId: Number,
    barCode: String
  },

  /**
   * Component initial data
   */
  data: {

  },
  lifetimes:{
    ready(){
      var that = this
      if (that.properties.barCode){
        that.setData({barCode: that.properties.barCode})
        that.query()
      }
      if (that.properties.categoryId){
        coreData.getRentCategoryPromise(that.properties.categoryId)
          .then(function (category){
            that.setData({category})
          }).catch(function (resolve){

          })
      }
    }
  },
  /**
   * Component methods
   */
  methods: {
    close(){
      var that = this
      that.setData({barCode: null})
      that.properties.barCode = null
      that.triggerEvent('Cancel', {})
    },
    selectItem(e){
      var that = this
      var value = parseInt(e.detail.value)
      that.data.selectedItem = that.data.products[value]
    },
    confirm(){
      var that = this
      that.setData({barCode: null})
      that.properties.barCode = null
      if (!that.data.selectedItem){
        wx.showToast({
          title: '未选择商品',
          icon: 'error'
        })
        return
      }
      that.triggerEvent('Confirm', that.data.selectedItem)
    },
    query(){
      var that = this
      coreData.searchBarCodeFuzzyPromise(that.data.barCode, 
        that.data.category? that.data.category.id : null)
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
    },
    inputBarcode(e){
      var that = this
      that.data.barCode = e.detail.value
    }
  }
})
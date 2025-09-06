// components/rent/rent_item_list.js
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
const app = getApp()
Component({

  /**
   * Component properties
   */
  properties: {
    rentals: Object
  },

  /**
   * Component initial data
   */
  data: {
    categories:[]
  },
  
  pageLifetimes:{
    show(){
      console.log('rent_item_list show')
      var that = this
      app.loginPromiseNew.then(function (resovle){
        that.init()
      })
    }
  },

  /**
   * Component methods
   */
  methods: {
    init(){
      var that = this
      var rentals = that.properties.rentals
      for(var i = 0; i < rentals.length; i++){
        for(var j = 0; j < rentals[i].rentItems.length; j++){
          var rentItem = rentals[i].rentItems[j]
          data.getRentCategoryPromise(rentItem.category_id).then(function (resolve){
            var categories = that.data.categories
            var exists = false
            for(var k = 0; k < categories.length; k++){
              var category = categories[k]
              if (category.id == resolve.father.id){
                exists = true
                if (category.rentItems){
                  category.rentItems.push(rentItem)
                }
                else{
                  category.rentItems = [rentItem]
                }
              }
            }
            if (!exists){
              resolve.father.rentItems = [rentItem]
              categories.push(resolve.father)
            }
            that.setData({categories})
          }).catch(function (reject){})
        }
      }
    }
  }
})
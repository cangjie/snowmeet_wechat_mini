// components/rent/top_category_selector.js
const app = getApp()
const data = require('../../utils/data.js')
Component({

  /**
   * Component properties
   */
  properties: {

  },

  /**
   * Component initial data
   */
  data: {

  },
  lifetimes:{
    ready(){
      var that = this
      app.loginPromiseNew.then(()=>{
        data.getTopCategoriesPromise().then((categories)=>{
          that.setData({categories})
        })

      })
    }
  },

  /**
   * Component methods
   */
  methods: {
    selectCategory(e){
      var that = this
      var value = parseInt(e.detail.value)
      var categories = that.data.categories
      that.data.category = categories[value]
    },
    cancel(){
      var that = this
      that.triggerEvent('ModalClick', {action: 'cancel'})
    },
    confirm(){
      var that = this
      that.triggerEvent('ModalClick', {action: 'confirm', category: that.data.category})
    }
  }
})
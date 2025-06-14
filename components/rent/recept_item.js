// components/rent/recept_item.js
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

  /**
   * Component methods
   */
  methods: {
    save(){
      var that = this
      that.triggerEvent('Keep',{})
    }
  }
})
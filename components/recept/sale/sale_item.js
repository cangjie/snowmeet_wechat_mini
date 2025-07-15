// components/recept/sale/sale_item.js
Component({

  /**
   * Component properties
   */
  properties: {
    member: Object
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
    
  },
  pageLifetimes:{
    show(){
      var that = this
      if (that.properties.member){
        that.setData({member: that.properties.member})
      }
    }
  }
})
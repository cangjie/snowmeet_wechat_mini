// components/rent/recept_package.js
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
    packageList:['套餐一','套餐二'],
    categories: ['FIS双板', '高硬度雪鞋', '碳纤维雪杖','头盔','Nandn雪镜']
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
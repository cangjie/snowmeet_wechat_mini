// components/care/care_recept.js
const app = getApp()
const data = require('../../utils/data.js')
Component({

  /**
   * Component properties
   */
  properties: {
    care: Object
  },

  /**
   * Component initial data
   */
  data: {
    care:{}
  },
  lifetimes:{
    ready(){
      var that = this
      data.getEquipBrandsPromise('单板').then(function (list){
        that.setData({skiBrandList: list})
      })
      data.getEquipBrandsPromise('双板').then(function (list){
        that.setData({boardBrandList: list})
      })
      if (that.properties.care){
        that.setData({care: that.properties.care})
      }
    }
  },

  /**
   * Component methods
   */
  methods: {
    setValue(e){
      var that = this
      var id = e.currentTarget.id
      var value = e.detail.value
      var care = that.data.care
      if (!care){
        care = {}
      }
      switch(id){
        case 'equipment':
          care.equipment = value
          break
      }
    }

  }
})
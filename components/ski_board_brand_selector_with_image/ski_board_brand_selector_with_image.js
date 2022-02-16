// components/ski_board_brand_selector_with_image/ski_board_brand_selector_with_image.js
Component({
  /**
   * Component properties
   */
  properties: {
    equipType:{
      type: String,
      value: '双板'
    },
    brand:{
      type: String,
      value: ''
    },
    readOnly:{
      type: Boolean,
      value: false
    },
    images:{
      type: String,
      value:''
    }
  },

  /**
   * Component initial data
   */
  data: {
    brand: '',
    equipType:'双板',
    images:'',
    readOnly: false
  },
  lifetimes:{
    attached: function(e){
      var that = this
      var brand = that.properties.brand==undefined?'':that.properties.brand.trim()
      var equipType = that.properties.equipType==undefined?'双板':that.properties.equipType.trim()
      var images = that.properties.images==undefined?'':that.properties.images.trim()
      var readOnly = that.properties.readOnly==undefined?false:that.properties.readOnly
      that.setData({equipType: equipType, brand: brand, images: images, readOnly: readOnly})
    },
    
  },
  /**
   * Component methods
   */
  methods: {
    brandChanged: function(e){
      console.log(e)
      var that = this
      var brand = e.detail.brand
      var equipType = e.detail.equipType
      var images = that.data.images
      that.setData({equipType: equipType, brand: brand})
      that.triggerEvent('EquipInfoChanged', {equipType: equipType, brand: brand, images: images})
    },
    uploaded: function(e){
      var that = this
      var files = e.detail.files
      var photoFiles = ''
      for(var i in files) {
        if (files[i].url != '') {
          photoFiles = photoFiles + ((photoFiles.trim() != '')? ',' : '') + files[i].url
        }
      }
      that.setData({images: photoFiles})
      that.triggerEvent('EquipInfoChanged', {equipType: that.data.equipType, brand: that.data.brand, images: that.data.images})
    }
  }
})

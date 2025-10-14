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
    care:{},
    brandSelectIndex: null,
    brandList: []
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
      else {
        that.setData({care: {}})
        that.buildImages()
      }
      app.loginPromiseNew.then(function (resolve){
        
      })
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
          var brandList = []
          switch(value){
            case '单板':
              brandList = that.data.boardBrandList
              break
            case '双板':
              brandList = that.data.skiBrandList
              break
            default:
              break
          }
          that.setData({brandSelectIndex: null, brandList})
          break
      }
    },
    afterRead(e){
      console.log('photo uploaded', e)
      var that = this
      var care = that.data.care
      var uploadFile = e.detail.file
      var images = care.careImages
      var image = {
        care_id: care.id,
        image_id: 0,
        status: 'uploading',
        message: '上传中',
        image:{
          id: 0,
          file_path_name: uploadFile.tempFilePath,
          thumb: uploadFile.thumb,
          thumbUrl: uploadFile.thumb,
          file_type: uploadFile.type
        }
      }
      images.push(image)
      that.buildImages()
      data.uploadFilePromise(null, uploadFile.tempFilePath, '养护开单', uploadFile.type, app.globalData.sessionKey )
        .then(function  (uploadedFile){
          console.log('file uploaded', uploadedFile)
          data.uploadFilePromise(uploadedFile.id, uploadFile.thumb, null, null, app.globalData.sessionKey)
            .then(function (uploadThumbFile){
              console.log('thumb uploaded', uploadThumbFile)
             image.url = uploadThumbFile.thumbUrl
             image.status = 'success'
             that.buildImages()
            }).catch(function (exp){

            })
        })
      //that.setData({fileList})
    },
    buildImages(){
      var that = this
      var care = that.data.care
      if (!care){
        care = {}
      }
      if (!care.careImages){
        care.careImages = []
      }
      for(var i = 0; i < care.careImages.length; i++){
        var image = care.careImages[i]
        if (image.image.thumbUrl.indexOf('http') == 0){
          image.url = image.image.thumbUrl
        }
        else{
          image.url = 'https://' + app.globalData.domainName + image.image.thumbUrl
        }
      }
      that.setData({care})
    }

  }
})
// components/care/care_recept.js
const app = getApp()
const data = require('../../utils/data.js')
const util = require('../../utils/util.js')
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
    brandList: [],
    addingNewBrand: false,
    filledBrandName: null,
    filledBrandChineseName: null
  },
  lifetimes:{
    ready(){
      var that = this
      data.getEquipBrandsPromise('双板').then(function (list){
        that.setData({skiBrandList: list})
      })
      data.getEquipBrandsPromise('单板').then(function (list){
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
          data.getCareOthersServicePromise(value).then(function (list){
            that.setData({othersService: list})
          })
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
          var unknownBrand = {
            brand_type: value,
            brand_name: 'Add New',
            chinese_name: '新增品牌',
            origin: '',
            displayedName: '新增品牌'
          }
          brandList.push(unknownBrand)
          that.setData({brandSelectIndex: null, brandList, addingNewBrand: false})
          break
        case 'brand':
          var brandSelectIndex = e.detail.value
          var selectedBrand = that.data.brandList[parseInt(brandSelectIndex)]
          care.brand = selectedBrand.displayedName
          var addingNewBrand = false
          if (brandSelectIndex == that.data.brandList.length - 1){
            addingNewBrand = true
          }
          that.setData({brandSelectIndex, addingNewBrand})
          break
        case 'brandName':
          that.data.filledBrandName = value
          break
        case 'brandChineseName':
          that.data.filledBrandChineseName = value
          break
        default:
          break
      }
      that.setData({care})
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
          image.url = uploadedFile.file_path_name
          image.thumb = uploadedFile.file_path_name
          image.type = uploadedFile.file_type
          data.uploadFilePromise(uploadedFile.id, uploadFile.thumb, null, null, app.globalData.sessionKey)
            .then(function (uploadThumbFile){
              console.log('thumb uploaded', uploadThumbFile)
             image.thumb = uploadThumbFile.thumbUrl
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
        if (image.image.thumb.indexOf('http') == 0){
          image.thumb = image.image.thumb
        }
        else{
          image.thumb = 'https://snowmeet.wanlonghuaxue.com' + image.thumb
        }
        if (image.image.file_path_name.indexOf('http') == 0){
          image.url = image.image.file_path_name
        }
        else{
          image.url = 'https://snowmeet.wanlonghuaxue.com' + image.file_path_name
        }
        /*
        if (image.image.thumbUrl.indexOf('http') == 0){
          image.url = image.image.thumbUrl
        }
        else{
          image.url = 'https://' + app.globalData.domainName + image.image.thumbUrl
        }
        */
      }
      
      that.setData({care})
    },
    delImage(e){
      console.log('del image', e)
      var that = this
      var index = e.detail.index
      var care = that.data.care
      var images = care.careImages
      var newImages = []
      for(var i = 0; i < images.length; i++){
        if (i != index){
          newImages.push(images[i])
        }
      }
      care.careImages = newImages
      that.setData({care})
    },
    cancelAddBrand(e){
      var that = this
      that.setData({addingNewBrand: false, brandSelectIndex: null})
    },
    confirmAddBrand(e){
      var that = this
      var brandName = that.data.filledBrandName
      var chineseName = that.data.filledBrandChineseName
      if (!brandName){
        wx.showToast({
          title: '必须填写英文名称',
          icon: 'error'
        })
        return
      }
      var updateUrl = app.globalData.requestPrefix + 'Care/UpdateBrandByStaff?type=' + encodeURIComponent(that.data.care.equipment) + '&brandName=' + encodeURIComponent(brandName) + '&chineseName=' + encodeURIComponent(chineseName) + '&sessionKey=' + app.globalData.sessionKey
      util.performWebRequest(updateUrl, null).then(function (brandList){
        switch(that.data.care.equipment){
          case '单板':
            var boardBrandList = brandList
            var brandList = boardBrandList
            that.setData({boardBrandList, brandList})
            break
          case '双板':
            var skiBrandList = brandList
            var brandList = brandList
            that.setData({skiBrandList, brandList})
            break
          default:
            break
        }
        var unknownBrand = {
          brand_type: that.data.care.equipment,
          brand_name: 'Add New',
          chinese_name: '新增品牌',
          origin: '',
          displayedName: '新增品牌'
        }
        brandList.push(unknownBrand)
        var index = null
        for(var i = 0; i < that.data.brandList.length; i++){
          var brand = that.data.brandList[i]
          if (brand.brand_name == that.data.filledBrandName){
            index = i
            break
          }
        }
        that.setData({brandSelectIndex: i, addingNewBrand: false, brandList})
      })
    }
  }
})
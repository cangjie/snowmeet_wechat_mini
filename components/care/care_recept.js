// components/care/care_recept.js
const app = getApp()
const data = require('../../utils/data.js')
const util = require('../../utils/util.js')
Component({

  /**
   * Component properties
   */
  properties: {
    order: Object

  },

  /**
   * Component initial data
   */
  data: {
    care:null,
    brandSelectIndex: null,
    brandList: [],
    addingNewBrand: false,
    filledBrandName: null,
    filledBrandChineseName: null
  },
  lifetimes:{
    ready(){
      var that = this
      
      
      if (that.properties.order){
        for(var i = 0; that.properties.order.cares && i < that.properties.order.cares.length; i++){
          if (that.properties.order.cares[i].current == 1){
            that.setData({care: that.properties.order.cares[i], currentCareIndex: i, 
              shop: that.properties.order.shop, order: that.properties.order})
            break
          }
        }
        if (!that.data.care && that.data.order && that.data.order.cares && that.data.order.cares.length > 0){
          that.setData({care: that.data.order.cares[0], currentCareIndex: 0,
            shop: that.properties.order.shop, order: that.properties.order})
        }
      }
      else {
        that.setData({care: {}, shop: '万龙服务中心'})
        that.buildImages()
      }
      app.loginPromiseNew.then(function (resolve){
        var order = that.data.order
        var currentCare = null
        for(var i = 0; order && order.cares && i < order.cares.length; i++){
          if (order.cares[i].current == 1){
            currentCare = order.cares[i]
          }
        }
        if (currentCare == null && order && order.cares && order.cares.length > 0){
          currentCare = order.cares[0]
        }
        else {
          if (currentCare == null){
          currentCare = {}
          }
        }
        //that.setData({care: currentCare})
        data.getEquipBrandsPromise('双板').then(function (list){
          that.setData({skiBrandList: list})
          data.getEquipBrandsPromise('单板').then(function (list){
            that.setData({boardBrandList: list})
            that.loadData(currentCare)
          })
        })
        
        
      })
    }
  },

  /**
   * Component methods
   */
  methods: {
    loadData(care){
      var that = this
      var brandList = null
      if (care.equipment == '单板'){
        brandList = that.data.boardBrandList
        //that.setData({brandList: boardBrandList})
      }
      else{
        brandList = that.data.skiBrandList
        //that.setData({brandList: skiBrandList})
      }
      var brandSelectIndex = null
      for(var i = 0; brandList && i < brandList.length; i++){
        if (brandList[i].displayedName == care.brand){
          brandSelectIndex = i
          break
        }
      }
      that.setData({brandList, brandSelectIndex, care})
    },
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
            that.setData({othersService: list.map((l) => {return {name: l, checked: false}})})
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
        case 'scale':
          care.scale = value
          break
        case 'need_edge':
          care.need_edge = value.length
          care.edge_degree = '89'
          that.getProduct(care)
          break
        case 'need_vax':
          care.need_vax = value.length
          care.need_unvax = care.need_vax
          that.getProduct(care)
          break
        case 'need_unvax':
          care.need_unvax = value.length
          break
        case 'urgent':
          care.urgent = value.length
          that.getProduct(care)
          break
        case 'othter_services':
          console.log('other services', value)
          care.otherServicesArray = value
          care.repair_memo = value.join(',')
          break
        case 'others_memo':
          if (care.repair_memo == ''){
            care.repair_memo = value
          }
          else{
            care.repair_memo += ',' + value
          }
          break
        case 'repair_charge':
          if (!isNaN(value)){
            care.repair_charge = parseFloat(value)
            that.computeCharge(care)
          }
          break
        case 'discount':
          if (!isNaN(value)){
            care.discount = parseFloat(value)
            that.computeCharge(care)
          }
          break
        case 'memo':
          care.memo = value
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
    },
    getProduct(care){
      var that = this
      that.setData({product: null})
      care.common_charge = 0
      if (care.need_edge == 1 && care.need_vax == 1){
        data.getCareProductPromise(that.data.shop, '双项', care.urgent).then(function(product){
          product.sale_priceStr = util.showAmount(product.sale_price)
          that.setData({product})
          care.common_charge = product.sale_price
          that.computeCharge(care)
        })
      }
      else{
        var  productName = care.need_vax == 1? '打蜡' : (care.need_edge == 1? '修刃' : null)
        data.getCareProductPromise(that.data.shop, productName, care.urgent).then(function(product){
          product.sale_priceStr = util.showAmount(product.sale_price)
          that.setData({product})
          care.common_charge = product.sale_price
          that.computeCharge(care)
        })
      }
    },
    computeCharge(care){
      var that = this
      var commonCharge = care.common_charge? care.common_charge : 0
      var repairCharge = care.repair_charge? care.repair_charge : 0
      var discount = care.discount? care.discount : 0
      var summary = commonCharge + repairCharge - discount
      care.summary = summary
      care.summaryStr = util.showAmount(summary)
      that.setData({care})
    },
    getWellFormMessage(care){
      var that = this
      if (!care.equipment || care.equipment == ''){
        return '必须选择类型'
      }
      if ((!care.careImages || care.careImages.length == 0) 
      && (!care.brand || care.brand == '' || !care.scale || care.scale == '')){
        return '图片和品牌长度必填其一'
      }
      if (!that.data.product && (!care.repair_charge || care.repair_charge == 0)){
        return '必须选择业务'
      }
      return ''
    },
    save(e){
      var that = this
      var care = that.data.care
      var message = that.getWellFormMessage(care)
      if (message!=''){
        wx.showToast({
          title: message,
          icon: 'error'
        })
      }
      var order = that.data.order
      if (!order || order == null){
        order = {}
      }
      if (!order.cares || order.cares == null){
        order.cares = []
      }
      var currentCare = null
      for(var i = 0; i < order.cares.length; i++){
        if (order.cares[i].current == 1){
          currentCare = order.cares[i]
          break
        }
      }
      care.current = 1
      if (currentCare == null){
        order.cares.push(care)
      }
      else{
        currentCare = care
        currentCare.current = 1
      }
      that.triggerEvent('CareOrderUpdate', order)
    }
  }
})
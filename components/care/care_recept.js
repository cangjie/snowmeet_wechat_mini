// components/care/care_recept.js
const app = getApp()
const data = require('../../utils/data.js')
const util = require('../../utils/util.js')
Component({
  properties: {
    order: Object,
    shop: String
  },
  data: {
    care: null,
    brandSelectIndex: null,
    brandList: [],
    addingNewBrand: false,
    filledBrandName: null,
    filledBrandChineseName: null,
    wellFormed: false
  },
  lifetimes: {
    ready() {
      var that = this
      if (that.properties.order) {
        for (var i = 0; that.properties.order.cares && i < that.properties.order.cares.length; i++) {
          if (that.properties.order.cares[i].current == 1) {
            that.setData({
              care: that.properties.order.cares[i], currentCareIndex: i,
              shop: that.properties.shop, order: that.properties.order
            })
            break
          }
        }
        if (!that.data.care && that.data.order && that.data.order.cares && that.data.order.cares.length > 0) {
          order.cares[0].current = 1
          that.setData({
            care: that.data.order.cares[0], currentCareIndex: 0,
            shop: that.properties.shop, order: that.properties.order
          })
        }
      }
      else {

        var order = {
          shop: that.properties.shop,
          cares: []
        }
        var care = {
          current: 1
        }
        order.cares.push(care)
        that.setData({ care, order, shop: that.properties.shop })
        that.buildImages()
      }
      app.loginPromiseNew.then(function (resolve) {
        var order = that.data.order
        var currentCare = null
        for (var i = 0; order && order.cares && i < order.cares.length; i++) {
          if (order.cares[i].current == 1) {
            currentCare = order.cares[i]
          }
        }
        if (currentCare == null && order && order.cares && order.cares.length > 0) {
          currentCare = order.cares[0]
        }
        else {
          if (currentCare == null) {
            currentCare = {
              current: 1
            }
            order.cares.push(currentCare)
          }
        }
        data.getEquipBrandsPromise('双板').then(function (list) {
          that.setData({ skiBrandList: list })
          data.getEquipBrandsPromise('单板').then(function (list) {
            that.setData({ boardBrandList: list })
            data.getCareOthersServicePromise('双板').then(function (list) {
              that.setData({ skiOthersService: list.map((l) => { return { name: l, checked: false } }) })
              data.getCareOthersServicePromise('单板').then(function (list) {
                that.setData({ othersService: [], boardOthersService: list.map((l) => { return { name: l, checked: false } }) })
                that.loadData(currentCare)
                /*
                data.getMemberTicketsPromise(that.data.order.member_id, '养护', true, app.globalData.sessionKey).then(function (tickets) {
                  console.log('tickets', tickets)
                  tickets = tickets.sort((a, b) => a.template_id - b.template_id)
                  that.setData({ tickets: tickets })
                  that.setCateTicket()
                })
                */
              })
            })
          })
        })
      })
    }
  },
  /**
   * Component methods
   */
  methods: {
    loadData(care) {
      var that = this
      var brandList = null
      var othersService = null
      if (care.equipment == '单板') {
        brandList = that.data.boardBrandList
        othersService = that.data.boardOthersService
      }
      else if (care.equipment == '双板') {
        brandList = that.data.skiBrandList
        othersService = that.data.skiOthersService
      }
      var brandSelectIndex = null
      for (var i = 0; brandList && i < brandList.length; i++) {
        if (brandList[i].displayedName == care.brand) {
          brandSelectIndex = i
          break
        }
      }
      if (care.repair_memo && care.repair_memo != '') {
        var memoArr = care.repair_memo.split(',')
        for (var i = 0; othersService && i < othersService.length; i++) {
          for (var j = 0; j < memoArr.length; j++) {
            if (othersService[i].name == memoArr[j]) {
              othersService[i].checked = true
            }
          }
        }
      }
      var message = util.getCareWellFormMessage(care)
      that.setData({ brandList, brandSelectIndex, care, othersService, wellFormed: message == '' ? true : false })
    },
    setDiscount(e) {
      var that = this
      var care = that.data.care
      if (care.ticket_code != null && care.ticket.template_id == 16) {
        if (care.need_edge == 1 && care.need_wax == 1) {
          care.discount = 30
          that.computeCharge(care)
        }
        else if (care.need_edge == 1 || care.need_wax == 1) {
          care.discount = 20
          that.computeCharge(care)
        }
      }
    },
    setValue(e) {
      var that = this
      var id = e.currentTarget.id
      var value = e.detail.value
      var care = that.data.care
      var needRender = true
      if (!care) {
        care = {}
      }
      switch (id) {
        case 'equipment':
          care.equipment = value
          var brandList = []
          switch (value) {
            case '单板':
              brandList = that.data.boardBrandList
              that.setData({ othersService: that.data.boardOthersService })
              break
            case '双板':
              brandList = that.data.skiBrandList
              that.setData({ othersService: that.data.skiOthersService })
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
          that.setData({ brandSelectIndex: null, brandList, addingNewBrand: false })
          break
        case 'brand':
          var brandSelectIndex = e.detail.value
          var selectedBrand = that.data.brandList[parseInt(brandSelectIndex)]
          care.brand = selectedBrand.displayedName
          var addingNewBrand = false
          if (brandSelectIndex == that.data.brandList.length - 1) {
            addingNewBrand = true
          }
          that.setData({ brandSelectIndex, addingNewBrand })
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
          if (care.edge_degree == undefined || care.edge_degree == null || care.edge_degree == '') {
            care.edge_degree = '89'
          }
          if (care.ticket_code == null) {
            that.getProduct(care)
          }
          else {
            if (care.ticket.template_id == 12) {
              that.getTicketProduct(care)
            }
            else if (care.ticket.template_id == 16) {
              that.getProduct(care)
              that.setDiscount()
            }
          }
          break
        case 'edge_degree':
          care.edge_degree = value
          break
        case 'need_wax':
          care.need_wax = value.length
          care.need_unwax = care.need_wax
          if (care.need_wax == 1) {
            care.free_wax = 0
          }
          if (care.ticket_code == null) {
            that.getProduct(care)
          }
          else {
            if (care.ticket.template_id == 12) {
              that.getTicketProduct(care)
            }
            else if (care.ticket.template_id == 16) {
              that.getProduct(care)
              that.setDiscount()
            }
          }
          break
        case 'need_unwax':
          care.need_unwax = value.length
          break
        case 'urgent':
          care.urgent = value.length
          if (care.ticket_code == null) {
            that.getProduct(care)
          }
          else {
            that.getTicketProduct(care)
          }
          break
        case 'othter_services':
          console.log('other services', value)
          care.otherServicesArray = value
          care.repair_memo = value.join(',')
          break
        case 'others_memo':
          if (care.repair_memo == '') {
            care.repair_memo = value
          }
          else {
            care.repair_memo += ',' + value
          }
          break
        case 'repair_charge':
          if (!isNaN(value) && value[value.length - 1] != '.') {
            //needRender = false
            care.repair_charge = parseFloat(value)
            that.computeCharge(care)
          }
          else {
            needRender = false
          }
          break
        case 'discount':
          if (!isNaN(value) && value[value.length - 1] != '.') {
            //needRender = false
            care.discount = parseFloat(value)
            that.computeCharge(care)
          }
          else {
            needRender = false
          }
          break
        case 'memo':
          care.memo = value
          break
        case 'special':
          care.entertain = false
          care.warranty = false
          if (value == '招待') {
            care.entertain = true
          }
          if (value == '质保') {
            care.warranty = true
          }
          that.computeCharge(care)
          break
        case 'ticket':
          if (e.detail.value.length == 1) {
            care.ticket_code = care.ticket.code
            care.ticket.use = true
            if (care.ticket.template_id == 12) {
              care.free_wax = 1
              that.getTicketProduct(care)
            }
            else if (care.ticket.template_id == 16) {
              that.setDiscount()
            }
          }
          else {
            care.ticket_code = null
            care.ticket.use = false
            care.free_wax = 0
            care.discount = 0;
            that.getProduct(care)
          }
          break
        case 'free_wax':
          if (e.detail.value.length == 1) {
            care.need_wax = 0
            care.need_unwax = 0
            care.free_wax = 1
          }
          else {
            care.free_wax = 1
          }
          if (care.ticket_code == null) {
            that.getProduct(care)
          }
          else {
            that.getTicketProduct(care)
          }
          break
        case 'summer':
          console.log('summer', value)
          care.summer = null
          for (var i = value.length - 1; care.summer == null && i >= 0; i--) {
            if (value[i] == 'now' || value[i] == 'later') {
              care.summer = value[i]
            }
          }
          if (care.summer == 'later') {
            care.need_edge = 1
            care.need_wax = 1
            care.need_unwax = 1
          }
          if (care.summer == 'now') {
            care.need_edge = 0
            care.need_wax = 0
            care.need_unwax = 0
          }
          if (care.summer != null && care.edge_degree == null){
            care.edge_degree = '89'
          }
          that.getProduct(care)
          break
        default:
          break
      }
      if (needRender) {
        that.setData({ care })
      }
      e.needRender = needRender
      e.displayErrorMessage = false
      that.save(e)
    },
    afterRead(e) {
      console.log('photo uploaded', e)
      var that = this
      var care = that.getCurrentCare()
      var uploadFile = e.detail.file
      var images = care.careImages
      if (!care.careImages) {
        care.careImages = []
        images = care.careImages
      }
      var image = {
        care_id: care.id,
        image_id: 0,
        status: 'uploading',
        message: '上传中',
        image: {
          id: 0,
          file_path_name: uploadFile.tempFilePath,
          thumb: uploadFile.thumb,
          thumbUrl: uploadFile.thumb,
          file_type: uploadFile.type
        }
      }
      images.push(image)
      that.buildImages()
      data.uploadFilePromise(null, uploadFile.tempFilePath, '养护开单', uploadFile.type, app.globalData.sessionKey)
        .then(function (uploadedFile) {
          console.log('file uploaded', uploadedFile)
          image.id = uploadedFile.id
          image.url = uploadedFile.file_path_name
          image.thumb = uploadedFile.file_path_name
          image.type = uploadedFile.file_type
          data.uploadFilePromise(uploadedFile.id, uploadFile.thumb, null, null, app.globalData.sessionKey)
            .then(function (uploadThumbFile) {
              console.log('thumb uploaded', uploadThumbFile)
              image.id = uploadThumbFile.id
              image.thumb = uploadThumbFile.thumbUrl
              image.status = 'success'
              image.message = ''
              image.image = uploadThumbFile
              var care = that.getCurrentCare()
              for (var i = 0; i < care.careImages.length; i++) {
                if (care.careImages[i].status == 'uploading') {
                  care.careImages[i] = image
                  break
                }
              }
              that.buildImages()
            }).catch(function (exp) {

            })
        })
    },
    buildImages() {
      var that = this
      var order = that.data.order
      if (!order) {
        order = {
          cares: [{ current: 1 }]
        }
      }
      that.data.order = order
      var care = that.getCurrentCare()
      if (!care) {
        care = {}
      }
      if (!care.careImages) {
        care.careImages = []
      }

      for (var i = 0; i < care.careImages.length; i++) {
        var image = care.careImages[i]
        if (image.image.thumb.indexOf('http') == 0) {
          image.thumb = image.image.thumb
        }
        else {
          image.thumb = 'https://snowmeet.wanlonghuaxue.com' + image.image.thumb
        }
        if (image.image.file_path_name.indexOf('http') == 0) {
          image.url = image.image.file_path_name
        }
        else {
          image.url = 'https://snowmeet.wanlonghuaxue.com' + image.image.file_path_name
        }
      }
      that.setData({ order, care })
      that.triggerEvent('CareOrderUpdate', { order: that.data.order, refreshMain: false, refreshFooter: true })
    },
    delImage(e) {
      console.log('del image', e)
      var that = this
      var index = e.detail.index
      var care = that.data.care
      var images = care.careImages
      var newImages = []
      for (var i = 0; i < images.length; i++) {
        if (i != index) {
          newImages.push(images[i])
        }
      }
      care.careImages = newImages
      that.setData({ care })
    },
    cancelAddBrand(e) {
      var that = this
      that.setData({ addingNewBrand: false, brandSelectIndex: null })
    },
    confirmAddBrand(e) {
      var that = this
      var brandName = that.data.filledBrandName
      var chineseName = that.data.filledBrandChineseName
      if (!brandName) {
        wx.showToast({
          title: '必须填写英文名称',
          icon: 'error'
        })
        return
      }
      var updateUrl = app.globalData.requestPrefix + 'Care/UpdateBrandByStaff?type=' + encodeURIComponent(that.data.care.equipment) + '&brandName=' + encodeURIComponent(brandName) + '&chineseName=' + encodeURIComponent(chineseName) + '&sessionKey=' + app.globalData.sessionKey
      util.performWebRequest(updateUrl, null).then(function (brandList) {
        switch (that.data.care.equipment) {
          case '单板':
            var boardBrandList = brandList
            var brandList = boardBrandList
            that.setData({ boardBrandList, brandList })
            break
          case '双板':
            var skiBrandList = brandList
            var brandList = brandList
            that.setData({ skiBrandList, brandList })
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
        for (var i = 0; i < that.data.brandList.length; i++) {
          var brand = that.data.brandList[i]
          if (brand.brand_name == that.data.filledBrandName) {
            index = i
            break
          }
        }
        that.setData({ brandSelectIndex: i, addingNewBrand: false, brandList })
      })
    },
    getProduct(care) {
      var that = this
      that.setData({ product: null })
      care.common_charge = 0
      if (care.need_edge == 1 && care.need_wax == 1 && care.summer == null) {
        data.getCareProductPromise(that.data.shop, '双项', care.urgent).then(function (product) {
          product.sale_priceStr = util.showAmount(product.sale_price)
          that.setData({ product })
          care.common_charge = product.sale_price
          care.product = product
          care.product_id = product.id
          that.computeCharge(care)
          that.save()
          that.triggerEvent('CareOrderUpdate', { order: that.data.order, refreshMain: false, refreshFooter: true })
        })
      }
      else if ((care.need_edge == 1 || care.need_wax == 1) && care.summer == null ) {
        var productName = care.need_wax == 1 ? '打蜡' : (care.need_edge == 1 ? '修刃' : null)
        data.getCareProductPromise(that.data.shop, productName, care.urgent).then(function (product) {
          product.sale_priceStr = util.showAmount(product.sale_price)
          that.setData({ product })
          care.common_charge = product.sale_price
          care.product = product
          care.product_id = product.id
          that.computeCharge(care)
          that.save()
          that.triggerEvent('CareOrderUpdate', { order: that.data.order, refreshMain: false, refreshFooter: true })
        })
      }
      else if (care.summer != null) {
        care.product = {
          sale_price: 330,
          sale_priceStr: '¥330.00'
        }
        care.common_charge = care.product.sale_price
        care.summary = care.product.sale_price
        care.summaryStr = care.product.sale_priceStr
        that.computeCharge(care)
        that.save()
        that.triggerEvent('CareOrderUpdate', { order: that.data.order, refreshMain: false, refreshFooter: true })
      }
      else {
        care.product = null
        care.product_id = null
        care.common_charge = 0
        that.computeCharge(care)
        that.save()
        that.triggerEvent('CareOrderUpdate', { order: that.data.order, refreshMain: false, refreshFooter: true })
      }
    },
    getTicketTemplate(templates, item) {
      for (var i = 0; i < templates.length; i++) {
        var prodName = templates[i].product.name
        switch (item) {
          case '修刃':
            if (prodName.indexOf('修刃') >= 0 && prodName.indexOf('打蜡') < 0) {
              return templates[i]
            }
            break
          case '打蜡':
            if (prodName.indexOf('修刃') < 0 && prodName.indexOf('打蜡') >= 0) {
              return templates[i]
            }
            break
          case '双项':
            if (prodName.indexOf('修刃') >= 0 && prodName.indexOf('打蜡') >= 0) {
              return templates[i]
            }
            break
          default:
            break
        }
      }
      return null
    },
    getTicketProduct(care) {
      var that = this
      var ticket = care.ticket
      if (ticket.template.productTicketTemplates == null || ticket.template.productTicketTemplates.length == 0) {
        return
      }
      if (care.free_wax == 1) {
        if (care.need_edge == 1) {
          var template = that.getTicketTemplate(care.ticket.template.productTicketTemplates, '修刃')
          if (template != null) {
            care.product = template.product
            care.product_id = template.product.id
            care.common_charge = template.fixed_price
            that.computeCharge(care)
            that.save()
            that.triggerEvent('CareOrderUpdate', { order: that.data.order, refreshMain: false, refreshFooter: true })
          }
        }
        else {
          care.product = null
          care.product_id = null
          care.common_charge = 0
          that.computeCharge(care)
          that.save()
          that.triggerEvent('CareOrderUpdate', { order: that.data.order, refreshMain: false, refreshFooter: true })
        }
      }
      else {
        if (care.need_edge == 1) {
          var template = that.getTicketTemplate(care.ticket.template.productTicketTemplates, '双项')
          if (template != null) {
            care.product = template.product
            care.product_id = template.product.id
            care.common_charge = template.fixed_price
            that.computeCharge(care)
            that.save()
            that.triggerEvent('CareOrderUpdate', { order: that.data.order, refreshMain: false, refreshFooter: true })
          }
        }
        else {
          var template = that.getTicketTemplate(care.ticket.template.productTicketTemplates, '打蜡')
          if (template != null) {
            care.product = template.product
            care.product_id = template.product.id
            care.common_charge = template.fixed_price
            that.computeCharge(care)
            that.save()
            that.triggerEvent('CareOrderUpdate', { order: that.data.order, refreshMain: false, refreshFooter: true })
          }
        }
      }

    },
    computeCharge(care) {
      var that = this
      var commonCharge = care.common_charge ? care.common_charge : 0
      var repairCharge = care.repair_charge ? care.repair_charge : 0
      var discount = care.discount ? care.discount : 0
      var summary = commonCharge + repairCharge - discount
      care.summary = summary
      if (care.warranty == 1 || care.entertain == 1) {
        care.summary = 0
      }
      care.summaryStr = util.showAmount(care.summary)
      that.setData({ care })
    },

    save(e) {
      var that = this
      var care = that.data.care
      var message = util.getCareWellFormMessage(care)
      if (message != '' && e && e.displayErrorMessage) {
        wx.showToast({
          title: message,
          icon: 'error'
        })
        that.setData({ wellFormed: false })
      }
      else {
        if (message != '') {
          that.setData({ wellFormed: false })
        }
        else {
          that.setData({ wellFormed: true })
        }
      }
      var order = that.data.order
      if (!order || order == null) {
        order = {}
      }
      if (!order.cares || order.cares == null) {
        order.cares = []
      }
      care.current = 1
      if (order.cares.length == 0) {
        order.cares.push(care)
      }
      else {
        var find = false
        for (var i = 0; i < order.cares.length; i++) {
          if (order.cares[i].current == 1) {
            order.cares[i] = care
            find = true
            break
          }
        }
        if (!find) {
          care.current = 1
          order.cares[0] = care
        }
      }
      if (!e || e.needRender == undefined || e.needRender == true) {
        that.setData({ order })
      }
      that.triggerEvent('CareOrderUpdate', { order: order, refreshMain: false, refreshFooter: true })
    },
    addMore(e) {
      var that = this
      that.save(e)
      var order = that.data.order
      for (var i = 0; order && order.cares && i < order.cares.length; i++) {
        order.cares[i].current = 0
      }
      var care = {}
      care.current = 1
      order.cares.push(care)
      that.setData({ order, care, othersService: [], wellFormed: false })
      console.log('new care', care)
      that.loadData(care)
      that.triggerEvent('CareOrderUpdate', { order: order })
    },
    getCurrentCare() {
      var that = this
      var order = that.data.order
      var care = null
      for (var i = 0; order && order.cares && i < order.cares.length; i++) {
        if (order.cares[i].current == 1) {
          care = order.cares[i]
        }
      }
      if (care == null && order && order.cares && order.cares.length > 0) {
        care = order.cares[0]
      }
      return care
    },
    setCateTicket() {
      var that = this
      var tickets = that.data.tickets
      if (tickets == null || tickets.length <= 0) {
        return
      }
      var order = that.data.order
      var care = that.getCurrentCare()
      var ticket = null
      for (var j = 0; tickets != null && j < tickets.length; j++) {
        ticket = tickets[j]
        var use = false
        for (var i = 0; order.cares != null && i < order.cares.length; i++) {
          if (order.cares[i].ticket != null && order.cares[i].ticket.use == true && order.cares[i].ticket_code == ticket.code) {
            use = true
            break
          }
        }
        if (use == false) {
          ticket = tickets[j]
          break
        }
      }
      if (care.ticket_code == null) {
        care.ticket = ticket
        that.setData({ care })
      }
    },
    selectTicket(e){
      var that = this
      var order = that.data.order
      var care = that.data.care
      var disableArr = []
      for(var i = 0; order != null && i < order.cares.length; i++){
        if (order.cares[i].ticket_code != null && order.cares[i].ticket_code != care.ticket_code){
          disableArr.push(order.cares[i].ticket_code)
        }
      }
      that.setData({showTicketPopUp: true, disableArr})
    },
    ticketSelectorEvent(e){
      var that = this
      if (e.detail.action == 'confirm'){
        var care = that.data.care
        care.ticket = e.detail.selectedTicket

        if (care.ticket != null) {
          care.ticket_code = care.ticket.code
          care.ticket.use = true
          if (care.ticket.template_id == 12) {
            care.free_wax = 1
            that.getTicketProduct(care)
          }
          else if (care.ticket.template_id == 16) {
            that.setDiscount()
          }
          else if (care.ticket.template_id == 17){
            care.need_edge = 0
            care.need_wax = 0
            care.need_unwax = 0
            care.common_charge = 0
            care.biz_type = '非雪季养护'
          }
          else if (care.ticket.template_id == 18){
            care.need_edge = 1
            if (!care.edge_degree){
              care.edge_degree = '89'
            }
            care.need_wax = 1
            care.need_unwax = 1 
            care.common_charge = 0
            care.summary = 0
          }
        }
        else {
          care.ticket_code = null
          care.ticket = null
          care.free_wax = 0
          care.discount = 0
          care.need_edge = 0
          care.need_wax = 0
          care.need_unwax = 0
          that.getProduct(care)
        }
        that.setData({care, showTicketPopUp: false})
        that.save(e)
      }
      else{
        that.setData({showTicketPopUp: false})

        //that.triggerEvent('CareOrderUpdate', { order: that.data.order, refreshMain: true, refreshFooter: true })
      }
      that.save(e)
    }
  },
  
})
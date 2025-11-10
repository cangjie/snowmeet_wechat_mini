// pages/admin/care/order_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
Page({

  /**
   * Page initial data
   */
  data: {
    activeTabIndex: 0,
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    if (options.orderId) {
      that.data.orderId = options.orderId
    }
    if (options.careId) {
      that.data.careId = options.careId
    }
    data.getEquipBrandsPromise('双板').then(function (list) {
      that.setData({ skiBrandList: list })
    })
    data.getEquipBrandsPromise('单板').then(function (list) {
      that.setData({ boardBrandList: list })
    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {
    var that = this
    app.loginPromiseNew.then(function (resovle) {
      that.getData()

    }).catch(function (exp) {
      console.log('promise error', exp)
    })
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  },
  getData() {
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Order/GetOrderByStaff/' + that.data.orderId + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, undefined).then(function (order) {
      console.log('get order', order)
      order = that.renderOrder(order)
      that.setData({ order })
    }).catch(function () {

    })
  },
  renderOrder(order) {
    var that = this
    var bizDate = new Date(order.biz_date)
    order.bizDateStr = util.formatDate(bizDate)
    order.bizTimeStr = util.formatTimeStr(bizDate)
    order.paidAmountStr = util.showAmount(order.paidAmount)
    for (var i = 0; order.cares && i < order.cares.length; i++) {
      var care = order.cares[i]
      if (care.brand && care.brand != '' && care.scale && care.scale != ''){
        care.baseInfoWellFormed = true
      }
      else{
        care.baseInfoWellFormed = false
      }
      if (care.baseInfoWellFormed && care.tasks[0].status != '已完成'){
        care.safeChecking = true
      }
      else{
        care.safeChecking = false
      }
      care.title = (care.brand==null?'未填': care.brand )+ ' ' + (care.scale==null?'未填':care.scale)

      care.moddingBaseInfo = false

      if (care.serials) {
        care.diffSerial = care.serials.indexOf('|') >= 0
        if (care.diffSerial) {
          var serialArr = care.serials.split('|')
          care.leftSerial = serialArr[0]
          care.rightSerial = serialArr.length > 1 ? serialArr[1] : ''
        }
      }
      else {
        care.serials = ''
      }
      for(var j = 0; care.tasks && j < care.tasks.length; j++){
        var task = care.tasks[j]
        switch(task.task_name){
          case '修刃':
            task.title = task.task_name + ' 角度：' + (care.edge_degree ? care.edge_degree : '89')
            break
          case '维修':
            task.title = task.task_name  + ' ' + care.repair_memo
            break
          default:
            task.title = task.task_name
            break
        }
        
      }
      order = that.buildImages(order, i)
    }
    return order
  },
  afterRead(e) {
    console.log('photo uploaded', e)
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var uploadFile = e.detail.file
    var images = care.careImages
    if (!care.careImages) {
      care.careImages = []
      images = care.careImages
    }
    var image = {
      id: 0,
      care_id: care.id,
      image_id: 0,
      status: 'uploading',
      message: '上传中',
      image: {
        id: 0,
        file_path_name: uploadFile.tempFilePath,
        thumb: uploadFile.thumb,
        thumbUrl: uploadFile.thumb,
        file_type: uploadFile.type,
        care_id: care.id
      }
    }
    images.push(image)
    var imageIndex = order.cares[index].careImages.length - 1
    order = that.buildImages(order, index)
    that.setData({order})
    data.uploadFilePromise(null, uploadFile.tempFilePath, '养护开单', uploadFile.type, app.globalData.sessionKey)
      .then(function (uploadedFile) {
        console.log('file uploaded', uploadedFile)
        var image = order.cares[index].careImages[imageIndex]
        image.image_id = uploadedFile.id
        image.url = uploadedFile.file_path_name
        image.thumb = uploadedFile.file_path_name
        image.type = uploadedFile.file_type
        data.uploadFilePromise(uploadedFile.id, uploadFile.thumb, null, null, app.globalData.sessionKey)
          .then(function (uploadThumbFile) {
            console.log('thumb uploaded', uploadThumbFile)
            var care = order.cares[index]
            var image = care.careImages[imageIndex]
            image.image_id = uploadThumbFile.id
            image.thumb = uploadThumbFile.thumbUrl
            image.status = 'success'
            image.message = ''
            image.image = uploadThumbFile
            order = that.buildImages(order, index)
            that.setData({order})
          }).catch(function (exp) {

          })
      })
  },
  buildImages(order, index) {
    //var that = this
    //var order = that.data.order
    var care = order.cares[index] //that.getCurrentCare()
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
      //image.deleteable = care.moddingBaseInfo
    }
    return order
    //that.setData({ order })
    //that.triggerEvent('CareOrderUpdate', { order: that.data.order, refreshMain: false, refreshFooter: true })
  },
  setModBaseInfo(e) {
    var that = this
    var index = e.currentTarget.id
    var order = that.data.order
    var care = order.cares[index]
    care.moddingBaseInfo = true
    that.setData({ order })
  },
  setCancelModeBaseInfo(e) {
    var that = this
    var index = e.currentTarget.id
    var order = that.data.order
    var care = order.cares[index]
    care.moddingBaseInfo = false
    that.setData({ order })
  },
  setSerialDiff(e) {
    var that = this
    var index = e.currentTarget.id
    var order = that.data.order
    var care = order.cares[index]
    care.diffSerial = e.detail.value.length == 1
    care.serials = ''
    care.leftSerial = ''
    care.rightSerial = ''
    that.setData({ order })
  },
  setBrand(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    //var brandName = null
    if (care.equipment == '双板') {
      care.brand = that.data.skiBrandList[parseInt(e.detail.value)].displayedName
    }
    else{
      care.brand = that.data.boardBrandList[parseInt(e.detail.value)].displayedName
    }
    that.setData({ order })
  },
  setBootLength(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    care.boot_length = e.detail.value
    that.setData({ order })
  },
  setSerial(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    care.serials = e.detail.value
  },
  setLeftSerial(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    care.leftSerial = e.detail.value
  },
  setRightSerial(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    care.rightSerial = e.detail.value
  },
  setWithPole(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    care.with_pole = e.detail.value.length == 1
    //that.setData({order})
  },
  setOthersAssociates(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    care.others_associates = e.detail.value
  },
  setMemo(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    care.memo = e.detail.value
  },
  setBoardFront(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    care.board_front = e.detail.value
  },
  setScale(e){
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    care.scale = e.detail.value
  },
  setSaveBaseInfo(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    if (care.diffSerial){
      care.serials = care.leftSerial + '|' + care.rightSerial
    }
    for(var i = 0; care.careImages && i < care.careImages.length; i++){
      if (care.careImages[i].image){
        var careImage = care.careImages[i]
        careImage.image_id = careImage.image.id
        careImage.care_id = care.id
      }
    }
    data.updateCarePromise(care, '养护订单详情页修改装备信息', app.globalData.sessionKey).then(function (newCare) {
      order.cares[index] = newCare
      that.renderOrder(order)
      order.cares[index].moddingBaseInfo = false
      that.setData({ order })
      wx.showToast({
        title: '更新成功',
        icon: 'success'
      })
    })
  },
  delImage(e){
    var index = parseInt(e.currentTarget.id)
    var imageIndex = e.detail.index
    var that = this
    var order = that.data.order
    var care = order.cares[index]
    var newImages = []
    for(var i = 0; care.careImages && i < care.careImages.length; i++){
      if (i != imageIndex){
        newImages.push(care.careImages[i])
      }
    }
    care.careImages = newImages
    that.setData({order})
  },
  setHeight(e){
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.height = value
  },
  setWeight(e){
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.weight = value
  },
  setGap(e){
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.gap = value
  },
  setFrontDin(e){
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.front_din = value
  },
  setRearDin(e){
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.rear_din = value
  },
  setLeftAngel(e){
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.left_angel = value
  },
  setRightAngel(e){
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.right_angel = value
  },
  setSafeMemo(e){
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.tasks[0].memo = value
  },
  safeCheck(e){
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    //var care = order.cares[index]
    wx.showModal({
      title: '安全检查确认',
      content: '确认所填参数皆为真实准确的数值，您将成为顾客本次养护的安全负责人。',
      complete: (res) => {
        var order = that.data.order
        var care = order.cares[index]
        if (res.cancel) {
          
        }
        if (res.confirm) {
          var message = ''
          if (!care.height || care.height == ''){
            message = '身高必填'
          }
          else{
            if (care.equipment == '双板'){
              if (!care.front_din || care.front_din == ''){
                message = '前脱落值必填'
              }
              else if (!care.rear_din || care.rear_din == ''){
                message = '后脱落值必填'
              }
              else{
                message = ''
              }
            }
          }
          if (message != ''){
            wx.showToast({
              title: message,
              icon: 'error'
            })
            return
          }
          data.updateCarePromise(care, '安全检查', app.globalData.sessionKey).then(function (newCare){
            data.updateCareTaskStatusPromise(care.tasks[0].id, '已完成', '养护详情页安全检查', app.globalData.sessionKey)
            .then(function (newCare){
              order.cares[index] = newCare
              that.renderOrder(order)
              that.setData({order})
            })
          })
        }
      }
    })
  }
})
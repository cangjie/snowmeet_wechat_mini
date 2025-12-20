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
    showPrint: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var q = options.q
    //q = 'https%3A%2F%2Fmini.snowmeet.top%2Fmapp%2Fadmin%2Fcare%2Forder_detail%3FcareId%3D21286%26orderId%3D61957&scancode_time=1763283742'
    if (q) {
      var orderId = util.parseQuery(q, 'orderId')
      var careId = util.parseQuery(q, 'careId')
      if (orderId) {
        that.data.orderId = orderId
      }
      if (careId) {
        that.data.careId = careId
      }
      that.setData({ q })
    }
    else {
      if (options.orderId) {
        that.data.orderId = options.orderId
      }
      if (options.careId) {
        that.data.careId = options.careId
      }
    }
    data.getEquipBrandsPromise('双板').then(function (list) {
      var unknownBrand = {
        brand_type: '双板',
        brand_name: 'Add New',
        chinese_name: '新增品牌',
        origin: '',
        displayedName: '新增品牌'
      }
      list.push(unknownBrand)
      that.setData({ skiBrandList: list })
    })
    data.getEquipBrandsPromise('单板').then(function (list) {
      var unknownBrand = {
        brand_type: '单板',
        brand_name: 'Add New',
        chinese_name: '新增品牌',
        origin: '',
        displayedName: '新增品牌'
      }
      list.push(unknownBrand)
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
      that.setData({staff: app.globalData.staff})

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
      var activeTabIndex = 0
      if (that.data.careId) {
        for (var i = 0; i < order.cares.length; i++) {
          if (order.cares[i].id == that.data.careId) {
            activeTabIndex = i
            break
          }
        }
      }
      order = that.renderOrder(order)
      that.setData({ order, activeTabIndex })
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
      if (care.brand && care.brand != '' && care.scale && care.scale != '') {
        care.baseInfoWellFormed = true
      }
      else {
        care.baseInfoWellFormed = false
      }
      if (care.baseInfoWellFormed && care.tasks != null && care.tasks.length > 0 && care.tasks[0].status != '已完成') {
        care.safeChecking = true
      }
      else {
        care.safeChecking = false
      }
      care.title = (care.brand == null ? '未填' : care.brand) + ' ' + (care.scale == null ? '未填' : care.scale)

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
      for (var j = 0; care.tasks && j < care.tasks.length; j++) {
        var task = care.tasks[j]
        switch (task.task_name) {
          case '修刃':
            task.title = task.task_name + ' 角度：' + (care.edge_degree ? care.edge_degree : '89')
            break
          case '维修':
            task.title = task.task_name + ' ' + care.repair_memo
            break
          default:
            task.title = task.task_name
            break
        }
        if (task.start_time == null) {
          task.start_timeDateStr = '--'
          task.start_timeTimeStr = '--'
        }
        else {
          var startTime = new Date(task.start_time)
          task.start_timeDateStr = util.formatDate(startTime)
          task.start_timeTimeStr = util.formatTimeStr(startTime)
        }
        if (task.end_time == null) {
          task.end_timeDateStr = '--'
          task.end_timeTimeStr = '--'
        }
        else {
          var endTime = new Date(task.end_time)
          task.end_timeDateStr = util.formatDate(endTime)
          task.end_timeTimeStr = util.formatTimeStr(endTime)
        }
        if (j == 0) {
          if (task.status == '已完成') {
            task.current = false
          }
          else {
            task.current = true
          }
        }
        else {
          if (task.status == '未开始' && (care.tasks[j - 1].status == '已完成' || care.tasks[j - 1].status == '强行中止')) {
            task.current = true
          }
          else if (task.status == '已开始') {
            task.current = true
          }
          else {
            task.current = false
          }
        }
      }
      order = that.buildImages(order, i)
      //order = that.buildPickImages(order, i)

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
    //that.setData({ order })
    data.uploadFilePromise(null, uploadFile.tempFilePath, '养护开单', uploadFile.type, app.globalData.sessionKey)
      .then(function (uploadedFile) {
        console.log('file uploaded', uploadedFile)
        var image = order.cares[index].careImages[imageIndex]
        image.image = uploadedFile
        image.image_id = uploadedFile.id
        image.url = uploadedFile.file_path_name
        image.thumb = uploadedFile.file_path_name
        image.type = uploadedFile.file_type
        order = that.buildImages(order, index)
        care.moddingBaseInfo = true
        that.setData({ order })
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
            care.moddingBaseInfo = true
            that.setData({ order })
          }).catch(function (exp) {
            console.log('upload error', exp)
          })
      })
  },
  afterReadPick(e) {
    console.log('photo uploaded', e)
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var uploadFile = e.detail.file
    var images = [care.pickImage]
    if (!care.pickImage) {
      //care.pickImages = []
      images = [care.pickImage]
    }
    /*
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
    */
    var image = {
      id: 0,
      file_path_name: uploadFile.tempFilePath,
      thumb: uploadFile.thumb,
      thumbUrl: uploadFile.thumb,
      file_type: uploadFile.type,
      care_id: care.id
    }
    images.push(image)
    care.pickImage = image
    var imageIndex = 0//order.cares[index].pickImages.length - 1
    order = that.buildPickImages(order, index)
    that.setData({ order })
    wx.showToast({
      title: '正在上传',
      icon: 'loading'
    })
    data.uploadFilePromise(null, uploadFile.tempFilePath, '养护取板', uploadFile.type, app.globalData.sessionKey)
      .then(function (uploadedFile) {
        console.log('file uploaded', uploadedFile)
        var image = order.cares[index].pickImage
        image.id = uploadedFile.id
        image.url = uploadedFile.file_path_name
        image.thumb = uploadedFile.file_path_name
        image.type = uploadedFile.file_type
        wx.showToast({
          title: '正在上传',
          icon: 'loading'
        })
        data.uploadFilePromise(uploadedFile.id, uploadFile.thumb, null, null, app.globalData.sessionKey)
          .then(function (uploadThumbFile) {
            console.log('thumb uploaded', uploadThumbFile)
            var care = order.cares[index]
            var image = care.pickImage
            image.id = uploadThumbFile.id
            image.thumb = uploadThumbFile.thumbUrl
            image.status = 'success'
            image.message = ''
            image.image = uploadThumbFile
            //order = that.buildPickImages(order, index)
            //that.setData({ order })
            care.pick_image_id = image.id
            wx.showToast({
              title: '正在上传',
              icon: 'loading'
            })
            care.tasks[care.tasks.length - 1].pick_image_id = image.id
            var setUrl = app.globalData.requestPrefix + 'Care/SetPickImageId/' + care.id.toString() + '?imageId=' + image.id + '&sessionKey=' + app.globalData.sessionKey
            util.performWebRequest(setUrl, null).then(function (newOrder) {
              data.updateCareTaskStatusPromise(care.tasks[care.tasks.length - 1].id, '已完成', '上传照片取板', app.globalData.sessionKey).then(function (newCare) {
                for (var j = 0; order && order.cares[j] && j < order.cares[j].id; j++) {
                  if (order.cares[j].id == newCare.id) {
                    order.cares[j] = newCare
                    //that.getData()

                    //that.setData({ order })
                    wx.showToast({
                      title: '拍照发板完成',
                      icon: 'success'
                    })
                  }
                }
              })
            })




            /*
                        data.updateCarePromise(care, '保存发板的照片', app.globalData.sessionKey).then(function (newCare) {
                          order.cares[index] = newCare
                          that.renderOrder(order)
                          order.cares[index].moddingBaseInfo = false
                          that.setData({ order })
                          wx.showToast({
                            title: '正在上传',
                            icon: 'loading'
                          })
                          data.updateCareTaskStatusPromise(care.tasks[care.tasks.length - 1].id, '已完成', '上传照片取板', app.globalData.sessionKey).then(function (newCare) {
                            for (var j = 0; order && order.cares[j] && j < order.cares[j].id; j++) {
                              if (order.cares[j].id == newCare.id) {
                                order.cares[j] = newCare
                                that.getData()
            
                                //that.setData({ order })
                                wx.showToast({
                                  title: '拍照发板完成',
                                  icon: 'success'
                                })
                              }
                            }
                          })
                          
                        })
                        */
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
      if (image.image.thumbUrl.indexOf('http') == 0) {
        image.thumb = image.image.thumbUrl
      }
      else {
        image.thumb = 'https://snowmeet.wanlonghuaxue.com' + image.image.thumbUrl
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
  buildPickImages(order, index) {
    var care = order.cares[index]
    if (!care) {
      care = {}
    }
    if (!care.pickImages) {
      care.pickImages = []
    }
    var image = care.pickImage
    if (image.thumb.indexOf('http') == 0) {
      image.thumb = image.thumb
    }
    else {
      image.thumb = 'https://snowmeet.wanlonghuaxue.com' + image.thumb
    }
    if (image.file_path_name.indexOf('http') == 0) {
      image.url = image.file_path_name
    }
    else {
      image.url = 'https://snowmeet.wanlonghuaxue.com' + image.file_path_name
    }
    return order
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
      if (parseInt(e.detail.value) == that.data.skiBrandList.length - 1) {
        //care.brand = that.data.skiBrandList[parseInt(e.detail.value)].displayedName
        that.setData({ addNewBrand: true })
        //return
      }
      /*
      else{
        care.brand = that.data.skiBrandList[parseInt(e.detail.value)].displayedName
      }
      */
    }
    else {
      care.brand = that.data.boardBrandList[parseInt(e.detail.value)].displayedName
      if (parseInt(e.detail.value) == that.data.boardBrandList.length - 1) {

        that.setData({ addNewBrand: true })
        //return
      }
      /*
      else{
        care.brand = that.data.boardBrandList[parseInt(e.detail.value)].displayedName
      }
      */
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
  setScale(e) {
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
    if (care.diffSerial) {
      care.serials = care.leftSerial + '|' + care.rightSerial
    }
    for (var i = 0; care.careImages && i < care.careImages.length; i++) {
      if (care.careImages[i].image) {
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
  delImage(e) {
    var index = parseInt(e.currentTarget.id)
    var imageIndex = e.detail.index
    var that = this
    var order = that.data.order
    var care = order.cares[index]
    var newImages = []
    for (var i = 0; care.careImages && i < care.careImages.length; i++) {
      if (i != imageIndex) {
        newImages.push(care.careImages[i])
      }
    }
    care.careImages = newImages
    that.setData({ order })
  },
  setHeight(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.height = value
  },
  setWeight(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.weight = value
  },
  setGap(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.gap = value
  },
  setFrontDin(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.front_din = value
  },
  setRearDin(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.rear_din = value
  },
  setLeftAngel(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.left_angel = value
  },
  setRightAngel(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.right_angel = value
  },
  setSafeMemo(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    var value = e.detail.value
    care.tasks[0].memo = value
  },
  safeCheck(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    if (care.careImages == null || care.careImages.length <= 0){
      wx.showToast({
        title: '必须传照片',
        icon: 'error'
      })
      return
    }
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
          if (!care.height || care.height == '') {
            message = '身高必填'
          }
          else {
            if (care.equipment == '双板') {
              if (!care.front_din || care.front_din == '') {
                message = '前脱落值必填'
              }
              else if (!care.rear_din || care.rear_din == '') {
                message = '后脱落值必填'
              }
              else {
                message = ''
              }
            }
          }
          if (message != '') {
            wx.showToast({
              title: message,
              icon: 'error'
            })
            return
          }
          data.updateCarePromise(care, '安全检查', app.globalData.sessionKey).then(function (newCare) {
            data.updateCareTaskStatusPromise(care.tasks[0].id, '已完成', '养护详情页安全检查', app.globalData.sessionKey)
              .then(function (newCare) {
                order.cares[index] = newCare
                that.renderOrder(order)
                that.setData({ order })
              })
          })
        }
      }
    })
  },
  setTaskStart(e) {
    var that = this
    var taskId = parseInt(e.currentTarget.id)
    var order = that.data.order
    wx.showModal({
      title: '确认开始？',
      content: '',
      complete: (res) => {
        if (res.cancel) {

        }

        if (res.confirm) {

          data.updateCareTaskStatusPromise(taskId, '已开始', '养护详情页', app.globalData.sessionKey)
            .then(function (newCare) {

              for (var i = 0; i < order.cares.length; i++) {
                if (order.cares[i].id == newCare.id) {
                  order.cares[i] = newCare
                  break
                }
              }
              order = that.renderOrder(order)
              that.setData({ order })
            })
        }
      }
    })
  },
  setTaskEnd(e) {
    var that = this
    var taskId = parseInt(e.currentTarget.id)
    var order = that.data.order
    var status = '已完成'
    var task = null
    for (var i = 0; i < order.cares.length; i++) {
      var care = order.cares[i]
      for (var j = 0; j < care.tasks.length; j++) {
        if (care.tasks[j].id == taskId) {
          task = care.tasks[j]
          if (task.id == taskId && task.staff_id != app.globalData.staff.id) {
            status = '强行中止'
            //task = care.tasks[j]
          }
        }
      }
      if (task != null) {
        break
      }
    }
    var startTimeStamp = new Date(task.start_time).valueOf()
    var endTimeStamp = (new Date()).valueOf()
    var timeLength = parseFloat((endTimeStamp - startTimeStamp) / 60000).toFixed(2)
    var title = '确认任务结束'
    var content = '本任务共耗时 ' + timeLength + ' 分钟'
    if (status == '强行中止') {
      title = '确认强行中止任务'
      content = '本任务是 ' + task.staff.name + ' 在执行，确认强行中止吗？'
    }
    wx.showModal({
      title: title,
      content: content,
      complete: (res) => {
        if (res.cancel) {

        }
        if (res.confirm) {
          data.updateCareTaskStatusPromise(taskId, status, '养护详情页', app.globalData.sessionKey)
            .then(function (newCare) {
              for (var i = 0; i < order.cares.length; i++) {
                if (order.cares[i].id == newCare.id) {
                  order.cares[i] = newCare
                  break
                }
              }
              order = that.renderOrder(order)
              that.setData({ order })
            })
        }
      }
    })
    //console.log('task length', parseFloat((endTimeStamp - startTimeStamp)/60000).toFixed(2))
  },
  setVeriType(e) {
    var that = this
    var veriType = e.detail.value
    var index = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[index]
    care.veriType = veriType
    if (veriType == '本人扫码') {
      that.createQrCode(care.id)
    }
    if (veriType == '验证码'){
      wx.showModal({
        title: '即将发送验证码',
        content: '验证码会通过公众号消息的形式发送给【' + that.data.order.member.title + '】手机号【' + that.data.order.member.cell + '】',
        complete: (res) => {
          if (res.cancel) {
            
          }
      
          if (res.confirm) {
            that.createVeriCode(care.id)      
          }
        }
      })
      
    }
    that.setData({ order })
  },
  createVeriCode(id){
    var veriUrl = app.globalData.requestPrefix + 'Care/CreateVerifyCode/' + id.toString() + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(veriUrl, null).then(function(care){
      wx.showToast({
        title: '发送成功',
        icon: 'success'
      })
    })
  },
  createQrCode(id) {
    var that = this
    var getQrUrl = app.globalData.requestPrefix + 'QrCode/CreateNewScanQrCodeByStaff?code=' + encodeURIComponent('care_veri_' + id.toString()) + '&scene=' + encodeURIComponent('店铺接待') + '&purpose=' + encodeURIComponent('养护取板') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    util.performWebRequest(getQrUrl, null).then(function (qrCode) {
      console.log('qr code', qrCode)
      that.setData({ scanQrCode: qrCode })
      var getQRUrl = 'https://wxoa.snowmeet.top/api/OfficialAccountApi/GetOAQRCodeUrl?content=' + qrCode.code
      wx.request({
        url: getQRUrl,
        method: 'GET',
        success: (res) => {
          that.setData({ qrcodeUrl: res.data })
          that.startWebSocketQuery()
        }
      })
    })
  },
  onTabChange(e) {
    var that = this
    console.log('tab change', e)
    var index = e.detail.index
    var order = that.data.order
    var care = order.cares[index]
    care.veriType = null
    that.setData({ order })
    if (that.data.scanQrCode) {
      that.closeSocket()
    }

  },
  startWebSocketQuery() {
    var that = this
    var socketTask = that.data.socketTask
    socketTask = wx.connectSocket({
      url: 'wss://' + app.globalData.domainName + '/ws',
      header: { 'content-type': 'application/json' }
    })
    socketTask.isReplied = false
    that.setData({ socketTask })
    socketTask.onError((res) => {
      that.socketError()
    })
    socketTask.onMessage((res) => {
      that.socketMessage(res)
    })
    socketTask.onOpen((res) => {
      console.log('socket open')
      that.socketOpen(res)
    })
    socketTask.onClose((res) => {
      that.socketClosed()
    })
  },
  socketOpen(res) {
    var that = this
    app.globalData.isWebsocketOpen = true
    var socketTask = that.data.socketTask
    var socketCmd = {
      command: 'queryqrscan',
      id: that.data.scanQrCode.id
    }
    var cmdStr = JSON.stringify(socketCmd)
    socketTask.send({
      data: cmdStr,
      success: (res) => {
        console.log('send command', cmdStr)
      }
    })
  },
  socketMessage(res) {
    var that = this
    var msg = JSON.parse(res.data)
    console.log('socket message', msg)
    var scanQrCode = msg.data
    var socketTask = that.data.socketTask
    socketTask.isReplied = true
    that.setData({ scanQrCode, socketTask })

    var order = that.data.order
    if (order.member_id == scanQrCode.scaner_member_id) {
      var careId = parseInt(scanQrCode.code.split('_')[2])
      for (var i = 0; i < order.cares.length; i++) {
        if (order.cares[i].id == careId) {
          var care = order.cares[i]
          data.updateCareTaskStatusPromise(care.tasks[care.tasks.length - 1].id, '已完成', '扫码取板', app.globalData.sessionKey).then(function (newCare) {
            for (var j = 0; order && order.cares[j] && j < order.cares[j].id; j++) {
              if (order.cares[j].id == careId) {
                order.cares[j] = newCare
                that.setData({ order })
                wx.showToast({
                  title: '顾客是本人发板',
                  icon: 'success'
                })
              }
            }
          })
        }

      }

    }
    else {
      wx.showToast({
        title: '顾客非本人',
        icon: 'error'
      })
    }


    socketTask.close({
      success: () => {
        console.log('socket will be closed')
      }
    })
  },
  socketClosed() {
    console.log('socket is closed')
    var that = this
    var socketTask = that.data.socketTask
    var scanQrCode = that.data.scanQrCode
    var title = undefined
    var content = undefined
    /*
    if (scanQrCode.scaner_member_id){
      wx.navigateTo({
        url: 'recept_member_info?memberId=' + scanQrCode.scaner_member_id.toString()
      })
    }
    if (scanQrCode.no_scan == 1){
      wx.navigateTo({
        url: 'recept_member_info'
      })
    }
    */
    if (socketTask && !socketTask.isReplied) {
      title = '网络中断'
      content = '点击确认重新连接，点击取消回到上一页。'
    }
    else if (scanQrCode && scanQrCode.scaned == 0 && scanQrCode.stoped == 0 && scanQrCode.authed == 0) {
      title = '二维码超时'
      content = '点击确认刷新二维码，点击取消回到上一页。'
    }
    if (title && content) {
      wx.showModal({
        title: title,
        content: content,
        complete: (res) => {
          if (res.cancel) {
            wx.navigateBack()
          }
          if (res.confirm) {
            switch (title) {
              case '网络中断':
                that.startWebSocketQuery()
                break
              case '二维码超时':
                //that.refreshQrCode()
                break
              default:
                break
            }
          }
        }
      })
      return
    }
  },
  closeSocket() {
    var that = this
    var scanQrCode = that.data.scanQrCode
    var closeUrl = app.globalData.requestPrefix + 'QrCode/StopQeryScan/' + scanQrCode.id.toString() + '?sessionKey=' + app.globalData.sessionKey + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    util.performWebRequest(closeUrl, undefined).then(function (resolve) {
      console.log('socket will be closed', resolve)
    })
  },
  showPrintBackDrop(e) {
    var that = this
    var id = parseInt(e.currentTarget.id)
    var order = that.data.order
    var careToBePrinted = order.cares[id]
    careToBePrinted.customerName = order.member == null ? '散客' : order.member.title
    careToBePrinted.customerCell = order.member == null ? '' : order.member.cell
    careToBePrinted.shop = order.shop
    that.setData({ showPrint: true, careToBePrinted })
  },
  onPrinterClose(e) {
    var that = this
    that.setData({ showPrint: false })
  },
  cancelAddNewBrand(e) {
    var that = this
    that.setData({ addNewBrand: false })
    that.data.newBrandName = null
    that.data.newBrandChineseName = null
    that.getData()
  },
  confirmAddNewBrand(e) {
    var that = this
    var id = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[id]
    var brandName = that.data.newBrandName
    var chineseName = that.data.newBrandChineseName
    if (!brandName) {
      wx.showToast({
        title: '必须填写英文名称',
        icon: 'error'
      })
      return
    }
    var updateUrl = app.globalData.requestPrefix + 'Care/UpdateBrandByStaff?type=' + encodeURIComponent(care.equipment) + '&brandName=' + encodeURIComponent(brandName) + '&chineseName=' + encodeURIComponent(chineseName) + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(updateUrl, null).then(function (brandList) {
      switch (care.equipment) {
        case '单板':
          var boardBrandList = brandList
          var unknownBrand = {
            brand_type: care.equipment,
            brand_name: 'Add New',
            chinese_name: '新增品牌',
            origin: '',
            displayedName: '新增品牌'
          }
          boardBrandList.push(unknownBrand)
          for (var i = 0; i < boardBrandList.length; i++) {
            if (boardBrandList[i].brand_name == that.data.newBrandName) {
              care.brand = boardBrandList[i].displayedName
            }
          }
          //var brandList = boardBrandList
          order.cares[id] = care
          that.setData({ boardBrandList, order, addNewBrand: false, newBrandName: null, newBrandChineseName: null })
          break
        case '双板':
          var skiBrandList = brandList
          //var brandList = brandList
          var unknownBrand = {
            brand_type: care.equipment,
            brand_name: 'Add New',
            chinese_name: '新增品牌',
            origin: '',
            displayedName: '新增品牌'
          }
          skiBrandList.push(unknownBrand)
          for (var i = 0; i < skiBrandList.length; i++) {
            if (skiBrandList[i].brand_name == that.data.newBrandName) {
              care.brand = skiBrandList[i].displayedName
            }
          }
          order.cares[id] = care
          that.setData({ skiBrandList, order, addNewBrand: false, newBrandName: null, newBrandChineseName: null })
          break
        default:
          break
      }
    })

  },
  setBrandName(e) {
    var that = this
    that.data.newBrandName = e.detail.value
  },
  setBrandChineseName(e) {
    var that = this
    that.data.newBrandChineseName = e.detail.value
  },
  call(e) {
    var cell = e.currentTarget.id
    wx.makePhoneCall({
      phoneNumber: cell,
    })
  },
  masterFinish(e){
    var that = this
    var id = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[id]
    wx.showModal({
      title: '确认发板',
      content: '请核实取板人和会员本人的关系。',
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          data.updateCareTaskStatusPromise(care.tasks[care.tasks.length - 1].id, '已完成', '店长确认', app.globalData.sessionKey).then(function (newCare) {
            for (var j = 0; order && order.cares[j] && j < order.cares[j].id; j++) {
              if (order.cares[j].id == care.id) {
                order.cares[j] = newCare
                that.setData({ order })
                wx.showToast({
                  title: '顾客是本人发板',
                  icon: 'success'
                })
              }
            }
          })
        }
      }
    })
  },
  setVeriCode(e){
    var that = this
    that.data.veriCode = e.detail.value
  },
  pickVeriCode(e){
    var that = this
    var code = that.data.veriCode
    var id = parseInt(e.currentTarget.id)
    var order = that.data.order
    var care = order.cares[id]
    var veriUrl = app.globalData.requestPrefix + 'Care/VeriCareFinishCode/' + care.id.toString() + '?code=' + code + '&sessionKey=' + app.globalData.sessionKey
    that.setData({veriCode: ''})
    util.performWebRequest(veriUrl, null).then(function (newCare){
      for (var j = 0; order && order.cares[j] && j < order.cares[j].id; j++) {
        if (order.cares[j].id == care.id) {
          order.cares[j] = newCare
          that.setData({ order })
          wx.showToast({
            title: '验证通过',
            icon: 'success'
          })
          
        }
      }
    })
  }
})
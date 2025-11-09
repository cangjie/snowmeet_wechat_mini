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
      care.title = care.brand + ' ' + care.scale
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
    }
    return order
  },
  afterRead(e) {
    console.log('photo uploaded', e)
    var that = this
    var index = e.currentTarget.id
    var order = that.data.order
    var care = order.cares[index]
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
    that.buildImages(index)
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
            var care = that.data.order.cares[index] //that.getCurrentCare()
            for (var i = 0; i < care.careImages.length; i++) {
              if (care.careImages[i].status == 'uploading') {
                care.careImages[i] = image
                break
              }
            }
            that.buildImages(index)
          }).catch(function (exp) {

          })
      })
  },
  buildImages(index) {
    var that = this
    var order = that.data.order

    var care = that.data.order.cares[index] //that.getCurrentCare()
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
  }
})
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
Page({

  /**
   * Page initial data
   */
  data: {
    moddingContactInfo: false,
    moddingOrderInfo: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({ id: options.id })

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
    app.loginPromiseNew.then(function (resolve) {
      that.getData()
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
    var orderId = that.data.id
    data.getOrderByStaffPromise(orderId, app.globalData.sessionKey).then(function (order) {
      console.log('get order', order)
      var memberShip = '散客'
      if (order.member && order.member.following_wechat == 1) {
        memberShip = '会员'
      }
      else if (order.member) {
        memberShip = '散客(取关)'
      }
      order.memberShip = memberShip
      order.totalAmountStr = util.showAmount(order.total_amount)
      for(var i = 0; order.retailImages && i < order.retailImages.length; i++){
        var retailImage = order.retailImages[i]
        if (retailImage.image.thumbUrl.indexOf('http') == 0) {
          retailImage.thumb = retailImage.image.thumbUrl
        }
        else {
          retailImage.thumb = 'https://snowmeet.wanlonghuaxue.com' + retailImage.image.thumbUrl
        }
        if (retailImage.image.file_path_name.indexOf('http') == 0) {
          retailImage.url = retailImage.image.file_path_name
        }
        else {
          retailImage.url = 'https://snowmeet.wanlonghuaxue.com' + retailImage.image.file_path_name
        }
      }
      that.setData({ order })
    })
  },
  orderStatusChanged() {
    var that = this
    that.getData()
  },
  dealPaidResult(e) {
    var that = this
    var orderId = e.detail.id
    data.getOrderByStaffPromise(orderId, app.globalData.sessionKey).then(function (order) {
      var paid = util.orderPaid(order)
      if (paid) {
        wx.showToast({
          title: '支付成功',
          icon: 'success'
        })
        that.getData()
      }
    })
  },
  modContactInfo(e){
    var that = this
    that.setData({moddingContactInfo: true})
  },
  cancelModContactInfo(e){
    var that = this
    that.getData()
    that.setData({moddingContactInfo: false})
  },
  inputContactInfo(e){
    var that = this
    var id = e.currentTarget.id
    var order = that.data.order
    var value = e.detail.value
    switch(id){
      case 'contact_name':
        order.contact_name = value
        break
      case 'contact_gender':
        order.contact_gender = value
        break
      case 'contact_num':
        order.contact_num = value
        break
      default:
        break
    }
  },
  confirmModContactInfo(e){
    var that = this
    var order = that.data.order
    data.updateOrderPromise(order, '零售详细页面修改订单', app.globalData.sessionKey).then(function (order){
      that.setData({order})
      that.cancelModContactInfo(e)
    })
  },
  modOrderInfo(e){
    var that = this
    that.setData({moddingOrderInfo: true})
  },
  cancelModOrderInfo(e){
    var that = this
    that.getData()
    that.setData({moddingOrderInfo: false})
  },
  inputOrderInfo(e){
    var that = this
    var id = e.currentTarget.id
    var order = that.data.order
    var value = e.detail.value
    switch(id){
      case 'paying_amount':
        if (!isNaN(value)){
          order.paying_amount = parseFloat(value)
          order.total_amount = parseFloat(value)
          order.retails[0].deal_price = parseFloat(value)
        }
        break
      case 'memo':
        order.retails[0].memo = value
        break
      case 'mi7_code':
        if (value == ''){
          order.retails[0].mi7_code = null
        }
        else{
          order.retails[0].mi7_code = value
        }
        break
      case 'retail_type':
        order.retails[0].retail_type = value
        break
      default:
        break
    }
  },
  confirmModOrderInfo(e){
    var that = this
    var order = that.data.order
    data.updateOrderWithDetailPromise(order, '零售详情页修改', app.globalData.sessionKey).then(function (order){
      console.log('order update', order)
      that.cancelModOrderInfo(e)
    })
  },
  delImage(e){
    var that = this
    var order = that.data.order
    var images = order.retailImages
    var imageIndex = e.detail.index
    var newImages = []
    for(var i = 0; images && i < images.length; i++){
      if (i != imageIndex){
        newImages.push(images[i])
      }
    }
    order.retailImages = newImages
    that.setData({order})
  },
  afterRead(e) {
    var that = this
    var uploadFile = e.detail.file
    var order = that.data.order
    var images = order.retailImages
    var image = {
      id: 0,
      image_id: 0,
      order_id: order.id,
      status: 'uploading',
      message: '上传中',
      url: uploadFile.tempFilePath,
      thumb: uploadFile.tempFilePath
    }
    images.push(image)
    that.setData({order})
    data.uploadFilePromise(null, uploadFile.tempFilePath, '零售开单',
      uploadFile.type, app.globalData.sessionKey).then(function (uploadedFile) {
        image.image_id = uploadedFile.id
        image.url = 'https://snowmeet.wanlonghuaxue.com' + uploadedFile.file_path_name
        image.thumb = 'https://snowmeet.wanlonghuaxue.com' + uploadedFile.file_path_name
        image.type = uploadedFile.file_type
        that.setData({order})
        setTimeout(() => {data.uploadFilePromise(uploadedFile.id, uploadFile.thumb, null, null, app.globalData.sessionKey).then(function (uploadThumbFile) {
          //image.id = uploadThumbFile.id
          image.thumb = 'https://snowmeet.wanlonghuaxue.com' + uploadThumbFile.thumbUrl
          image.status = 'success'
          image.message = ''
          //that.setData({images})
          //var order = that.data.order
          order.retailImages = images
          that.setData({order})
          //that.triggerEvent('SyncRetailOrder', order)
        })}, 1000)
      })
  },

})
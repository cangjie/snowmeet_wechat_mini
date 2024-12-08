// pages/admin/ski_pass/nanshan_reserve_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    showCard: false,
    imgUrl:''
  },

  getSkiPass(id){
    var that = this
    var productReserveList = that.data.productReserveList
    var memberList = productReserveList.memberList
    var skipass = undefined
    for(var i = 0; i < memberList.length; i++){
      var skiPasses = memberList[i].skiPasses
      for (var j = 0; j < skiPasses.length; j++){
        if (skiPasses[j].id == id){
          skipass = skiPasses[j]
          break
        }
      }
      if (skipass != undefined){
        break
      }
    }
    return skipass
  },

  setEdit(e){
    var that = this
    var id = e.currentTarget.id
    var skipass = that.getSkiPass(id)
    if (!skipass){
      return
    }
    skipass.status = 'edit'
    var productReserveList = that.data.productReserveList
    that.setData({productReserveList})
  },

  setCardNo(e){
    var that = this
    var id = e.currentTarget.id
    var skipass = that.getSkiPass(id)
    if (!skipass.card_no_filled){
      skipass.status = ''
      var productReserveList = that.data.productReserveList
      that.setData({productReserveList})
    }
    else{
      wx.showModal({
        title: '确认修改雪票卡号？',
        content: '新卡号：' + skipass.card_no_filled,
        complete: (res) => {
          if (res.cancel) {
            skipass.card_no_filled = undefined
            skipass.status = ''
          }
      
          if (res.confirm) {
            skipass.card_no = skipass.card_no_filled
            skipass.card_no_filled = undefined
            that.updateSkipass(skipass)
            
            
          }
        }
      })
      
    }
    
  },

  getData(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/GetReserveProductDetail/255?reserveDate=2024-12-08&sessionKey=fq4lJZZkw1yRISEnJgH67Q%3D%3D'
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var productReserveList = res.data
        productReserveList.reserveDateStr = util.formatDate(new Date(productReserveList.reserveDate))
        console.log('productReserveList', productReserveList)
        that.setData({productReserveList})
      }
    })
  },

  uploadCard(id, filePath){
    var that = this
    var skipass = that.getSkiPass(id)
    var purpose = skipass.contant_name + '_' + util.formatDate(new Date(skipass.reserve_date)) + '_' + skipass.product_name
    purpose = encodeURIComponent(purpose)
    var uploadUrl = 'https://' + app.globalData.uploadDomain + '/core/UploadFile/SnowmeetFileUpload?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '?purpose=' + encodeURIComponent(purpose) 
    wx.uploadFile({
      filePath: filePath,
      name: 'file',
      url: uploadUrl,
      success: (res)=>{
        console.log('upload card image', res)
        if (res.statusCode != 200){
          return
        }
        var fileName = res.data
        if (!fileName){
          wx.showToast({
            icon: 'error',
            title: '图片上传失败'
          })
          return
        }
        skipass.card_image_url = fileName
        that.updateSkipass(skipass)
        //var updateUrl = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/'

      }
    })
  },

  updateSkipass(skipass){
    var that = this
    var modUrl = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/UpdateSkiPass?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: modUrl,
      method: 'POST',
      data: skipass,
      success:(res)=>{
        if (res.statusCode != 200){
          if (res.statusCode == 204){
            wx.showToast({
              title: '卡号重复',
              icon: 'error',
            })
            return
          }
          wx.showToast({
            title: '更新失败',
            icon: 'error',
          })
          return
        }
        skipass.status = undefined
        var productReserveList = that.data.productReserveList
        that.setData({productReserveList})
        console.log('ski pass updated', res)
      }
    })
  },

  ocrCard(id, filePath){
    var that = this
    var skipass = that.getSkiPass(id)
    var fs = wx.getFileSystemManager()
    //var path = res.tempImagePath
    fs.readFile({
      filePath: filePath,
      encoding: 'base64',
      success:(res)=>{
        console.log('read file', res)
        var base64Content = res.data
        if (!base64Content)
        {
          return
        }
        var ocrUrl = 'https://' + app.globalData.domainName + '/core/Ocr/GeneralBasicOcr?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: ocrUrl,
          method: 'POST',
          data: base64Content,
          success:(res)=>{
            console.log('ocr result', res)
            var cardNo = undefined
            var ocrArr = res.data
            for(var i = 0; i < ocrArr.length; i++){
              var str = ocrArr[i].trim()
              if (str.indexOf('N') == 0){
                str = str.replace('。','.')
                try{
                  cardNo = str.split('.')[1].trim()
                }
                catch{

                }
              }
            }
            if (!cardNo){
              return
            }
            skipass.card_no_filled = cardNo
            var productReserveList = that.data.productReserveList
            that.setData({productReserveList})
          }
        })
      }
    })
  },

  ocr(e){
    var that = this
    var id = e.currentTarget.id
    var skipass = that.getSkiPass(id)
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType:['camera'],
      camera: ['back'],
      sizeType:['original'],
      success:(res)=>{
        console.log('take photo', res)
        var path = res.tempFiles[0].tempFilePath
        that.uploadCard(id, path)
        that.ocrCard(id, path)
        skipass.status = 'edit'
        var productReserveList = that.data.productReserveList
        that.setData({productReserveList})
      }
    })
    
  },
  inputCardNo(e){
    var that = this
    var id = e.currentTarget.id
    var value = e.detail.value
    var skipass = that.getSkiPass(id)
    skipass.card_no_filled = value
    var productReserveList = that.data.productReserveList
    that.setData({productReserveList}) 

  },
  showCard(e){
    var that = this
    var id = e.currentTarget.id
    var skipass = that.getSkiPass(id)
    if (skipass.card_image_url){
      var img = 'https://' + app.globalData.uploadDomain + skipass.card_image_url
      that.setData({showCard: true, imgUrl: img})
    }
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.getData()
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
    //var that = this
    //that.getData()
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

  }
})
// pages/test/ocr/ocr.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    openCamera: false
  },
  openCam(){
    this.setData({openCamera: true})
  },
  takePhoto() {
    const ctx = wx.createCameraContext()
    ctx.takePhoto({
      quality: 'high',
      success: (res) => {
        console.log('photo path', res)
        var fs = wx.getFileSystemManager()
        var path = res.tempImagePath
        this.setData({
          src: res.tempImagePath
        })
        fs.readFile({
          filePath: path,
          encoding: 'base64',
          success:(res)=>{
            console.log('read file', res)
          }
        })
        
      }
    })
  },

  chooseFile(){
    wx.chooseMedia({
      mediaType:['image'],
      count: 1,
      sizeType:['original'],
      success:(res)=>{
        console.log('choose media', res)
        var path = res.tempFiles[0].tempFilePath
        var fs = wx.getFileSystemManager()
        fs.readFile({
          filePath: path,
          encoding: 'base64',
          success:(res)=>{
            console.log('read file', res)
            var url = 'https://' + app.globalData.domainName + '/core/Ocr/GeneralBasicOCR?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
            wx.request({
              url: url,
              method: 'POST',
              data: res.data,
              success:(res)=>{
                console.log('ocr result', res)
              }
            })
          }
        })
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {

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
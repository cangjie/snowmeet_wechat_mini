// pages/test/upload/upload.js
var wxloginModule = require('../../../utils/wxlogin.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    files:[],

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    wxloginModule.wxlogin()
    this.setData({
      selectFile: this.selectFile.bind(this),
      uploadFile: this.uploadFile.bind(this)
    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  },
  selectFile(files) {
    console.log('files', files)
    // 返回false可以阻止某次文件上传
  },
  uploadFile(files) {
    console.log('upload files', files)
    var uploadUrl = 'https://' + app.globalData.domainName + '/upload.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    // 文件上传的函数，返回一个promise
    return new Promise((resolve, reject) => {
      for(var i = 0; i < files.tempFilePaths.length; i++)
      {
        
        wx.uploadFile({
          filePath: files.tempFilePaths[i],
          name: 'name',
          url: uploadUrl,
          success: (res)=>{
            var filesData = this.data.files
            //var filesData = [{url: 'http://mini.luqinwenda.com/upload/1596954732.jpg'}]
            var uploadFilesData = res.data.split(',')
            for(var i = 0; i < uploadFilesData.length; i++) {
              filesData.push({url: 'https://' + app.globalData.domainName + uploadFilesData[i]})
            }
            this.setData({files: filesData})
            console.log(res)
          },
          fail: (res)=>{
            console.log(res)
          }
        })
      }
    })
  }

})
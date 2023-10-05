// pages/test/upload/upload.js
var wxloginModule = require('../../../utils/wxlogin.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    files:[],
    buttons: [{text: '取消'}, {text: '确定'}],
    dialogShow: false,
    uploadFileArray:[],
    stepId:['2'],
    uploadIndex:0,
    fileArray:[]
  },
  selectFile: function(files) {
    console.log('files', files)
    return true
    // 返回false可以阻止某次文件上传
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    wxloginModule.wxlogin()
    var fileArray = [this.data.stepId.length]
    var uploadFileArray = [this.data.stepId.length]
    for(var i = 0; i < this.data.stepId.length; i++) {
      fileArray[i] = []
      uploadFileArray[i] = {stepId: this.data.stepId[i], files: []}
    }
    this.setData({
      selectFile: this.selectFile.bind(this),
      uploadFile: this.uploadFile.bind(this),
      currentStepId: this.data.stepId[this.data.uploadIndex],
      fileArray: fileArray,
      uploadFileArray: uploadFileArray
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
    this.setData({
      selectFile: this.selectFile.bind(this),
      uploadFile: this.uploadFile.bind(this)
    })
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
    return true
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
  },
  uploadSuccess: function(res) {
    var detail = res.detail
  },
  uploadError: function(res){
    var detail = res.detail
  },
  clickUpload: function(res) {
    var detail = res.detail
    this.setData({dialogShow: true})
  },
  tapUpload: function(res) {
    var target = res.currentTarget
    var id = target.id.split('-')[1].trim()
    var files = []
    var uploadFileArray = this.data.uploadFileArray
    for(var i = 0; i < uploadFileArray.length; i++) {
      if (uploadFileArray[i].stepId == id) {
        files = uploadFileArray[i].files
        break;
      }
    }
    this.setData({currentStepId: id, dialogShow: true, files: files})
  },
  tapDialogButton: function(res) {
    var detail = res.detail
    if (detail.item.text == '取消') {
      this.setData({files: [], dialogShow: false})
    }
    else {
      var uploadFileArray = this.data.uploadFileArray
      for(var i = 0; i < uploadFileArray.length; i++){
        if (uploadFileArray[i].stepId == this.data.currentStepId) {
          uploadFileArray[i].files = this.data.files
          break
        }
      }
      this.setData({uploadFileArray: uploadFileArray, dialogShow: false})
    }
    
  },
  uploaded: function(res) {
    var detail = res.detail
  }

})
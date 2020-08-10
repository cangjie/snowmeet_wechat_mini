// pages/admin/equip_maintain/uploadimage/uploadimage.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    tabbarItemList: [],
    tabIndex: 2,
    files:[]
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    this.setData({tabbarItemList: app.globalData.adminTabbarItem})
    this.setData({
      selectFile: this.selectFile.bind(this),
      uplaodFile: this.uplaodFile.bind(this)
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
  choseImage: function(e) {
    var that = this;
        wx.chooseImage({
            sizeType: ['original', 'compressed'], // 可以指定是原图还是压缩图，默认二者都有
            sourceType: ['album', 'camera'], // 可以指定来源是相册还是相机，默认二者都有
            success: function (res) {
                // 返回选定照片的本地文件路径列表，tempFilePath可以作为img标签的src属性显示图片
                that.setData({
                    files: that.data.files.concat(res.tempFilePaths)
                });
            }
        })
  },
  uplaodFile(files) {
    console.log('upload files', files)
    // 文件上传的函数，返回一个promise
    return new Promise((resolve, reject) => {
      for(var i = 0; i < files.tempFilePaths.length; i++)
      {
        wx.uploadFile({
          filePath: files.tempFilePaths[i],
          name: 'name',
          url: 'https://mini.luqinwenda.com/upload.aspx',
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
  selectFile(files) {
    console.log('files', files)
    // 返回false可以阻止某次文件上传
  },
  uploadSuccess(e) {
    console.log('upload success', e.detail)
  },
  uploadError(e) {
    console.log('upload error', e.detail)
  }
})
// pages/test/upload/choose_video_upload.js
Page({

  /**
   * Page initial data
   */
  data: {

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {

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
  upload: function() {
    wx.chooseMedia({
      count: 1,
      maxDuration: 60,
      sourceType:['album'],
      sizeType:['compressed'],
      mediaType:['image', 'video'],
      success: (res) => {


        const ab = new ArrayBuffer(1024*1024*100)

        const mgr = wx.getFileSystemManager();

        var uploadedFile = res.tempFiles[0]

        const fd = mgr.openSync({filePath: uploadedFile.tempFilePath, flag: 'r'})

        const r = mgr.read({
          fd: fd, 
          arrayBuffer: ab, 
          length: 10,
          success: (res) => {
            console.log(res)
          },
          fail: (res) => {
            console.log(res)
          }})

        console.log(r)

        //const content = mgr.readFileSync(uploadedFile.tempFilePath, 'base64', 0)
        
        //console.log(content)
        /*  
        mgr.readFile({
          filePath: uploadedFile.tempFilePath,
          encoding: 'base64',
          position: 0,
          success: (res) => {
            console.log(res)
          }
        })
        */
      }
    })
  }
})
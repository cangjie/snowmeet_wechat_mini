// pages/admin/equip_maintain/in_shop_order_quick/in_shop_order_quick_detail.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    filledInfo: false,
    canSubmit: false,
    cell: '',
    realName: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    this.data.id = options.id
    var that = this
    app.loginPromiseNew.then(function(resolve){
      var getInfoUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_get.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&id=' + that.data.id
      wx.request({
        url: getInfoUrl,
        success:(res) => {
          if (res.data.status == 0) {
            that.setData({role: app.globalData.role, order: res.data.maintain_in_shop_request, photoFiles: res.data.maintain_in_shop_request.confirmed_images})
          }
        }
      })
      
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
  uploaded: function(e) {
    var filesStr = ''
    for(var i = 0; i < e.detail.files.length; i++) {
      filesStr = filesStr + ((i>0)?',':'') + e.detail.files[i].url
    }
    this.data.uploadedFile = filesStr
  },
  submit: function() {
    var updateContactInfoUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_modify.aspx?id=' + this.data.id + '&sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    var submitData = {}
    submitData.confirmed_cell = this.data.cell
    submitData.confirmed_name = this.data.realName
    submitData.confirmed_images = this.data.uploadedFile
    wx.request({
      url: updateContactInfoUrl,
      method: 'POST',
      data: submitData,
      success: (res) => {
        this.setData({filledInfo: true})
      }
    })
  },
  inputText: function(e){
    var id = e.currentTarget.id
    switch(id) {
      case 'realName':
        this.data.realName = e.detail.value
        break
      case 'cell':
        this.data.cell = e.detail.value
        break
      default:
        break
    }
    if (this.data.cell != '' && this.data.realName != '') {
      this.setData({canSubmit: true})
    }
    else {
      this.setData({canSubmit: false})
    }
  }
})
// pages/register/staff_check_in.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    realName: '',
    cell: '',
    disabled : true
  },
  setCell(e){
    var that = this
    var cell = e.detail.value
    var disabled = true
    if (cell.length == 11 && that.data.realName != ''){
      disabled = false
    }
    that.setData({cell: e.detail.value, disabled: disabled})
  },
  confirm(){
    var that = this
    that.setData({disabled: true})
    var confirmUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/StaffCheckIn/' + that.data.cell + '?name=' + encodeURIComponent(that.data.realName) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: confirmUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        wx.showToast({
          title: '你已经成为管理员。',
          icon: 'success'
        })
        wx.reLaunch({
          url: '/pages/admin/admin',
        })
       
      }
    }) 
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resovle){

      var getUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/GetNewStaffName?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          that.setData({realName: res.data})
        }
      })
      
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
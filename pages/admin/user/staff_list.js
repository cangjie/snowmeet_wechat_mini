// pages/admin/user/staff_list.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    staffList:[]
  },
  setStaff(e){
    console.log('switch', e)
    var that = this
    var id = e.currentTarget.id
    var staff = e.detail.value
    var setUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/SetStaff?openId=' + encodeURIComponent(id) + '&isStaff=' + e.detail.value + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
      },
      complete:(res)=>{
        var that = this
        that.getStaffList()
      }
    })

  },
  query(){
    var that = this
    var getUrl = 'https://' +  app.globalData.domainName + '/core/MiniAppUser/GetUserByCell/' + that.data.cell + '?staffSessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success: (res) =>{
        if (res.statusCode != 200){
          wx.showToast({
            title: '未找到用户',
            icon: 'error'
          })
          return
        }
        var staffList = that.data.staffList
        var newStaffList = []
        newStaffList.push(res.data)
        for(var i = 0; i < staffList.length; i++){
          newStaffList.push(staffList[i])
        }
        that.setData({staffList: newStaffList})
      }
    })
  },

  getStaffList(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/GetStaffList?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success: (res)=>{
        if (res.statusCode != 200){
          return
        }
        var staffList = res.data
        that.setData({staffList: staffList})
      }
    })
  },
  setInput(e){
    var that = this
    var cell = e.detail.value
    that.setData({cell: cell})
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resovle){
      that.getStaffList()
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
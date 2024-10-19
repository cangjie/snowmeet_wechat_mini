// pages/admin/staff/staff_list.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    cell: ''
  },
  jumpDetail(e){
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'staff_detail?memberId=' + id.toString(),
    })
  },
  setInput(e){
    var that = this
    that.setData({cell: e.detail.value})
  },
  query(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/Member/GetMemberByCell/' + that.data.cell + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        console.log('get member', res)
        if (res.statusCode != 200){
          wx.showToast({
            title: '未找到用户',
            icon: 'error'
          })
          return
        }
        var member = res.data
        wx.navigateTo({
          url: 'staff_detail?memberId=' + member.id,
        })
      }
    })
  },
  getData(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/Member/GetStaffList?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        console.log('get staff list', res)
        if (res.statusCode != 200){
          return
        }
        var members = res.data
        that.setData({members})
      }
    })
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
    var that = this
    app.loginPromiseNew.then(function(resolve){
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

  }
})
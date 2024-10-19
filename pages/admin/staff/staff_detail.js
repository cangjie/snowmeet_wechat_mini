// pages/admin/staff/staff_detail.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {

  },

  submit(){
    var that = this
    var member = that.data.member
    var url = 'https://' + app.globalData.domainName + '/core/Member/SetStaffInfo/' + that.data.memberId.toString() + '?name=' + encodeURIComponent(member.real_name) + '&gender=' + encodeURIComponent(member.gender) + '&cell=' + member.cell + '&isAdmin=' + member.is_admin + '&isManager=' + member.is_manager + '&isStaff=' + member.is_staff + '&inStaffList=1&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        console.log('member info update', res)

      }
    })
  },

  getData(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/Member/GetWholeMemberInfo/' + that.data.memberId.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        console.log('get member', res)
        var member = res.data
        member.have_mod_cell = false
        that.setData({member})
      }
    })
  },

  modInfo(e){
    console.log('mod info', e)
    var id = e.currentTarget.id
    var that = this
    var member = that.data.member
    switch(id){
      case 'name':
        member.real_name = e.detail.value
        break
      case 'gender':
        member.gender = e.detail.value
        break
      case 'cell':
        member.cell = e.detail.value
        member.have_mod_cell = true
        break
      case 'admin':
        if (e.detail.value){
          member.is_admin = 1
        }
        else{
          member.is_admin = 0
        }
        break
      case 'manager':
        if (e.detail.value){
          member.is_manager = 1
        }
        else{
          member.is_manager = 0
        }
        break
      case 'staff':
        if (e.detail.value){
          member.is_staff = 1
        }
        else{
          member.is_staff = 0
        }
        break
      default:
        break
    }
    that.setData({member})
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var memberId = options.memberId
    var that = this
    that.setData({memberId})
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
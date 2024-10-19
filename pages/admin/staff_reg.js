// pages/admin/staff_reg.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    name: '',
    gender: ''
  },
  setName(e){
    var that = this
    that.setData({name: e.detail.value})
  },
  setGender(e){
    var that = this
    console.log('gender', e)
    that.setData({gender: e.detail.value})
  },

  submit(e){
    var that = this
    var name = that.data.name
    var gender = that.data.gender
    if (name == ''){
      wx.showToast({
        title: '请填写姓名。',
        icon: 'error'
      })
      return
    }
    if(gender == ''){
      wx.showToast({
        title: '请选择性别',
        icon: 'error'
      })
      return
    }
    var enc = e.detail.encryptedData
    var iv = e.detail.iv
    var updateUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/UpdateWechatMemberCell?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&encData=' + encodeURIComponent(enc) + '&iv=' + encodeURIComponent(iv)
    wx.request({
      url: updateUrl,
      method: 'GET',
      success:(res)=>{
        console.log('update cell', res)
        if (res.statusCode != 200){
          return
        }
        var regUrl = 'https://' + app.globalData.domainName + '/core/Member/RegStaff?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&name=' + encodeURIComponent(name) + '&gender=' + encodeURIComponent(gender)
        wx.request({
          url: regUrl,
          method: 'GET',
          success:(res)=>{
            console.log('update member', res)
            if (res.statusCode != 200){
              return
            }
            wx.redirectTo({
              url: 'admin',
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
    app.loginPromiseNew.then(function(resovle){
      if (app.globalData.memberInfo.in_staff_list){
        wx.showToast({
          title: '您已经完成注册，请联系管理员添加权限。',
          icon:'success',
          duration: 3000,
          success:()=>{
            wx.redirectTo({
              url: 'admin',
            })
          }
        })
      }
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
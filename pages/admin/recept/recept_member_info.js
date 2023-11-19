// pages/admin/recept/recept_member_info.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    needUpdate: false,
    score: 0,
    totalScore: 0,
    shop: '',
    valid: false
  },

  userInfoUpdate(e){
    console.log('user info update', e)
    var that = this
    var userInfo = e.detail.user_info
    var valid = that.data.valid
    if (userInfo.gender == undefined || userInfo.gender == '' || userInfo.real_name == undefined || userInfo.real_name == ''){
      valid = false
    }
    else{
      valid = true
    }
    that.setData({needUpdate: true, userInfo: userInfo, valid: valid})
    that.updateUserInfo()
  },

  updateUserInfo(){
    var that = this
    var updateUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/UpdateMiniUser?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method: 'POST',
      data: that.data.userInfo,
      success:(res)=>{
        console.log('mini user info update', res)
        if (res.statusCode != 200){
          return;
        }
        wx.showToast({
          title: '更新成功。',
          icon: 'success'
        })
      }
    })
  },

  getScore(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/Point/GetUserPointsSummary?openId=' + that.data.openId + '&openIdType=snowmeet_mini'
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200) {
          return
        }
        that.setData({score: res.data})
        getUrl = 'https://' + app.globalData.domainName + '/core/Point/GetUserPointsTotalEarned?openId=' + that.data.openId + '&openIdType=snowmeet_mini'
        wx.request({
          url: getUrl,
          method: 'GET',
          success:(res)=>{
            if (res.statusCode != 200){
              return
            }
            that.setData({totalScore: res.data})
          }
        })
      }
    })
  },

  shopSelected(e){
    console.log('shop selected', e)
    var that = this
    that.setData({shop: e.detail.shop})
  },

  gotoFlow(e){
    var that = this
    var id = e.currentTarget.id
    var scene = ''
    switch(id)
    {
      case 'sale':
        scene = '店销现货'
        break
      case 'rent':
        scene = '租赁下单'
        break
      case 'maintain':
        scene = '养护下单'
        break
      default:
        break

    }
    var newReceptUrl = 'https://' + app.globalData.domainName + '/core/Recept/NewRecept?openId=' + encodeURIComponent(that.data.openId) 
    + '&scene=' + encodeURIComponent(scene) + '&shop=' + encodeURIComponent(that.data.shop) 
    + ((that.data.ticketCode != undefined)? ('&code=' + that.data.ticketCode) : '') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    console.log('new recept url', newReceptUrl)
    wx.request({
      url: newReceptUrl,
      method: 'GET',
      success:(res)=>{
        console.log('new recept', e)
        if (res.statusCode != 200){
          wx.showToast({
            title: '系统故障',
            icon:'error'
          })
          return
        }
        wx.redirectTo({ 
          url: 'recept?id=' + res.data.id,
        })
      }
    })
   
  },

  selectTicket(e){
    console.log('select ticket', e)
    var code = e.detail.code
    var that = this
    that.setData({ticketCode: code})
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    if (options.openId != undefined){
      that.setData({openId: options.openId})
    }
    if (options.code != undefined){
      that.setData({code: options.code})
    }
    that.getScore()
  },

  onShow(){
    var that = this
    that.getScore()
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
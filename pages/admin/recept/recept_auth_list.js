// pages/admin/recept/recept_auth_list.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    isManager: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {

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
    app.loginPromiseNew.then(function (resolve){
      if (app.globalData.staff.title_level >= 200){
        that.setData({isManager: true})
        that.getData()
      }
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

  },
  getData(){
    var that = this
    var getUrl = app.globalData.requestPrefix + 'QrCode/GetTodayAuthCellList?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    util.performWebRequest(getUrl, null).then(function (resolve){
      console.log('cell to auth', resolve)
      var authList = resolve
      for(var i = 0; i < authList.length; i++){
        var auth = authList[i]
        var subTime = new Date(auth.submitTime)
        auth.submitTimeDateStr = util.formatDate(subTime)
        auth.submitTimeTimeStr = util.formatTimeStr(subTime)
      }
      that.setData({authList})
    }).catch(function (reject){
    })
  },
  giveAuth(e){
    var that = this
    var para = e
    wx.showModal({
      title: '授权确认',
      content: '确认授权后，今天结束之前，可以直接输入手机号免扫码开单。',
      confirmText: '授权',
      cancelText: '拒绝',
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          that.auth(para)
        }
      }
    })
  },
  auth(e){
    var that = this
    var id = e.currentTarget.id
    var authUrl = app.globalData.requestPrefix + 'QrCode/GiveAuth/' + id.toString() + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(authUrl, null).then(function (resolve){
      console.log('auth result', resolve)
      var auth = resolve
      var title = '授权成功'
      var icon = 'success'
      if (auth.authed != 1){
        title = '授权失败'
        icon = 'error'
      }
      wx.showToast({
        title: title,
        icon: icon
      })
      that.getData()
    }).catch(function(reject){

    })
  },
  auth1(e){
    var that = this
    var id = e.currentTarget.id
    var authUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/Auth/' + id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: authUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        wx.showToast({
          title: '授权成功',
          icon: 'success',
          duration: 5000
        })
        that.getData()
      }
    })
  }
})
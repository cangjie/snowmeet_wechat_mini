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
      if (app.globalData.memberInfo.is_admin == 1 || app.globalData.memberInfo.is_manager == 1){
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
    var getUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetAuthList?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var authList = res.data
        for(var i = 0; i < authList.length; i++){
          var a = authList[i]
          var cDate = new Date(a.create_date)
          a.create_dateStr = util.formatDate(cDate)
          a.create_timeStr = util.formatTimeStr(cDate)

        }
        that.setData({authList})
        console.log('auth list', res)
      }
    })
  },
  auth(e){
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
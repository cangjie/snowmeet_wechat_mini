// pages/admin/admin.js
const app = getApp()
function init(that) {
  var role = app.globalData.role
  var isSchoolStaff = false
  var ajaxUrl = 'https://' + app.globalData.domainName + '/core/schoolstaff?sessionkey=' +  encodeURIComponent(app.globalData.sessionKey)
  wx.request({
    url: ajaxUrl,
    method: 'GET',
    success: (res) => {
      if (res.data.status == undefined) {
        that.setData({isSchoolStaff: true})
      }
    },
    fail: (res) => {

    }
  })
  that.setData({role: app.globalData.role})
  
}
Page({

  /**
   * Page initial data
   */
  data: {
    role: '',
    isSchoolStaff: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    if (app.globalData.sessionKey == null || app.globalData.sessionKey == '') {
      var that = this
      app.loginPromiseNew.then(function(resolve) {
        init(that)
      })
    }
    else {
      init(this)
    }
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
  gotoScan: function(){
    wx.navigateTo({
      url: 'scan/scan',
    })
  },
  gotoInShopOrderConfirm: function() {
    wx.navigateTo({
      url: './equip_maintain/in_shop_order_confirm/in_shop_order_confirm',
    })
  },
  goToMaintainInShopQuick: function() {
    wx.navigateTo({
      url: './equip_maintain/on_site/recept',
    })
  },
  goToMaintainInShopList: function() {
    wx.navigateTo({
      url: './equip_maintain/on_site/recept_list',
    })
  },
  goToMaintainInShopQuickBatch: function(){
    wx.navigateTo({
      url: './equip_maintain/on_site/recept_batch',
    })
  },
  nav: function(e) {
    var path = '/pages/index/index'
    var id = e.currentTarget.id
    switch(id) {
      case 'expierence_admit':
        path = '/pages/admin/expierence/expierence_admit'
        break
      case 'expierence_active_list':
        path = '/pages/admin/expierence/expierence_active_list'
        break
      case 'test_upload':
        path = '/pages/test/upload/choose_video_upload'
        break
      case 'reserve_instructor':
        path = '/pages/admin/school/lesson/detail_info'
        break
      case 'reserve_instructor_list':
        path = '/pages/admin/school/lesson/lesson_list'
        break
      default:
        break
    }
    wx.navigateTo({
      url: path
    })
  }
})
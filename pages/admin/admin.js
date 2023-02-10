// pages/admin/admin.js
const app = getApp()
function init(that) {
  var role = app.globalData.role
  var isSchoolStaff = false
  /*
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
  */
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
    /*
    wx.navigateTo({
      url: '/pages/admin/maintain/order_list',
    })
    */
   wx.navigateTo({
     url: '/pages/admin/maintain/task_list',
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
      case 'ticket_print':
        path = '/pages/admin/ticket/ticket_template_list'
        break
      case 'rend_admit':
        path = 'rent/rent_admit_new'
        break
      case 'rent_list':
        path = 'rent/rent_list'
        break
      case 'rent_report':
        path = 'rent/rent_report'
        break
      default:
        break
    }
    wx.navigateTo({
      url: path
    })
  },
  gotoSummerMaintain: function(e) {
    switch(e.currentTarget.id){
      case 'SummerMaintainRecept':
        wx.navigateTo({
          url: '/pages/admin/equip_maintain/summer/summer_recept',
        })
        break
      case 'SummerMaintainList':
        wx.navigateTo({
          url: '/pages/admin/equip_maintain/summer/summer_list',
        })
        break 
      default:
        break
    }
  },
  gotoSale:(e)=>{
    var navUrl = ''
    switch(e.currentTarget.id){
      case "shopSale":
        navUrl = 'sale/shop_sale_entry'
        break
      case "shopSaleList":
        navUrl = 'sale/order_list'
        break
      default:
        break
    }
    wx.navigateTo({
      url: navUrl,
    })
  },
  goToMaintainRecept(){
    wx.redirectTo({
      url: '/pages/admin/maintain/recept',
    })
  },
  gotoBackground(){
    wx.scanCode({
      onlyFromCamera: true,
      success:(res)=>{
        console.log(res)
        var timeStamp = res.result
        var setSessionUrl = 'https://' + app.globalData.domainName + '/core/BackgroundLoginSession/SetSessionKey/' + timeStamp + '?sessionKey=' + app.globalData.sessionKey
        wx.request({
          url: setSessionUrl,
          method: 'GET',
          success:(res)=>{
            console.log(res)
          }
        })
      }
    })
  }
})
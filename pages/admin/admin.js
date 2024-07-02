// pages/admin/admin.js
const app = getApp()
function init(that) {
  var role = app.globalData.role
  var isSchoolStaff = false
  var isManager = false
  var isAdmin = false
  if (app.globalData.is_manager){
    isManager = true
  }
  if (app.globalData.memberInfo != undefined && app.globalData.memberInfo != null){
    var member = app.globalData.memberInfo
    if (member.is_staff == 1){
      role = 'staff'
    }
    if (member.is_manager == 1){
      isManager = true
    }
    if (member.is_admin == 1){
      isAdmin = true
    }
  }
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
  that.setData({role: app.globalData.role, isManager: isManager, isAdmin: isAdmin})
  
}
Page({

  /**
   * Page initial data
   */
  data: {
    role: '',
    isSchoolStaff: false,
    isManager: true,
    isAdmin: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {

    var that = this
    app.loginPromiseNew.then(function(resolve) {
      init(that)
    })

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
      case 'rent_list_cell':
        path = 'rent/rent_list_by_cell'
        break
      case 'test':
        path = '/pages/admin/recept/customer_identity'
        break 
      case'utv_race_list':
        path = '/pages/admin/utv/trip_list'
        break 
      case 'utv_reserve_list':
        path = '/pages/admin/utv/reserve_list'
        break
      case 'recept':
        path = '/pages/admin/recept/recept_entry'
        break
      case 'recept_list':
        path = '/pages/admin/recept/recept_list'
        break
      case 'vip_maintain':
        path = '/pages/admin/vip/maintain_recept'
        break
      case 'staff_list':
        path = '/pages/admin/user/staff_list'
        break
      case 'maintain_return':
        path = '/pages/admin/maintain/return_entry'
        break
      case 'rent_unreturned':
        path = '/pages/admin/rent/unreturned'
        break
      case 'maintain_in_stock':
        path = '/pages/admin/maintain/maintain_in_stock'
        break
      case 'category_tree':
        path = '/pages/admin/rent/settings/category_tree'
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
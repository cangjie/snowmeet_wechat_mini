var __L = require('../../legacy_app.js') // legacy-demo：旧版演示的独立 App
// pages/admin/admin.js
const app = __L
function init(that) {
  var role = app.globalData.role
  var isSchoolStaff = false
  var isManager = false
  var isAdmin = false
  var isStaff = false
  if (app.globalData.is_manager){
    isManager = true
  }
  if (app.globalData.staff){
    role = 'staff'
    var staff = app.globalData.staff
    if (staff.title_level <= 100){
      isStaff = true
    }
    else if (staff.title_level <= 200){
      isManager = true
    }
    else {
      isAdmin = true
    }
  }
  that.setData({role: role, isManager: isManager, isAdmin: isAdmin})
}
__L.Page({

  /**
   * Page initial data
   */
  data: {
    role: '',
    isSchoolStaff: false,
    isManager: true,
    isAdmin: false,
    
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {

    var that = this
    app.loginPromiseNew.then(function(resolve) {
      init(that)
      that.setData({env: app.globalData.env, scene: app.globalData.scene})
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
      url: '/legacy/pages/admin/maintain/order_list',
    })
    */
   wx.navigateTo({
     url: '/legacy/pages/admin/maintain/task_list',
   })
  },
  goToMaintainInShopQuickBatch: function(){
    wx.navigateTo({
      url: './equip_maintain/on_site/recept_batch',
    })
  },
  nav: function(e) {
    var path = '/legacy/pages/index/index'
    var id = e.currentTarget.id
    switch(id) {
      case 'expierence_admit':
        path = '/legacy/pages/admin/expierence/expierence_admit'
        break
      case 'expierence_active_list':
        path = '/legacy/pages/admin/expierence/expierence_active_list'
        break
      case 'test_upload':
        path = '/legacy/pages/test/upload/choose_video_upload'
        break
      case 'reserve_instructor':
        path = '/legacy/pages/admin/school/lesson/detail_info'
        break
      case 'reserve_instructor_list':
        path = '/legacy/pages/admin/school/lesson/lesson_list'
        break
      case 'ticket_print':
        path = '/legacy/pages/admin/ticket/ticket_template_list'
        break
      case 'rent_list':
        path = 'rent/new_rent_list'
        break
      case 'rent_report':
        path = 'rent/rent_report'
        break
      case 'rent_list_cell':
        //path = 'rent/rent_list_by_cell'
        path = 'fire/fire_care_list?bizType=rent'
        break
      case 'test':
        path = '/legacy/pages/admin/recept/customer_identity'
        break 
      case'utv_race_list':
        path = '/legacy/pages/admin/utv/trip_list'
        break 
      case 'utv_reserve_list':
        path = '/legacy/pages/admin/utv/reserve_list'
        break
      case 'recept':
        path = '/legacy/pages/admin/recept/recept_entry'
        break
      case 'recept_list':
        path = '/legacy/pages/admin/recept/recept_list'
        break
      case 'vip_maintain':
        path = '/legacy/pages/admin/vip/maintain_recept'
        break
      case 'staff_list':
        path = '/legacy/pages/admin/user/staff_list'
        break
        case 'staff_list_new':
          path = '/legacy/pages/admin/staff/staff_list'
          break
      case 'maintain_return':
        path = '/legacy/pages/admin/maintain/return_entry'
        break
      case 'rent_unreturned':
        path = '/legacy/pages/admin/rent/unreturned'
        break
      case 'rent_search_fuzzy':
        path = '/legacy/pages/admin/rent/search_fuzzy'
        break
      case 'maintain_in_stock':
        path = '/legacy/pages/admin/maintain/maintain_in_stock'
        break
      case 'category_tree':
        path = '/legacy/pages/admin/rent/settings/category_tree'
        break
      case 'rent_package':
        //path = '/legacy/pages/admin/rent/settings/rent_package?id=1' 
        path = '/legacy/pages/admin/rent/settings/rent_package_list' 
        break
      case 'rent_product_list':
        path = '/legacy/pages/admin/rent/settings/rent_product_list'
        break
      case 'rent_product_add':
        path = '/legacy/pages/admin/rent/settings/rent_product_add'
        break
      case 'wl_course_reg':
        path = '/legacy/pages/admin/school/course_reg'
        break
      case 'wl_course_list':
        path = '/legacy/pages/admin/school/course_reg_list'
        break
      case 'staff_reg':
        path = '/legacy/pages/admin/staff_reg_qrcode'
        break
      case 'ns_ski_pass_reserve':
        path = '/legacy/pages/admin/ski_pass/nanshan_reserve'
        break
      case 'ns_ski_pass_fee':
        path = '/legacy/pages/admin/ski_pass/nanshan_card_search'
        break
      case 'ns_ski_pass_refund':
        path = '/legacy/pages/admin/ski_pass/nanshan_refund'
        break
      case 'ns_ski_pass_veri':
        path = '/legacy/pages/admin/ski_pass/nanshan_pick_card_scan'
        break
      case 'ziwoyou':
        path = '/legacy/pages/admin/ski_pass/common_skipass_list'
        break
      case 'skipassqr':
        path = '/legacy/pages/admin/ski_pass/reserve_qrcode'
        break
      case 'env':
        path = '/legacy/pages/admin/env'
        break
      case 'maintainSerchQuick':
        //path = '/legacy/pages/admin/maintain/search_quick'
        path = '/legacy/pages/admin/fire/fire_care_list?bizType=care'
        break
      case 'ticket_use':
        path = '/legacy/pages/admin/ticket/use_entry'
        break
      case 'ziwoyou_order':
        path = '/legacy/pages/admin/ski_pass/dhhs_skipass_order'
        break
      case 'deposit_list':
        path = '/legacy/pages/admin/deposit/deposit_list'
        break
      case 'deposit_add':
        path = '/legacy/pages/admin/deposit/deposit_charge_search'
        break
      case 'recept_auth':
        path = '/legacy/pages/admin/recept/recept_auth_list'
        break
      case 'deposit_balance':
        path = '/legacy/pages/admin/deposit/deposit_balance'
        break
      case 'enterain_form':
        path = '/legacy/pages/admin/sale/enterain_form'
        break
      case 'supplement':
        path = '/legacy/pages/admin/sale/supplement'
        break
      case 'fd_category':
        path = '/legacy/pages/admin/fd/fd_category'
        break
      case 'fd_add_prod':
        path = '/legacy/pages/admin/fd/fd_add_prod'
        break
      case 'fd_prod_list':
        path = '/legacy/pages/admin/fd/fd_category_prod_list'
        break
      case 'fd_prod_mod':
        path = '/legacy/pages/admin/fd/fd_category_prod_list_mod'
        break
      case 'fd_order_list':
        path = '/legacy/pages/admin/fd/fd_order_list'
        break
      case 'rent_recepting':
        path = '/legacy/pages/admin/recept/rent_recepting_list'
        break
      case 'careOrderList':
        path = '/legacy/pages/admin/care/care_order_list'
        break
      case "unipay":
        path = '/legacy/pages/admin/unipay/unipay'
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
          url: '/legacy/pages/admin/equip_maintain/summer/summer_recept',
        })
        break
      case 'SummerMaintainList':
        wx.navigateTo({
          url: '/legacy/pages/admin/equip_maintain/summer/summer_list',
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
        //navUrl = 'sale/order_list'
        navUrl = 'retail/retail_order_list'
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
      url: '/legacy/pages/admin/maintain/recept',
    })
  },
  reload(){
    wx.redirectTo({
      url: '/legacy/pages/admin/admin',
    })
  },
  gotoBackground(){
    wx.scanCode({
      onlyFromCamera: true,
      success:(res)=>{
        console.log(res)
        var timeStamp = res.result
        var setSessionUrl = app.globalData.requestPrefix + 'BackgroundLoginSession/SetSessionKey/' + timeStamp + '?sessionKey=' + app.globalData.sessionKey
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
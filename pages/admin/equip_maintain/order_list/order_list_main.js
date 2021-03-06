// pages/admin/equip_maintain/order_list/order_list_main.js
var wxloginModule = require('../../../../utils/wxlogin.js')
var md5 = require('../../../../utils/md5.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    waybillNo:'',
    orderId: '',
    canSearchByWaybill:false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    wxloginModule.wxlogin()
    this.setData({tabbarItemList: app.globalData.adminTabbarItem,
    tabIndex: 0})
    /*
    var md5String = md5("appId=wxd678efh567hg6787&nonceStr=5K8264ILTKCH16CQ2502SI8ZNMTM67VS&package=prepay_id=wx2017033010242291fcfe0db70013231072&signType=MD5&timeStamp=1490840662&key=qazwsxedcrfvtgbyhnujmikolp111111")
    console.log(md5String)
    */
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
  goToOrdderlistByWaybill: function() {
    wx.navigateTo({
      url: '/pages/admin/equip_maintain/order_list/order_list_by_waybill/order_list_by_waybill?waybillno=' + this.data.waybillNo,
    })
  },
  goToAssign: function() {
    wx.navigateTo({
      url: '/pages/admin/equip_maintain/order_list/order_detail_assign/order_detail_assign',
    })
  },
  goToSingleOrderDetail: function() {
    wx.navigateTo({
      url: '/pages/admin/equip_maintain/order_list/order_detail/order_detail?id=' + this.data.orderId,
    })
  },

  goToPaymentTest: function() {
    wx.navigateTo({
      url: '/pages/test/pay/pay',
    })
  },

  scanWaybill: function(source) {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        wx.navigateTo({
          url: '/pages/admin/equip_maintain/order_list/order_list_by_waybill/order_list_by_waybill?waybillno=' + res.result
        })
      }
    })
  },
  waybillNoInputChange: function(source) {
    if (source.detail.value.toString().trim() == '' ) {
      this.setData({canSearchByWaybill: false})
    }
    else {
      this.setData({canSearchByWaybill: true, waybillNo: source.detail.value})
    }
  },
  orderIdInput: function(source) {
    this.setData({orderId: source.detail.value})
  },
  gotoAccept: function(source) {
    wx.navigateTo({
      url: '../accept_equip/accept_equip',
    })
  },
  goHome: function(source) {
    wx.navigateTo({
      url: '../../../index/index',
    })
  }
})
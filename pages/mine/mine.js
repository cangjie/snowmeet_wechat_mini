const app = getApp()
var wxloginModule = require('../../utils/wxlogin.js')
Page({

  /**
   * Page initial data
   */
  data: {
    role: '',
    canGetInfo: false,
    tabIndex: 1
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    //wxloginModule.wxlogin()
    
    
      var that = this
      app.loginPromiseNew.then(function(resolve) {
        const env = wx.getAccountInfoSync()
        app.globalData.env = env.miniProgram.envVersion
        switch(app.globalData.env){
          case 'trail':
          case 'develop':
            app.globalData.domainName = app.getDomain()
            break
          default:
            break
        }
        that.setData({tabbarItemList: app.globalData.userTabBarItem, 
          role: app.globalData.role, canGetInfo: true, env: app.globalData.env})
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
  tabSwitch: function(e) {
    wx.redirectTo({
      url: e.detail.item.pagePath
    })
  },
  gotoOrders: function(e) {
    wx.navigateTo({
      url: 'plugin-private://wx34345ae5855f892d/pages/orderList/orderList?tabId=all',
     
    });
  },
  gotoSkipass: function(e) {
    wx.navigateTo({
      url: '/pages/mine/skipass/my_skipass',
    })
  },
  gotoAdmin: function(e) {
    wx.navigateTo({
      url: '/pages/admin/admin',
    })
  },
  gotoTicket: function(){
    wx.navigateTo({
      url: '/pages/mine/ticket/ticket_list',
    })
  },
  gotoSummerMaintain:function(){
    wx.navigateTo({
      url: '/pages/summer_maintain/my_summer_maintain',
    })
  },
  gotoMaintain(){
    wx.navigateTo({
      url: '/pages/mine/maintain/order_list',
    })
  },
  gotoDeposit(){
    wx.navigateTo({
      url: '/pages/mine/deposit/deposit_list',
    })
  },
  nav(e){
    var path = '/pages/index/index'
    var id = e.currentTarget.id
    switch(id) {
      case 'env':
        path = '/pages/admin/env'
      default:
        break
    }
    wx.navigateTo({
      url: path
    })
  }

})
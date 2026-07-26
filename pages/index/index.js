//index.js
//获取应用实例
const app = getApp()
var wxloginModule = require('../../utils/wxlogin.js')
Page({
  data: {
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    tabIndex: 0
  },
  //事件处理函数
  bindViewTap: function() {
    wx.navigateTo({
      url: '../logs/logs'
    })
  },
  onLoad: function (options) {
    //wxloginModule.wxlogin()
    /*
    wx.navigateTo({
      url: '/pages/maintain/in_shop_request/in_shop_request',
    })
    */
    app.loginPromiseNew.then(function(resolve){
      // 首页只是个跳板，所有人（含店员）统一落到次卡销售首页。
      // 原来这里有个「店员自动进后台」的分支，但它跳的是 '/admin/admin' —— app.json 注册的是
      // 'pages/admin/admin'，路径不存在、navigateTo 必然失败，且失败后不会走 else，
      // 结果店员打开小程序就卡在空白首页。店员进后台的入口在「我的 → 我是管理员」（wx:if="{{staff}}"），
      // 不依赖这里，所以直接去掉该分支，不再按身份分流。
      // 雪票选购页 ski_pass_selector 保留、未删除，仍可从底部菜单「预定」进入。
      wx.redirectTo({
        url: '/pages/punchcard/punchcard_shop',
      })
    })
    
    
  },
  onShow: function(e) {
   
    
      
    

    this.setData({tabbarItemList: app.globalData.userTabBarItem, tabIndex: 0})
    


  },
  getUserInfo: function(e) {
    console.log(e)
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  },
  jump: function(e){

    /*
    wx.removeTabBarBadge({
      index: 0
    })
    
    wx.removeTabBarBadge({
      index: 1
    })
    wx.removeTabBarBadge({
      index: 2
    })
    */
    wx.navigateTo({
      url: '/pages/test/tab/tab',
    })
  },
  tabSwitch: function(e) {
    wx.redirectTo({
      url: e.detail.item.pagePath
    })
  },
  officalLoad: function(e){
    
  }
})

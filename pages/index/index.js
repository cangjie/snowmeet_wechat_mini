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
    // 首页只是个跳板：店员从 1000/1010/1089 冷启动进管理员菜单，其余（含主动回首页）去次卡商城。
    // 规则在 app.js 的 routeEntry，同一次入口里店员只自动进一次菜单。
    app.routeEntry({ fromIndex: true })
    
    
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

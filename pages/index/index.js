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
  onLoad: function () {
    //wxloginModule.wxlogin()
    /*
    wx.navigateTo({
      url: '/pages/maintain/in_shop_request/in_shop_request',
    })
    */
    app.loginPromiseNew.then(function(resolve){
      if (app.globalData.jumped == undefined && (app.globalData.is_admin == 1 || app.globalData.is_manager == 1 || app.globalData.is_manager == 1)){
        app.globalData.jumped = true
        wx.navigateTo({
          url: '/admin/admin',
        })
      }
      else{
        wx.redirectTo({
          url: '../ski_pass/ski_pass_selector',
        })
      }
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

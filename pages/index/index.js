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
      if (app.globalData.jumped == undefined && app.globalData.staff){
        app.globalData.jumped = true
        wx.navigateTo({
          url: '/admin/admin',
        })
      }
      else{
        // 首页自动跳转目标：原来是雪票选购页 ski_pass_selector，现改为次卡销售首页
        // punchcard_shop（该页不消费 resort/staffId 参数，故不再拼接）。雪票选购页本身
        // 保留、未删除，仍可通过其它入口访问，只是不再是首页默认跳转目标。
        wx.redirectTo({
          url: '/pages/punchcard/punchcard_shop',
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

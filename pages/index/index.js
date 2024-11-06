//index.js
//获取应用实例
const app = getApp()
var wxloginModule = require('../../utils/wxlogin.js')
Page({
  data: {
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo')
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
        wx.navigateTo({
          url: '../ski_pass/ski_pass_selector',
        })
      }
    })
    
    
  },
  onShow: function(e) {
   
    
      
    

    this.setData({tabbarItemList: app.globalData.userTabBarItem, tabIndex: 0})
    var url = 'https://' + app.globalData.domainName + '/mini_shop_products_list_get.htm'
    wx.request({
      url: url,
      success: (res) => {
        if (res.data.errcode==0){
          var productsPairListArray = []
          var pair = []
          for(var i = 0; i < res.data.spus.length; i++) {
            if (i % 2 == 0) {
              pair = []
            }
            pair.push(res.data.spus[i])
            if (i % 2 == 1) {
              productsPairListArray.push(pair)
            }
          }
          if (pair.length == 1){
            pair.push({title: ''})
            productsPairListArray.push(pair)
          }
          this.setData({productsPairListArray: productsPairListArray})
        }
        
      }
    })


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
  gotoDetail: function(e) {
    var id = e.currentTarget.id
    var path = ''
    for(var i = 0; i < this.data.productsPairListArray.length; i++) {
      if (this.data.productsPairListArray[i][0].product_id == id) {
        path = this.data.productsPairListArray[i][0].path
      }
      else if (this.data.productsPairListArray[i][1].title != '') {
        path = this.data.productsPairListArray[i][1].path
      }
      else {

      }
    }
    if (path!='') {
      wx.navigateTo({
        url: path
      })
    }
  },
  tabSwitch: function(e) {
    wx.redirectTo({
      url: e.detail.item.pagePath
    })
  },
  officalLoad: function(e){
    
  }
})

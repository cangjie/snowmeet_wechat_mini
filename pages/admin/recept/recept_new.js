// pages/admin/recept/recept_new.js
const util = require("../../../utils/util")
const app = getApp()

Page({

  /**
   * Page initial data
   */
  data: {
    showUserInfo: false,
    bizType:'sale',
    receptId: null,
    showSummary: false,
    showMainComponent: true
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({bizType: options.bizType,
      shop: options.shop,
      memberId: options.memberId? options.memberId : null,
      realName: options.realName? options.realName: null,
      gender: options.gender? options.gender : null,
      cell: options.cell? options.cell: null,
    })
    
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {
    var that = this
    app.loginPromiseNew.then(function (resolve){
      /*
      that.setData({scrollHeight: app.globalData.windowInfo.windowHeight * 2-220})
      that.getData()
      if (that.data.memberId){
        that.getMember()
      }
      */
    })
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  },
  showUserInfo(){
    var that = this
    that.setData({showUserInfo: true})
  },
  closeUserInfo(e){
    var that = this
    that.setData({showUserInfo: false})
  },
  /*
  getData(){
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Recept/GetUnfinishedRecept?bizType=' + encodeURIComponent(that.data.bizType) + '&name=' + encodeURIComponent(that.data.name) + '&gender=' + encodeURIComponent(that.data.gender) 
    + '&num=' + that.data.contactNum + '&memberId=' + that.data.memberId + '&shop=' + encodeURIComponent(that.data.shop) + '&sessionKey=' + app.globalData.sessionKey
    if (that.data.receptId){
      getUrl = app.globalData.requestPrefix + 'Recept/'
    }
    console.log('get url', getUrl)    
  },
  getMember(){
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Member/GetMember/' + that.data.memberId + '?sessionKey=' + app.globalData.sessionKey + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    util.performWebRequest(getUrl, null).then(function(resolve){
      console.log('get member', resolve)
      that.setData({showMainComponent: false})
      that.setData({member: resolve})
      that.setData({showMainComponent: true})
    }).catch(function(reject){

    })
  },
  */
  onPopClose(){
    var that = this
    that.setData({showUserInfo:false})
  }
})
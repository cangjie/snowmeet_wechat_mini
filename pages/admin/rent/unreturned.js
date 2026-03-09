// pages/admin/rent/unreturned.js
const app = getApp()
const util = require('../../../utils/util')
const data = require('../../../utils/data.js')
Page({

  /**
   * Page initial data
   */
  data: {
    querying: false,
    classList:[]
  },
  shopSelected(e){
    var that = this
    that.setData({shop: e.detail.shop})
  },
  getData(){
    var that = this
    that.setData({querying: true})
    var shop = (!that.data.shop || that.data.shop == '')? null : that.data.shop
    data.getUnreturnedRentItemPromise(shop, app.globalData.sessionKey).then(function (list){
      console.log('get list', list)
      for(var i = 0; i < list.length; i++){
        var items = list[i].items
        for(var j = 0; j < items.length; j++){
          var item = items[j]
          var pickDate = new Date(item.pickDate)
          item.pickDateDateStr = util.formatDate(pickDate)
          item.pickDateTimeStr = util.formatTimeStr(pickDate)

        }
      }
      that.setData({querying: false, classList: list})
    })
  },
  onChange(e){
    var that = this
    that.setData({
      activeName: e.detail,
    });
  },
 
  gotoDetail(e){
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'rent_details?id=' + id.toString(),
    })
  },
  call(e){
    var cell = e.currentTarget.id
    wx.makePhoneCall({
      phoneNumber: cell,
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    app.loginPromiseNew.then(function(resovle){

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

  }
})
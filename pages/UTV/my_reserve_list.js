// pages/UTV/my_reserve_list.js
const app = getApp()
const util = require('../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {

  },
  showDetail(e){
    wx.navigateTo({
      url: 'my_reserve_info?id=' + e.currentTarget.id,
    })
  },

  getData(){
    var that = this
    var queryUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetReserveList?sessionKey=' 
    + encodeURIComponent(app.globalData.sessionKey) + '&startDate=2023-01-01' 
    + '&endDate=2023-11-01&status=&onlyMine=1'
    wx.request({
      url: queryUrl,
      method: 'GET',
      success:(res)=>{
        console.log('get reserve data', res)
        if (res.statusCode != 200){
          return
        }
        var reserveList = res.data
        for(var i = 0; i < reserveList.length; i++){
          reserveList[i].trip_date_str = util.formatDate(new Date(reserveList[i].trip_date))
        }
        that.setData({reserveList: reserveList})
      }
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.getData()
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
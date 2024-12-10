// pages/admin/ski_pass/nanshan_reserve.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {

  },
  gotoDetail(e){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    wx.navigateTo({
      url: 'nanshan_reserve_detail?productId=' + idArr[0] + '&date=' + idArr[1],
    })
  },

  gotoNext(){
    var that = this
    var currentDate = new Date(that.data.currentDate)
    currentDate = currentDate.setDate(currentDate.getDate() + 1)
    that.setData({currentDate: util.formatDate(new Date(currentDate))})
    that.getData()
  },

  gotoPrev(){
    var that = this
    var currentDate = new Date(that.data.currentDate)
    currentDate = currentDate.setDate(currentDate.getDate() - 1)
    that.setData({currentDate: util.formatDate(new Date(currentDate))})
    that.getData()
  },

  getData(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/GetReserve?date=' + encodeURIComponent(that.data.currentDate) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var list = res.data
        var totalCount = 0
        var totalAmount = 0
        for(var i = 0;  i < list.length; i++){
          list[i].sumDealPriceStr = util.showAmount(parseFloat(list[i].sumDealPrice))
          totalAmount += list[i].sumDealPrice
          totalCount += list[i].count
        }
        var totalAmountStr = util.showAmount(totalAmount)
        that.setData({list, totalAmount, totalCount, totalAmountStr})
        console.log('get reserve', res.data)
      }
    })
  },



  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var currentDate = util.formatDate(new Date())
    console.log('current date', currentDate)
    that.setData({currentDate})
    app.loginPromiseNew.then(function(resovle){
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
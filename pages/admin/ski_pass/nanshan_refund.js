// pages/admin/ski_pass/nanshan_refund.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    dayNeedRefund: 0,
    nightNeedRefund: 0,
    dayNeedRefundStr: '',
    nightNeedRefundStr: ''
  },



  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var currentDate = util.formatDate(new Date())
    console.log('current date', currentDate)
    that.setData({currentDate})
    var dayNeedRefundStr = util.showAmount(that.data.dayNeedRefund)
    var nightNeedRefundStr = util.showAmount(that.data.nightNeedRefund)
    that.setData({dayNeedRefundStr, nightNeedRefundStr})
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

  },
  gotoDetail(e){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var productId = parseInt(idArr[0])
    var date = idArr[1]
    wx.navigateTo({
      url: 'nanshan_refund_detail?productId=' + productId + '&date=' + date,
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
    var url = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/GetDailyRefundSummary?date=' + encodeURIComponent(that.data.currentDate) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        console.log('list', res.data)
        var tempList = res.data
        var dayLight = []
        var night = []
        var dayRefundSum = 0
        var nightRefundSum = 0
        for (var i = 0; i < tempList.length; i++){
          tempList[i].sumRefundedStr = util.showAmount(tempList[i].sumRefunded)
          tempList[i].sumNeedRefundStr = util.showAmount(tempList[i].sumNeedRefund)
          if (tempList[i].isDaylight){
            dayRefundSum += tempList[i].sumNeedRefund 
            dayLight.push(tempList[i])
          }
          else{
            nightRefundSum += tempList[i].sumNeedRefund
            night.push(tempList[i])
          }
        }
        that.setData({dayLight, night, nightNeedRefundStr: util.showAmount(nightRefundSum), dayNeedRefundStr: util.showAmount(dayRefundSum)})

      }
    })

  }
})
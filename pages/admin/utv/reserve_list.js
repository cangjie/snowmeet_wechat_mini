// pages/admin/utv/reserve_list.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    statusList: ['全部', '待确认', '待支付', '待填信息', '待发车', '待退押金', '已完成', '已关闭'],
    statusSelectIndex: 0,
    startDate: util.formatDate(new Date()),
    endDate: util.formatDate(new Date()),
    reserveList:[]
  },

  getData(){
    var that = this
    var start = that.data.startDate
    var end = that.data.endDate
    var status  = that.data.statusList[that.data.statusSelectIndex]
    var queryUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetReserveList?sessionKey=' 
    + encodeURIComponent(app.globalData.sessionKey) + '&startDate=' + encodeURIComponent(start)
    + '&endDate=' + encodeURIComponent(end) + (that.data.statusSelectIndex > 0 ? ('&status=' + encodeURIComponent(status)) : '')
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

  selectStatus(e){
    var that = this
    that.setData({statusSelectIndex: parseInt(e.detail.value)})
  },

  setDate(e){
    console.log('date select', e)
    var that = this
    var value = e.detail.value
    switch(e.currentTarget.id){
      case 'start':
        that.setData({startDate: value})
        if ((new Date(that.data.startDate)) > (new Date(that.data.endDate))){
          that.setData({endDate: value})
        }
        break
      case 'end':
        that.setData({endDate: value})
        break
      default:
        break
    }
  },

  showDetail(e){
    wx.navigateTo({
      url: 'reserve_info?id=' + e.currentTarget.id,
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
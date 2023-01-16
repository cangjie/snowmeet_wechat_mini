// pages/admin/rent/rent_list.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    startDate: util.formatDate(new Date()),
    endDate: util.formatDate(new Date()),
    statusList: ['全部', '已付押金', '全部归还', '已退款', '免押金'],
    statusSelectedIndex: 0,
    shop: ''
  },

  gotoDetail(e){
    wx.navigateTo({
      url: 'rent_detail?id=' + e.currentTarget.id,
    })
  },
  setDate(e){
    var id = e.currentTarget.id
    var dateStr = e.detail.value
    var that = this
    //var date = util.formatDateString(dateStr)
    switch(id){
      case 'start':
        that.setData({startDate: dateStr})
        break
      case 'end':
        that.setData({endDate: dateStr})
        break
      default:
        break
    }
  },
  setStatus(e){
    var that = this
    that.setData({statusSelectedIndex: e.detail.value})
  },

  shopSelected(e){
    var that = this
    that.setData({shop: e.detail.shop})
  },

  getData(){
    var that = this
    var qUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentOrderListByStaff?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
     + '&start=' + encodeURIComponent(that.data.startDate) + '&end=' + encodeURIComponent(that.data.endDate) 
     + (that.data.shop == ''? '' : '&shop=' + encodeURIComponent(that.data.shop))
     + (that.data.statusSelectedIndex == 0 ? '' : '&status=' + encodeURIComponent(that.data.statusList[that.data.statusSelectedIndex]))
    console.log('q url', qUrl)
    wx.request({
      url: qUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){
          var orders = res.data
          for(var i = 0; i < orders.length; i++){
            var dueEndDate = new Date(orders[i].due_end_date)
            orders[i].due_end_date_str = util.formatDate(dueEndDate) + ' ' + util.formatTimeStr(dueEndDate)
          }
          that.setData({orders: res.data})
        }
      }
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {

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
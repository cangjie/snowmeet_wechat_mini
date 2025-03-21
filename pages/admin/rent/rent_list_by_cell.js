// pages/admin/rent/rent_list_by_cell.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    cell: ''
  },

  shopSelected(e){
    var that = this
    that.setData({shop: e.detail.shop})
    that.getData()
  },
  setCell(e){
    var that = this
    that.setData({cell: e.detail.value})
    that.getData()
  },
  getData(){
    var that = this
    var shop = that.data.shop
    var cell = that.data.cell
    if (cell.length < 4){
      return
    }
    var getUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentOrderListByCell/' + cell + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode == 200){
          var orderList = res.data
          for(var i = 0; i < orderList.length; i++){
            orderList[i].create_dateStr = util.formatDate(new Date(orderList[i].create_date))
          }
          that.setData({orders: res.data})
        }
      }
    })
  },
  gotoDetail(e){
    wx.navigateTo({
      url: 'rent_detail?id=' + e.currentTarget.id,
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    app.loginPromiseNew.then(function(resolve){
      //that.getData()
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
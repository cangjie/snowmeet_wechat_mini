// pages/mine/maintain/order_list.js
const app = getApp();
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {

  },

  gotoDetail(e){
    wx.navigateTo({
      url: 'order_detail?id=' + e.currentTarget.id,
    })
  },
  getData(){
    var that = this
    var getOrdersUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetMyMaintainOrders?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getOrdersUrl,
      method: 'GET',
      success:(res)=>{
        console.log('get my maintain orders', res)
        if (res.statusCode != 200){
          return
        }
        var orders = res.data
        var items = []
        for(var i = 0; i < orders.length && items.length < 5; i++){
          for(var j = 0; j < orders[i].items.length; j++){
            var item = orders[i].items[j]
            //item.order = orders[i]
            item.order_id = orders[i].orderId
            item.final_price = orders[i].final_price
            item.image = item.confirmed_images.split(',')[0]
            if (item.task_flow_num != undefined && item.task_flow_num != null && item.task_flow_num != ''){
              items.push(item)
            }
            
          }
        }
        that.setData({items: items})
      }
    })

  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function (resolve) {
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
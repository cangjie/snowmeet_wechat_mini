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
      url: 'task?id=' + e.currentTarget.id,
    })
  },
  getData(){
    var that = this
    var getOrdersUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetMyMaintainTask?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getOrdersUrl,
      method: 'GET',
      success:(res)=>{
        console.log('get my maintain orders', res)
        if (res.statusCode != 200){
          return
        }
        var tasks = res.data
        var items = []
        for(var i = 0; i < tasks.length && i < 20; i++){
          var item = tasks[i]
          item.order_idStr = item.order==null? '招待' : item.order_id
          item.final_price = (item.order==null)? 0 : item.order.final_price
          item.image = item.confirmed_images.split(',')[0]
          item.final_priceStr = util.showAmount(item.final_price)
          if (item.task_flow_num != undefined && item.task_flow_num != null && item.task_flow_num != ''){
            items.push(item)
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
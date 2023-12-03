// pages/admin/maintain/task_list.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    orderList:[],
    totalAmount: 0,
    totalAmountStr: '¥0.00'
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var end = new Date()
    var start = new Date()
    start.setDate(start.getDate()-1)
    that.setData({start: util.formatDate(start), end: util.formatDate(end)})
    app.loginPromiseNew.then(function (resolve){

      that.getData()
    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },
  shopSelected(e){
    console.log('shop selected', e)
    var that = this
    that.setData({shop: e.detail.shop})
    that.getData()
  },

  getData(){
    var that = this
    var getTaskUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetTasks?start=' + encodeURIComponent(that.data.start) + '&end=' + encodeURIComponent(that.data.end) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + ((that.data.shop == '')? '' : '&shop=' + encodeURIComponent(that.data.shop))
    var orderList = []
    wx.request({
      url: getTaskUrl,
      method: 'GET',
      success:(res)=>{
        console.log('get tasks', res)
        var tasks = res.data
        for(var i = 0; i < tasks.length; i++){
          var task = tasks[i]
          task.memo = ''
          task.date = util.formatDate(new Date(task.create_date))
          if (task.confirmed_equip_type == '双板' && task.confirmed_serial == ''){
            task.memo = '信息不全'
          }
          if (task.order != undefined && task.order != null 
            && task.order.final_price != undefined && task.order.final_price != null){
              task.orderPriceStr = util.showAmount(task.order.final_price)
          }
          else {
            task.orderPriceStr = '---'
          }
          if (task.order_id > 0){
            var exists = false
            for(var j = 0; j < orderList.length; j++){
              if (orderList[j].id == task.order_id){
                exists = true
                break
              }
            }
            if (!exists ){
              orderList.push(task.order)
            }
          }
        }
        var totalAmount = 0
        for(var i = 0; i < orderList.length; i++){
          totalAmount += orderList[i].final_price
        }
        var totalAmountStr = util.showAmount(totalAmount)

        that.setData({tasks: tasks, orderList: orderList, totalAmount: totalAmount, totalAmountStr: totalAmountStr})
      }
    })
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
  dateSelected(e){
    console.log('date selected', e)
    var that = this
    that.setData({start: e.detail.start, end: e.detail.end})
    that.getData()
  },
  gotoDetail(e){
    wx.navigateTo({
      url: 'task?id=' + e.currentTarget.id,
    })
  }
})
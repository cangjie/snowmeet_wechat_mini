// pages/admin/sale/order_list.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    shop: '',
    statusSelectedIndex: 0,
    startDate: new Date(),
    endDate: new Date(),
    nowDateStr: '',
    statusList:['全部', '待支付', '部分支付', '暂缓支付', '支付完成', '订单关闭'],
    orderList:[],
    totalAmount: 0,
    isQuerying: false
  },

  statusSelected(e){
    var that = this
    that.setData({statusSelectedIndex: e.detail.value})
  },

  shopSelected(e){
    var that = this
    console.log('shop selected:', e)
    that.setData({shop: e.detail.shop})
  },

  search(){
    var that = this
    that.setData({isQuerying: true})
    var searchUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/GetOrdersBystaff?startDate=' 
      + that.data.startDate + '&endDate=' + that.data.endDate + '&staffSessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    if (that.data.statusSelectedIndex>0){
      searchUrl = searchUrl + '&status=' + encodeURIComponent(that.data.statusList[that.data.statusSelectedIndex])
    }
    if (that.data.shop!=''){
      searchUrl = searchUrl + '&shop=' + encodeURIComponent(that.data.shop)
    }
    wx.request({
      url: searchUrl,
      method: 'GET',
      success:(res)=>{
        console.log('search result:', res.data)
        var orderList = res.data
        var totalAmount = 0
        for(var i = 0; i < orderList.length; i++){
          if (orderList[i].type.toString().indexOf('店销') < 0){
            orderList.splice(i, 1)
            i--
            continue
          }
          totalAmount = totalAmount + orderList[i].final_price
          var orderDateTime = new Date(orderList[i].create_date)
          orderList[i].date = orderDateTime.getFullYear().toString() + '-' + (orderDateTime.getMonth() + 1).toString() + '-' + orderDateTime.getDate().toString()
          orderList[i].time = orderDateTime.getHours().toString() + ':' + orderDateTime.getMinutes().toString()
        }
        that.setData({orderList: orderList, totalAmount: totalAmount})
      },
      complete:()=>{
        that.setData({isQuerying: false})
      }
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var nowDate = new Date()
    var nowDateStr = nowDate.getFullYear().toString() + '-' + (nowDate.getMonth() + 1).toString() + '-' + nowDate.getDate().toString()
    that.setData({startDate: nowDateStr, endDate: nowDateStr, nowDate: nowDateStr})
    console.log('now date', nowDate)
    app.loginPromiseNew.then(function(resolve) {
      that.setData({role: app.globalData.role})
      that.search()
    })
  },

  startDateSelected(e){
    console.log('start date selected:', e)
    var that = this
    that.setData({startDate: e.detail.value})
  },
  endDateSelected(e){
    var that = this
    that.setData({endDate: e.detail.value})
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
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'order_detail?id=' + id,
    })
  }
})
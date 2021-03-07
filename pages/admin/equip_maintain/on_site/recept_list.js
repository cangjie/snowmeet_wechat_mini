// pages/admin/equip_maintain/in_shop_order_quick/in_shop_order_paid_list.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    role:'',
    currentDate: '2021-1-1'
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var currentDate = new Date()
    var that = this
    this.setData({currentDate: currentDate.getFullYear().toString() + '-' + (currentDate.getMonth() + 1).toString() + '-' + currentDate.getDate().toString()})
    app.loginPromiseNew.then(function(resolve){
      that.setData({role: app.globalData.role})
      that.getData(that.data.currentDate)
    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  },
  datePickerChanged: function(e) {
    this.setData({currentDate: e.detail.value})
    this.getData(e.detail.value)
  },
  getData: function(currentDate) {
    var urlGetCurrentDateOrder = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_get_list_all.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    + '&date=' + currentDate
    wx.request({
      url: urlGetCurrentDateOrder,
      success: (res) => {
        if (res.data.status == 0) {
          var orderArr = res.data.maintain_in_shop_request
          var needInfoCount = 0
          for(var i = 0; i < orderArr.length; i++) {
            var status = '进行中'
            if (orderArr[i].confirmed_cell == '') {
              status = '补信息'
              needInfoCount++
            }
            if (orderArr[i].finish == '1') {
              status = '已取走'
            }
            orderArr[i].status = status
            var pickDate =  new Date(orderArr[i].confirmed_pick_date)
            orderArr[i].pick_date_str = pickDate.getFullYear().toString() + '-' + (pickDate.getMonth() + 1).toString() + '-' + pickDate.getDate().toString()
            var serviceItem = ''
            if (orderArr[i].confirmed_edge.toString() == '1') {
              serviceItem = serviceItem + '修刃 ' +  orderArr[i].confirmed_degree.toString() + ' '
            }
            if (orderArr[i].confirmed_candle.toString() == '1') {
              serviceItem = serviceItem + '打蜡 '
            }
            serviceItem = serviceItem + orderArr[i].confirmed_more.toString().trim()
            orderArr[i].serviceItem = serviceItem
            var amount = parseFloat(orderArr[i].order_real_pay_price.toString())
            orderArr[i].order_real_pay_price = amount.toFixed(2)
          }
          this.setData({orders: orderArr, totalCount: orderArr.length, needInfoCount: needInfoCount})
        }
      }
    })
  },
  gotoDetail: function(e) {
    wx.navigateTo({
      url: '/pages/admin/equip_maintain/on_site/recept?id=' + e.currentTarget.id,
    })
  }
})
// pages/printer/gprinter/test_print_tickets.js
Page({

  /**
   * Page initial data
   */
  data: {
    tickets:[]
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var tickets = []
    tickets.push({code:'001001001', name:'保养券', memo:'修刃打蜡双项减20;修刃打蜡单项减10;保养前请店员扫此码;地点：万龙雪具大厅;6号门滚梯下'})
    this.setData({tickets: tickets})
  },

  gotoPrint:function(res){
    var tickets = JSON.stringify(this.data.tickets)
    wx.navigateTo({
      url: '/pages/admin/printer/gprinter/ticket?tickets=' + tickets,
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

  }
})
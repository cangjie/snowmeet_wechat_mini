// pages/admin/ticket/ticket_template_list.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    ticketTemplateArr:[]
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      var getTemplateUrl = 'https://'  + app.globalData.domainName + '/core/Ticket/GetTemplateList'
      wx.request({
        url: getTemplateUrl,
        method: 'GET',
        success:(res)=>{
          var ticketTemplateArr = res.data
          for(var i = 0; i < ticketTemplateArr.length; i++){
            ticketTemplateArr[i].usage = ticketTemplateArr[i].memo.trim().split(';')
            ticketTemplateArr[i].printNum = 1
          }
          that.setData({ticketTemplateArr: ticketTemplateArr})
        }
      })
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
  print:function(source){
    var id = parseInt(source.currentTarget.id.replace('print_', ''))
    var ticketTemplateArr = this.data.ticketTemplateArr
    var name = ''
    var printNum = 0
    for(var i = 0; i < ticketTemplateArr.length; i++){
      if (ticketTemplateArr[i].id == id){
        name = ticketTemplateArr[i].name
        printNum = ticketTemplateArr[i].printNum
      }
    }
    if (name!=''){
      var msg = '您即将打印 ' + printNum + '张 ' + name 
      wx.showModal({
        //cancelColor: 'cancelColor',
        title: '准备打印',
        content: msg,
        success:(res)=>{
          if (res.confirm){
            var generateTicketsUrl = 'https://' + app.globalData.domainName + '/core/ticket/GenerateTickets/' + id + '?count=' + printNum + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
            wx.request({
              url: generateTicketsUrl,
              success:(res)=>{
                console.log(res)
                var ticketsStr = JSON.stringify(res.data)
                wx.navigateTo({
                  url: '../printer/gprinter/ticket?tickets=' + ticketsStr,
                })
              }
            })
          }
        }
      })
    }
  },
  changeNum:function(source){
    console.log(source)
    var id = parseInt(source.currentTarget.id.replace('print_num_', ''))
    var ticketTemplateArr = this.data.ticketTemplateArr
    for(var i = 0; i < ticketTemplateArr.length; i++){
      if (ticketTemplateArr[i].id == id){
        ticketTemplateArr[i].printNum = parseInt(source.detail.value)
      }
    }

  }
})
// pages/admin/printer/gprinter/print_task.js
const app = getApp()
const util = require('../../../../utils/util')
Page({
  data: {
    scrollHeight: 1000,
    logs: [],
    tasks: [],
    refreshing: false
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
    var that = this
    app.loginPromiseNew.then(function(resolve){
      var scrollHeight = (app.globalData.systemInfo.windowHeight - 100) * 2
      that.setData({scrollHeight})
    })
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {
    var that = this
    that.closeSocket()
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
  shopSelected(e){
    var that = this
    var shop = e.detail.shop
    that.setData({shop})
  },
  refreshTask(){
    var that = this
    that.setData({refreshing: true})
    var url = app.globalData.requestPrefix + 'Printer/RefreshPrintTask?shop=' + encodeURIComponent(that.data.shop) + '&startDate=' + util.formatDateString(new Date())
    util.performWebRequest(url, null).then(function(resolve){
      var tasks = resolve
      console.log('get tasks', tasks)
      that.renderTasks(resolve) 
      that.setData({refreshing: false})
    }).catch(function(reject){
      that.setData({refreshing: false})
    })
  },
  renderTasks(tasks){
    var that = this
    for(var i = 0; i < tasks.length; i++){
      var task = tasks[i]
      var date = new Date(task.create_date)
      task.dateStr = util.formatDate(date)
      task.timeStr = util.formatTimeStr(date)
      task.status = task.printed == 0 ? '未打印' : '已打印'
    }
    tasks = tasks.sort((a, b) => (b.id - a.id))
    that.setData({tasks})
  },
  appendTask(task){
    var that = this
    var tasks = that.data.tasks
    var exists = false
    for(var i = 0; tasks && i < tasks.length; i++){
      if (tasks[i].id == task.id){
        exists = true
        break
      }
    }
    if (!exists){
      tasks.push(task)
    }
    that.renderTasks(tasks)
  },
  initWebSocket(){
    var that = this
    var socket = wx.connectSocket({
      url: 'wss://' + app.globalData.domainName + '/ws',
      header:{'content-type': 'application/json'}
    })
    socket.isSendMessage = false
    socket.isReplied = false
    socket.onError((res)=>{
      that.socketError()
    })
    socket.onMessage((res)=>{
      that.socketMessage(res)
    })
    socket.onOpen((res)=>{
      console.log('socket open')
      that.socketOpen(res)
    })
    socket.onClose((res)=>{
      that.socketClosed()
    })
    that.setData({socket})
  },
  socketError(res){
    console.log('socket error')
  },
  socketOpen(res){
    var that = this
    var socket = that.data.socket
    socket.isOpen = true
    socket.isReplied = false
    that.sendCommand()
  },
  sendCommand(){
    var that = this
    var socket = that.data.socket
    var socketCmd = {
      command: 'getprinttask',
      data:{
        shop: that.data.shop,
        startDate: util.formatDate(new Date())
      }
    }
    var cmdStr = JSON.stringify(socketCmd)
    that.setData({socket})
    socket.send({
      data: cmdStr,
      success:(res)=>{
        socket.isSendMessage = true  
        console.log('send command', cmdStr)
      },
      complete:()=>{
        that.setData({socket})
      }
    })
  },
  socketMessage(res){
    var that = this
    var msg = JSON.parse(res.data)
    console.log('socket message', msg)
    for(var i = 0; msg && msg.data && i < msg.data.length; i++){
      var task = msg.data[i]
      that.appendTask(task)
      that.replyFetched(task.id)
    }
    var socket = that.data.socket
    socket.isReplied = true
    that.setData({socket})
  },
  replyFetched(id){
    var that = this
    var replyUrl = app.globalData.requestPrefix + 'Printer/ReplyFetched/' + id.toString()
    util.performWebRequest(replyUrl, null).then(function (resolve){
      that.sendCommand()
    }).catch(function(rejct){
      that.sendCommand()
    })
  },
  socketClosed(){
    console.log('socket is closed')
    var that = this
    var socket = that.data.socket
    socket.isOpen = false
    that.setData({socket})
  },
  closeSocket(){
    var that = this
    var socket = that.data.socket
    socket.close()
  },
  switchSocket(e){
    var that = this
    var socket = that.data.socket
    if (socket && socket.isOpen){
      that.closeSocket()
    }
    else{
      that.initWebSocket()
    }
  }
})